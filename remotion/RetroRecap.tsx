/**
 * Composição principal: a retro inteira contada em vídeo.
 *
 * A mesma composição serve a landing (dados fictícios) e o recap de uma sessão
 * real — a única diferença é o `data` que entra.
 */

'use client'

import React, { useMemo } from 'react'
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

import { buildCamera, cameraAt } from './camera'
import { Stage } from './Stage'
import { buildTimeline, type Timeline } from './timeline'
import { columns, font, palette, HEIGHT, WIDTH } from './theme'
import type { RecapData } from './types'

const ease = { easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/**
 * Loop gerado por `scripts/build-recap-theme.py`.
 *
 * `staticFile` resolve nos dois contextos: no player dentro do Next devolve o
 * caminho de `public/`, e no bundle do render devolve a base estática servida
 * pelo Remotion.
 */
export const recapTheme = () => staticFile('audio/recap-theme.mp3')

export type RetroRecapProps = {
  data: RecapData
  /** Oculta as legendas de cena — útil quando a página já explica em texto. */
  showCaptions?: boolean
  /**
   * Liga a trilha. Fica desligada por padrão de propósito: a landing dá play
   * sozinha, e navegador nenhum permite autoplay com som — pedir áudio ali
   * faria o vídeo simplesmente não começar.
   */
  music?: boolean
}

export function useRecapTimeline(data: RecapData): Timeline {
  return useMemo(() => buildTimeline(data), [data])
}

export function RetroRecap({ data, showCaptions = true, music = false }: RetroRecapProps) {
  const frame = useCurrentFrame()
  const timeline = useRecapTimeline(data)

  const intro = timeline.scene('intro')
  const outro = timeline.scene('outro')

  // Câmera: o roteiro de enquadramentos (`remotion/camera.ts`) mais um respiro
  // na revelação — o quadro recua um instante quando tudo aparece de uma vez.
  const shots = useMemo(() => buildCamera(timeline), [timeline])
  const camera = cameraAt(shots, frame)
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
      {/* Duas camadas de propósito: o respiro escala em torno do centro do
          quadro, a câmera escala em torno da origem do board. Misturar as duas
          numa transform só faria o enquadramento derivar do alvo. */}
      <AbsoluteFill style={{ transform: `scale(${revealBreath})` }}>
        <AbsoluteFill
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
            transformOrigin: '0 0',
          }}
        >
          <Stage data={data} timeline={timeline} />
        </AbsoluteFill>
      </AbsoluteFill>

      {music && <Theme timeline={timeline} />}
      <RevealFlash at={timeline.marks.revealAt} />
      <HighlightsOverlay timeline={timeline} />
      {showCaptions && <Captions timeline={timeline} />}
      <IntroOverlay
        data={data}
        from={intro.from}
        duration={intro.duration}
        totalSeconds={Math.round(timeline.durationInFrames / 30)}
      />
      <OutroOverlay data={data} timeline={timeline} from={outro.from} duration={outro.duration} />
    </AbsoluteFill>
  )
}

/* ---------------------------------------------------------------- trilha */

/**
 * A trilha entra por baixo: sobe na abertura, abaixa um pouco no silêncio da
 * revelação — o beat funciona melhor com o som recuando — e sai no fim.
 */
function Theme({ timeline }: { timeline: Timeline }) {
  const { revealAt } = timeline.marks
  const end = timeline.durationInFrames

  return (
    <Audio
      src={recapTheme()}
      loop
      volume={(frame) =>
        interpolate(
          frame,
          [0, 40, revealAt - 20, revealAt + 4, revealAt + 50, end - 70, end - 6],
          [0, 0.62, 0.62, 0.3, 0.62, 0.62, 0],
          ease,
        )
      }
    />
  )
}

/* -------------------------------------------------------------- legendas */

