import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'

import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import {
  BundleMissingError,
  RenderBusyError,
  getRecapJob,
  recapFilename,
  startRecapRender,
} from '@/lib/recap/render'
import { buildRecapData, hasEnoughForRecap } from '@/remotion/build-recap'
import type { RecapData } from '@/remotion/types'

/** Chrome headless + ffmpeg: precisa do runtime Node, não do edge. */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ token: string }>

async function loadRecapData(token: string): Promise<RecapData | { error: string; status: number }> {
  const supabase = await createClient()

  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('token', token.toUpperCase())
    .single()

  if (error || !session) return { error: 'Sessão não encontrada', status: 404 }

  const [cardsResult, actionCardsResult] = await Promise.all([
    supabase.from('cards').select('*').eq('session_token', token).order('created_at'),
    supabase.from('action_cards').select('*').eq('session_token', token).order('created_at'),
  ])

  const cards = cardsResult.data ?? []
  const actionCards = actionCardsResult.data ?? []

  if (!hasEnoughForRecap(cards, actionCards)) {
    return { error: 'Board ainda sem conteúdo para um recap', status: 422 }
  }

  // Sem `participantId`: no arquivo baixado ninguém é "o próprio usuário", então
  // a fase anti-viés esconde todos os cards até a revelação, como na retro.
  return buildRecapData({ session, cards, actionCards })
}

/**
 * Coloca o recap para renderizar e responde na hora.
 *
 * O render leva minutos, e uma requisição minutos em silêncio morre no proxy
 * antes de chegar ao fim — por isso quem pede recebe só o identificador, e
 * acompanha pelo GET.
 */
export async function POST(_request: Request, { params }: { params: Params }) {
  const { token } = await params
  const data = await loadRecapData(token)
  if ('error' in data) {
    return NextResponse.json({ error: data.error }, { status: data.status })
  }

  try {
    const job = await startRecapRender(data)
    return NextResponse.json(
      { id: job.id, status: job.status, progress: job.progress },
      { status: job.status === 'done' ? 200 : 202 },
    )
  } catch (cause) {
    if (cause instanceof RenderBusyError) {
      return NextResponse.json({ error: cause.message }, { status: 429 })
    }
    if (cause instanceof BundleMissingError) {
      console.error(cause.message)
      return NextResponse.json({ error: 'Render do recap indisponível' }, { status: 503 })
    }
    console.error('Falha ao iniciar o recap', cause)
    return NextResponse.json({ error: 'Não foi possível gerar o vídeo' }, { status: 500 })
  }
}

/**
 * Andamento enquanto renderiza (202) e o arquivo quando termina (200).
 *
 * Cada chamada responde de imediato, então nenhuma conexão fica parada tempo
 * suficiente para o proxy derrubar.
 */
export async function GET(request: Request, { params }: { params: Params }) {
  const { token } = await params
  const id = new URL(request.url).searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Informe o id do render' }, { status: 400 })
  }

  const job = await getRecapJob(id)
  if (!job) {
    return NextResponse.json({ error: 'Render não encontrado' }, { status: 404 })
  }

  if (job.status === 'error') {
    return NextResponse.json({ error: job.error ?? 'Falha ao gerar o vídeo' }, { status: 500 })
  }

  if (job.status === 'rendering' || !job.file) {
    return NextResponse.json({ status: job.status, progress: job.progress }, { status: 202 })
  }

  const { size } = await stat(job.file)
  const stream = Readable.toWeb(createReadStream(job.file)) as ReadableStream<Uint8Array>

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(size),
      'Content-Disposition': `attachment; filename="${recapFilename({ token } as RecapData)}"`,
      // O recap muda junto com o board; um cache aqui entregaria vídeo velho.
      'Cache-Control': 'no-store',
    },
  })
}
