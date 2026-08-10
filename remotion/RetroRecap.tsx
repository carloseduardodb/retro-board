/**
 * Composição principal: a retro inteira contada em vídeo.
 *
 * A mesma composição serve a landing (dados fictícios) e o recap de uma sessão
 * real — a única diferença é o `data` que entra.
 */

'use client'

import React, { useMemo } from 'react'
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

import { Stage } from './Stage'
import { buildTimeline, type Timeline } from './timeline'
import { columns, font, palette, HEIGHT, WIDTH } from './theme'
import type { RecapData } from './types'

const ease = { easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

export type RetroRecapProps = {
  data: RecapData
  /** Oculta as legendas de cena — útil quando a página já explica em texto. */
  showCaptions?: boolean
}

export function useRecapTimeline(data: RecapData): Timeline {
  return useMemo(() => buildTimeline(data), [data])
}

export function RetroRecap({ data, showCaptions = true }: RetroRecapProps) {
  const frame = useCurrentFrame()
  const timeline = useRecapTimeline(data)

  const intro = timeline.scene('intro')
  const outro = timeline.scene('outro')

  // Câmera: um empurrão discreto ao longo do vídeo, com um respiro na revelação.
  const push = interpolate(frame, [0, timeline.durationInFrames], [1, 1.035], ease)
  const revealBreath = interpolate(
    frame,
    [timeline.marks.revealAt - 8, timeline.marks.revealAt + 6, timeline.marks.revealAt + 40],
    [1, 0.985, 1],
    ease,
  )

  return (
    // `color` explícito na raiz: sem ele o vídeo herda o `--foreground` da
    // página e, no tema escuro, o texto dos cards fica branco sobre branco.
    <AbsoluteFill
      style={{ backgroundColor: palette.background, fontFamily: font, color: palette.foreground }}
    >
      <AbsoluteFill style={{ transform: `scale(${push * revealBreath})` }}>
        <Stage data={data} timeline={timeline} />
      </AbsoluteFill>

      <RevealFlash at={timeline.marks.revealAt} />
      {showCaptions && <Captions timeline={timeline} />}
      <IntroOverlay
        data={data}
        from={intro.from}
        duration={intro.duration}
        totalSeconds={Math.round(timeline.durationInFrames / 30)}
      />
      <OutroOverlay data={data} from={outro.from} duration={outro.duration} />
    </AbsoluteFill>
  )
}

/* -------------------------------------------------------------- legendas */

function Captions({ timeline }: { timeline: Timeline }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const scene = timeline.scenes.find(
    (s) => s.duration > 0 && frame >= s.from && frame < s.from + s.duration,
  )
  if (!scene || scene.id === 'intro' || scene.id === 'outro') return null

  const local = frame - scene.from
  const entry = spring({ frame: local - 6, fps, config: { damping: 16, mass: 0.7 } })
  const exit = interpolate(local, [scene.duration - 18, scene.duration], [1, 0], ease)
  const opacity = entry * exit

  return (
    <div
      style={{
        position: 'absolute',
        left: 56,
        bottom: 48,
        maxWidth: 900,
        padding: '22px 30px',
        borderRadius: 18,
        backgroundColor: 'rgba(12,16,26,0.86)',
        color: '#fff',
        opacity,
        transform: `translateY(${(1 - entry) * 18}px)`,
        boxShadow: '0 18px 50px rgba(12,16,26,0.28)',
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.6 }}>{scene.title}</div>
      <div style={{ fontSize: 22, marginTop: 8, opacity: 0.78 }}>{scene.subtitle}</div>
    </div>
  )
}

/**
 * O momento da revelação anti-viés: uma onda clara varre o board quando o timer
 * para e todos os cards aparecem ao mesmo tempo.
 */
function RevealFlash({ at }: { at: number }) {
  const frame = useCurrentFrame()
  const progress = interpolate(frame, [at - 6, at + 34], [0, 1], ease)
  if (frame < at - 6 || progress >= 1) return null

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(100deg, rgba(255,255,255,0) ${progress * 130 - 40}%, rgba(255,255,255,0.85) ${progress * 130 - 12}%, rgba(255,255,255,0) ${progress * 130 + 14}%)`,
        pointerEvents: 'none',
      }}
    />
  )
}

/* -------------------------------------------------------------- overlays */

function IntroOverlay({
  data,
  from,
  duration,
  totalSeconds,
}: {
  data: RecapData
  from: number
  duration: number
  totalSeconds: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const local = frame - from
  const out = interpolate(local, [duration - 34, duration], [1, 0], ease)
  if (local < 0 || out <= 0) return null

  const title = spring({ frame: local - 4, fps, config: { damping: 16, mass: 0.8 } })
  const link = spring({ frame: local - 20, fps, config: { damping: 16, mass: 0.8 } })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'rgba(245,247,251,0.94)',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: out,
      }}
    >
      <div style={{ textAlign: 'center', transform: `translateY(${(1 - title) * 24}px)`, opacity: title }}>
        <div style={{ fontSize: 26, color: palette.muted, letterSpacing: 6, textTransform: 'uppercase' }}>
          {data.label}
        </div>
        <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -3, marginTop: 12 }}>
          Uma retro em {totalSeconds} segundos
        </div>
      </div>
      <div
        style={{
          marginTop: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '18px 30px',
          borderRadius: 999,
          backgroundColor: palette.surface,
          border: `1px solid ${palette.border}`,
          fontSize: 30,
          opacity: link,
          transform: `scale(${0.9 + link * 0.1})`,
        }}
      >
        <span style={{ color: palette.muted }}>/board/</span>
        <span style={{ fontWeight: 800, letterSpacing: 6 }}>{data.token}</span>
      </div>
    </AbsoluteFill>
  )
}

function OutroOverlay({ data, from, duration }: { data: RecapData; from: number; duration: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const local = frame - from
  if (local < 0) return null

  const cover = interpolate(local, [0, 26], [0, 1], ease)
  const rise = spring({ frame: local - 14, fps, config: { damping: 16, mass: 0.8 } })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgba(12,16,26,${0.93 * cover})`,
        color: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 26,
      }}
    >
      <div style={{ display: 'flex', gap: 14, opacity: rise }}>
        {(['good', 'bad', 'ideas', 'actions'] as const).map((column, index) => (
          <span
            key={column}
            style={{
              width: 84,
              height: 10,
              borderRadius: 999,
              backgroundColor: columns[column].accent,
              transform: `scaleX(${spring({ frame: local - 10 - index * 4, fps, config: { damping: 14 } })})`,
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontSize: 82,
          fontWeight: 800,
          letterSpacing: -2.5,
          opacity: rise,
          transform: `translateY(${(1 - rise) * 20}px)`,
        }}
      >
        {data.actions.length} ações. Zero atas.
      </div>
      <div style={{ fontSize: 30, opacity: 0.72 * rise }}>
        Retro Board · sessão {data.token} · abra o link e comece agora
      </div>
    </AbsoluteFill>
  )
}

export const recapDimensions = { width: WIDTH, height: HEIGHT }
