'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { PlayerRef } from '@remotion/player'
import { ArrowLeft, Download, Loader2, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { RecapPlayer, useRecapSeconds } from '@/components/landing/recap-player'
import { useParticipant } from '@/hooks/use-participant'
import { buildRecapData, hasEnoughForRecap } from '@/remotion/build-recap'
import type { ActionCard, Card, Session } from '@/lib/types/database'

type RecapClientProps = {
  session: Session
  cards: Card[]
  actionCards: ActionCard[]
}

/**
 * Recap da sessão: a mesma composição da landing, alimentada com o board real.
 * O vídeo é montado no navegador a partir do estado atual — nada é gravado nem
 * persistido.
 */
export function RecapClient({ session, cards, actionCards }: RecapClientProps) {
  const { participantId, isReady } = useParticipant()
  const playerRef = useRef<PlayerRef>(null)

  const data = useMemo(
    () => buildRecapData({ session, cards, actionCards, participantId }),
    [session, cards, actionCards, participantId],
  )
  const seconds = useRecapSeconds(data)
  const enough = hasEnoughForRecap(cards, actionCards)

  const [muted, setMuted] = useState(true)

  const restart = () => {
    playerRef.current?.seekTo(0)
    playerRef.current?.play()
  }

  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  /**
   * O vídeo da página é DOM sendo animado — não existe arquivo. Baixar significa
   * pedir ao servidor que renderize a composição quadro a quadro, o que leva
   * minutos.
   *
   * Daí as duas etapas: o POST enfileira e volta na hora, e o GET pergunta o
   * andamento até o arquivo existir. Esperar tudo numa requisição só faria o
   * proxy derrubar a conexão bem antes do vídeo ficar pronto.
   */
  const download = useCallback(async () => {
    setDownloading(true)
    setDownloadError(null)
    setProgress(0)

    const fail = async (response: Response) => {
      const body = await response.json().catch(() => null)
      return new Error(body?.error ?? 'Não foi possível gerar o vídeo')
    }

    try {
      const start = await fetch(`/api/recap/${session.token}/video`, { method: 'POST' })
      if (!start.ok && start.status !== 202) throw await fail(start)
      const { id } = (await start.json()) as { id: string }

      for (;;) {
        const response = await fetch(`/api/recap/${session.token}/video?id=${id}`)

        if (response.status === 202) {
          const { progress: value } = (await response.json()) as { progress: number }
          setProgress(value)
          await new Promise((resolve) => setTimeout(resolve, 2000))
          continue
        }
        if (!response.ok) throw await fail(response)

        const url = URL.createObjectURL(await response.blob())
        const link = document.createElement('a')
        link.href = url
        link.download = `retro-${session.token.toLowerCase()}.mp4`
        link.click()
        URL.revokeObjectURL(url)
        break
      }
    } catch (cause) {
      setDownloadError(cause instanceof Error ? cause.message : 'Falha no download')
    } finally {
      setDownloading(false)
    }
  }, [session.token])

  // O player começa mudo (autoplay com som é bloqueado); daqui em diante é
  // escolha de quem assiste.
  const toggleSound = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (player.isMuted()) {
      player.unmute()
      setMuted(false)
    } else {
      player.mute()
      setMuted(true)
    }
  }, [])

  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-6">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/board/${session.token}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao board
          </Link>
        </Button>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono tracking-widest">{session.token}</span>
          <span>·</span>
          <span>{seconds}s</span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          O recap desta retro
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Montado agora, a partir do estado atual do board: {cards.length}{' '}
          {cards.length === 1 ? 'card' : 'cards'}, {actionCards.length}{' '}
          {actionCards.length === 1 ? 'ação' : 'ações'}. Continua anônimo — nenhum autor aparece.
        </p>

        {!enough ? (
          <div className="mt-10 rounded-xl border border-dashed border-border p-12 text-center">
            <p className="font-medium">Ainda não há board suficiente para um recap.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Adicione alguns cards na sessão e volte aqui.
            </p>
            <Button asChild className="mt-6">
              <Link href={`/board/${session.token}`}>Ir para o board</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              <div className="aspect-video w-full">
                {isReady && <RecapPlayer ref={playerRef} data={data} controls autoPlay music />}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={restart} variant="secondary" size="sm">
                <RotateCcw className="mr-2 h-4 w-4" />
                Assistir de novo
              </Button>
              <Button onClick={() => playerRef.current?.play()} variant="ghost" size="sm">
                <Play className="mr-2 h-4 w-4" />
                Continuar
              </Button>
              <Button onClick={toggleSound} variant="ghost" size="sm">
                {muted ? (
                  <VolumeX className="mr-2 h-4 w-4" />
                ) : (
                  <Volume2 className="mr-2 h-4 w-4" />
                )}
                {muted ? 'Ativar som' : 'Silenciar'}
              </Button>
              <Button onClick={download} disabled={downloading} variant="secondary" size="sm">
                {downloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {downloading
                  ? `Gerando o MP4… ${Math.round(progress * 100)}%`
                  : 'Baixar em MP4'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Os seus cards aparecem desde o começo; os dos outros só depois da revelação, igual
                à retro ao vivo.
              </p>
            </div>

            {downloading && (
              <div className="mt-3 max-w-md">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-[width] duration-500"
                    style={{ width: `${Math.max(2, progress * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  O servidor está desenhando os {seconds * 30} quadros em 1080p e juntando com a
                  trilha. Leva alguns minutos — pode deixar a aba aberta.
                </p>
              </div>
            )}
            {downloadError && (
              <p className="mt-3 text-xs text-destructive">{downloadError}</p>
            )}
          </>
        )}
      </section>
    </main>
  )
}
