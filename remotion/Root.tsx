/**
 * Registro da composição para renderização fora do navegador.
 *
 * A página do recap monta o vídeo com o `<Player>`; o download precisa da mesma
 * composição num bundle que o `@remotion/renderer` saiba abrir. Este arquivo é
 * só a declaração — a peça em si continua sendo `RetroRecap`, e a duração sai da
 * mesma `buildTimeline` que o player usa, para o MP4 nunca sair mais curto ou
 * mais longo do que o vídeo que a pessoa assistiu.
 */

import React from 'react'
import { Composition, registerRoot } from 'remotion'

import { RECAP_COMPOSITION } from './composition'
import { RetroRecap, type RetroRecapProps } from './RetroRecap'
import { demoRecap } from './data/demo'
import { FPS, HEIGHT, WIDTH } from './theme'
import { buildTimeline } from './timeline'

export function RemotionRoot() {
  return (
    <Composition
      id={RECAP_COMPOSITION}
      component={RetroRecap}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={buildTimeline(demoRecap).durationInFrames}
      defaultProps={{ data: demoRecap, showCaptions: true, music: true } as RetroRecapProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: buildTimeline(props.data).durationInFrames,
      })}
    />
  )
}

registerRoot(RemotionRoot)
