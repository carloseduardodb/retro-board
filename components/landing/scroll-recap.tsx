'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlayerRef } from '@remotion/player'

import { RecapPlayer } from '@/components/landing/recap-player'
import { buildTimeline } from '@/remotion/timeline'
import type { RecapData } from '@/remotion/types'
import { cn } from '@/lib/utils'

/**
 * A seção que dá o tom da landing: o vídeo não toca sozinho — quem rola a
 * página conduz a retro, frame a frame.
 *
 * Como a composição é uma função pura do frame (ver `remotion/timeline.ts`),
 * dá para pular para qualquer ponto sem estado intermediário: a posição do
 * scroll vira `seekTo` direto, e ir para trás desfaz a retro exatamente igual.
 */
export function ScrollRecap({ data }: { data: RecapData }) {
  const timeline = useMemo(() => buildTimeline(data), [data])
  const scenes = useMemo(() => timeline.scenes.filter((scene) => scene.duration > 0), [timeline])

  const sectionRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<PlayerRef>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [activeScene, setActiveScene] = useState(scenes[0].id)
  const [scrubbing, setScrubbing] = useState(true)

  useEffect(() => {
    // Quem pediu menos movimento assiste com os controles normais do player.
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setScrubbing(!media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (!scrubbing) return

    const lastFrame = { current: -1 }
    let raf = 0

    const update = () => {
      raf = 0
      const section = sectionRef.current
      if (!section) return

      const rect = section.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      if (scrollable <= 0) return

      const progress = Math.min(1, Math.max(0, -rect.top / scrollable))
      const frame = Math.round(progress * (timeline.durationInFrames - 1))
      if (frame === lastFrame.current) return
      lastFrame.current = frame

      playerRef.current?.pause()
      playerRef.current?.seekTo(frame)

      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${progress})`
      }

      const scene = scenes.find((s) => frame >= s.from && frame < s.from + s.duration)
      if (scene) setActiveScene((current) => (current === scene.id ? current : scene.id))
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    update()

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [scrubbing, scenes, timeline.durationInFrames])

  const jumpToScene = (from: number) => {
    const section = sectionRef.current
    if (!section) return
    const scrollable = section.offsetHeight - window.innerHeight
    const progress = from / (timeline.durationInFrames - 1)
    window.scrollTo({
      top: section.offsetTop + scrollable * progress + 2,
      behavior: 'smooth',
    })
  }

  return (
    <section
      ref={sectionRef}
      // Cada cena ganha aproximadamente uma tela de rolagem.
      style={{ height: `${scenes.length * 65 + 60}vh` }}
      className="relative"
    >
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 lg:grid-cols-[320px_1fr] lg:px-8">
          <div className="hidden lg:block">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Role para conduzir a retro
            </p>
            <ol className="space-y-1">
              {scenes.map((scene) => {
                const active = scene.id === activeScene
                return (
                  <li key={scene.id}>
                    <button
                      type="button"
                      onClick={() => jumpToScene(scene.from)}
                      className={cn(
                        'w-full rounded-lg border-l-2 px-4 py-3 text-left transition-colors',
                        active
                          ? 'border-primary bg-accent/60 text-foreground'
                          : 'border-transparent text-muted-foreground hover:bg-accent/30',
                      )}
                    >
                      <span className="block text-sm font-semibold">{scene.title}</span>
                      <span
                        className={cn(
                          'block overflow-hidden text-xs leading-snug transition-all',
                          active ? 'mt-1 max-h-16 opacity-70' : 'max-h-0 opacity-0',
                        )}
                      >
                        {scene.subtitle}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>

          <div>
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              <div className="aspect-video w-full">
                <RecapPlayer
                  ref={playerRef}
                  data={data}
                  showCaptions
                  controls={!scrubbing}
                  autoPlay={!scrubbing}
                  loop={!scrubbing}
                />
              </div>
            </div>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-border">
              <div
                ref={progressRef}
                className="h-full w-full origin-left scale-x-0 bg-primary"
                aria-hidden
              />
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground lg:hidden">
              Continue rolando — o vídeo acompanha
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
