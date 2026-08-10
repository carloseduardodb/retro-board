'use client'

import { RecapPlayer } from '@/components/landing/recap-player'
import { demoRecap } from '@/remotion/data/demo'

/** Player do hero: toca sozinho, em loop, sem controles e sem legendas de cena. */
export function HeroRecap() {
  return <RecapPlayer data={demoRecap} autoPlay loop showCaptions={false} />
}
