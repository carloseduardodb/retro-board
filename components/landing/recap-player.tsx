'use client'

import { forwardRef, useMemo } from 'react'
import { Player, type PlayerRef } from '@remotion/player'

import { RetroRecap } from '@/remotion/RetroRecap'
import { buildTimeline } from '@/remotion/timeline'
import { FPS, HEIGHT, WIDTH } from '@/remotion/theme'
import type { RecapData } from '@/remotion/types'

type RecapPlayerProps = {
  data: RecapData
  autoPlay?: boolean
  loop?: boolean
  controls?: boolean
  showCaptions?: boolean
  className?: string
}

/**
 * Player da composição `RetroRecap`. É o mesmo componente na landing (dados
 * fictícios) e no recap de uma sessão real (dados do board).
 */
export const RecapPlayer = forwardRef<PlayerRef, RecapPlayerProps>(function RecapPlayer(
  { data, autoPlay = false, loop = false, controls = false, showCaptions = true, className },
  ref,
) {
  const durationInFrames = useMemo(() => buildTimeline(data).durationInFrames, [data])

  return (
    <Player
      ref={ref}
      component={RetroRecap}
      inputProps={{ data, showCaptions }}
      durationInFrames={durationInFrames}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      fps={FPS}
      autoPlay={autoPlay}
      loop={loop}
      controls={controls}
      clickToPlay={controls}
      doubleClickToFullscreen={controls}
      className={className}
      style={{ width: '100%', height: '100%' }}
    />
  )
})

/** Duração do recap em segundos — usada para rotular a UI. */
export function useRecapSeconds(data: RecapData): number {
  return useMemo(() => Math.round(buildTimeline(data).durationInFrames / FPS), [data])
}