function Captions({ timeline }: { timeline: Timeline }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const scene = timeline.scenes.find(
    (s) => s.duration > 0 && frame >= s.from && frame < s.from + s.duration,
  )
  // Intro, destaques e outro já falam por si em tela cheia.
  if (!scene || scene.id === 'intro' || scene.id === 'outro' || scene.id === 'highlights') {
    return null
  }

  const local = frame - scene.from
  const entry = spring({ frame: local - 6, fps, config: { damping: 16, mass: 0.7 } })
  // Na varredura a legenda sai cedo: ela ocupa o canto de uma coluna, e é
  // justamente o pé das colunas que a cena existe para mostrar.
  const leaveAt = scene.id === 'tour' ? Math.round(scene.duration * 0.3) : scene.duration - 18
  const exit = interpolate(local, [leaveAt, leaveAt + 18], [1, 0], ease)
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


/* ----------------------------------------------------------- destaques */

/**
 * Os cards mais votados em tela cheia.
 *
 * Numa retro grande o board fica denso e o texto do card, pequeno: esta cena é o
 * contrapeso — o que o time mais votou volta em tamanho de leitura, um por vez.
 */
function HighlightsOverlay({ timeline }: { timeline: Timeline }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const scene = timeline.scene('highlights')
  const local = frame - scene.from
  if (scene.duration === 0 || local < 0 || local >= scene.duration) return null

  const cover = interpolate(
    local,
    [0, 18, scene.duration - 18, scene.duration],
    [0, 1, 1, 0],
    ease,
  )
  const slot = Math.floor((scene.duration - 40) / timeline.highlights.length)
  const index = Math.min(timeline.highlights.length - 1, Math.floor(Math.max(0, local - 20) / slot))
  const track = timeline.highlights[index]
  const inSlot = Math.max(0, local - 20) - index * slot

  const enter = spring({ frame: inSlot, fps, config: { damping: 17, mass: 0.8 } })
  const leave = interpolate(inSlot, [slot - 14, slot], [1, 0], ease)
  const meta = columns[track.card.column]
  const reactions = Object.entries(track.card.reactions).sort((a, b) => b[1] - a[1])

  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgba(245,247,251,${0.96 * cover})`,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 140px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1360,
          opacity: enter * leave,
          transform: `translateY(${(1 - enter) * 34}px)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span style={{ width: 18, height: 18, borderRadius: 6, backgroundColor: meta.accent }} />
          <span style={{ fontSize: 28, fontWeight: 700, color: meta.ink, letterSpacing: 1 }}>
            {meta.title.toUpperCase()}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 26, color: palette.muted }}>
            {index + 1} de {timeline.highlights.length}
          </span>
        </div>

        <div
          style={{
            marginTop: 34,
            padding: '48px 56px',
            borderRadius: 28,
            backgroundColor: palette.surface,
            border: `1px solid ${palette.border}`,
            borderLeft: `10px solid ${meta.accent}`,
            boxShadow: '0 30px 80px rgba(16,24,40,0.10)',
          }}
        >
          <div style={{ fontSize: 58, lineHeight: '72px', fontWeight: 600, letterSpacing: -1.2 }}>
            {track.card.text}
          </div>

          <div style={{ marginTop: 38, display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Um card pode estar aqui só por reação; mostrar "👍 0" faria
                parecer que ele subiu sem motivo. */}
            {track.card.votes > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 26px',
                  borderRadius: 999,
                  backgroundColor: '#eef4ff',
                  border: '1px solid #c7dbff',
                  transform: `scale(${0.85 + enter * 0.15})`,
                }}
              >
                <span style={{ fontSize: 30 }}>👍</span>
                <span style={{ fontSize: 34, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {track.card.votes}
                </span>
              </div>
            )}
            {reactions.map(([emoji, count], i) => (
              <div
                key={emoji}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '14px 22px',
                  borderRadius: 999,
                  backgroundColor: palette.background,
                  border: `1px solid ${palette.border}`,
                  fontSize: 28,
                  transform: `scale(${spring({ frame: inSlot - 10 - i * 5, fps, config: { damping: 11, mass: 0.4 } })})`,
                }}
              >
                <span>{emoji}</span>
                <span style={{ color: palette.muted, fontWeight: 700 }}>{count}</span>
              </div>
            ))}
            {track.card.groupLabel && (
              <span style={{ marginLeft: 'auto', fontSize: 26, color: palette.muted }}>
                tema · {track.card.groupLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
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

function OutroOverlay({
  data,
  timeline,
  from,
  duration,
}: {
  data: RecapData
  timeline: Timeline
  from: number
  duration: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const local = frame - from
  if (local < 0) return null

  const cover = interpolate(local, [0, 26], [0, 1], ease)
  const rise = spring({ frame: local - 14, fps, config: { damping: 16, mass: 0.8 } })
  const { stats } = timeline

  // O placar só lista o que a retro de fato teve: uma coluna zerada não vira
  // métrica de vaidade no fim do vídeo.
  const tally = [
    { label: stats.cards === 1 ? 'card' : 'cards', value: stats.cards },
    { label: stats.votes === 1 ? 'voto' : 'votos', value: stats.votes },
    { label: stats.reactions === 1 ? 'reação' : 'reações', value: stats.reactions },
    { label: stats.groups === 1 ? 'tema' : 'temas', value: stats.groups },
    { label: stats.actions === 1 ? 'ação' : 'ações', value: stats.actions },
  ].filter((item) => item.value > 0)

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
          fontSize: data.actions.length > 0 ? 82 : 66,
          fontWeight: 800,
          letterSpacing: -2.5,
          textAlign: 'center',
          opacity: rise,
          transform: `translateY(${(1 - rise) * 20}px)`,
        }}
      >
        {/* Sem ação nenhuma, comemorar seria zombar do time. */}
        {data.actions.length > 0
          ? `${data.actions.length} ${data.actions.length === 1 ? 'ação' : 'ações'}. Zero atas.`
          : 'Esta retro ainda não virou ação.'}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 56, marginTop: 10 }}>
        {tally.map((item, index) => {
          const pop = spring({ frame: local - 26 - index * 6, fps, config: { damping: 15, mass: 0.6 } })
          const value = Math.round(interpolate(pop, [0, 1], [0, item.value]))
          return (
            <div key={item.label} style={{ textAlign: 'center', opacity: pop }}>
              <div
                style={{
                  fontSize: 62,
                  fontWeight: 800,
                  letterSpacing: -2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {value}
              </div>
              <div style={{ fontSize: 24, opacity: 0.6, marginTop: 2 }}>{item.label}</div>
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: 30, opacity: 0.72 * rise, marginTop: 8 }}>
        Retro Board · sessão {data.token} · abra o link e comece agora
      </div>
    </AbsoluteFill>
  )
}

export const recapDimensions = { width: WIDTH, height: HEIGHT }
