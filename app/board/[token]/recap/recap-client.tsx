'use client'

import { useMemo, useRef } from 'react'
import Link from 'next/link'
import type { PlayerRef } from '@remotion/player'
import { ArrowLeft, Play, RotateCcw } from 'lucide-react'

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

  const restart = () => {
    playerRef.current?.seekTo(0)
    playerRef.current?.play()
  }

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
                {isReady && <RecapPlayer ref={playerRef} data={data} controls autoPlay />}
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
              <p className="text-xs text-muted-foreground">
                Os seus cards aparecem desde o começo; os dos outros só depois da revelação, igual
                à retro ao vivo.
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
