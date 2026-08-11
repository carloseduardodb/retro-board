/**
 * O board renderizado como cena de vídeo.
 *
 * Todo o estado visual é derivado do frame atual + da linha do tempo
 * (`remotion/timeline.ts`). Nenhum componente aqui guarda estado próprio, o que
 * garante que scrubbar o vídeo pelo scroll dê exatamente o mesmo resultado que
 * assisti-lo do início.
 */

import React from 'react'
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

import {
  columns,
  columnWidth,
  font,
  layout,
  palette,
  participantColor,
  type RecapColumn,
  HEIGHT,
  WIDTH,
} from './theme'
import {
  boardTop,
  columnHeight,
  columnInnerHeight,
  columnInnerTop,
  columnPan,
  columnX,
  type CardMetrics,
  type Timeline,
} from './timeline'
import type { RecapData } from './types'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const ease = { easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

const BOARD_COLUMNS = ['good', 'bad', 'ideas', 'actions'] as const
/** Avatares desenhados no cabeçalho antes de o excedente virar um chip. */
const AVATARS = 6

type StageProps = {
  data: RecapData
  timeline: Timeline
}

export function Stage({ data, timeline }: StageProps) {
  const frame = useCurrentFrame()
  const spotlight = interpolate(
    frame,
    [timeline.marks.spotlightFrom, timeline.marks.spotlightFrom + 30],
    [0, 1],
    ease,
  )

  return (
    <AbsoluteFill
      style={{ backgroundColor: palette.background, fontFamily: font, color: palette.foreground }}
    >
      <BoardHeader data={data} timeline={timeline} />

      <AbsoluteFill>
        {BOARD_COLUMNS.map((column) => (
          <ColumnFrame
            key={column}
            column={column}
            dimmed={column === 'actions' ? 0 : spotlight * 0.72}
            count={
              column === 'actions'
                ? timeline.actions.filter((a) => frame >= a.appear).length
                : timeline.cards.filter((c) => c.card.column === column && frame >= c.appear).length
            }
            omitted={column === 'actions' ? timeline.omittedActions : timeline.omitted[column]}
          />
        ))}

        {BOARD_COLUMNS.map((column) => (
          <ColumnContent
            key={column}
            column={column}
            timeline={timeline}
            dim={column === 'actions' ? 0 : spotlight * 0.72}
          />
        ))}
      </AbsoluteFill>

      <Scribbles timeline={timeline} />
    </AbsoluteFill>
  )
}

/* ------------------------------------------------------------------ header */

function BoardHeader({ data, timeline }: StageProps) {
  const frame = useCurrentFrame()
  const write = timeline.scene('write')
  const { revealAt } = timeline.marks

  const total = data.timerMinutes * 60
  const elapsed = interpolate(frame, [write.from, revealAt], [0, 92], ease)
  const remaining = Math.max(0, Math.round(total - (total * elapsed) / 100))
  const running = frame >= write.from && frame < revealAt
  const clock = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`

  return (
    <div
      style={{
        position: 'absolute',
        inset: `0 0 auto 0`,
        height: layout.headerHeight,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: `0 ${layout.boardPadding}px`,
        backgroundColor: palette.surface,
        borderBottom: `1px solid ${palette.border}`,
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>Retro Board</div>
      <Pill>
        <span style={{ color: palette.muted }}>sessão</span>
        <span style={{ fontWeight: 700, letterSpacing: 2 }}>{data.token}</span>
      </Pill>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center' }}>
        {data.participants.slice(0, AVATARS).map((name, index) => {
          const appear = spring({
            frame: frame - 18 - index * 6,
            fps: 30,
            config: { damping: 14, mass: 0.5 },
          })
          return (
            <div
              key={name}
              title={name}
              style={{
                width: 44,
                height: 44,
                marginLeft: index === 0 ? 0 : -12,
                borderRadius: '50%',
                backgroundColor: participantColor(name),
                border: `3px solid ${palette.surface}`,
                color: '#fff',
                fontSize: 17,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${appear})`,
                zIndex: AVATARS - index,
              }}
            >
              {name.slice(0, 1).toUpperCase()}
            </div>
          )
        })}
        {/* Só cabem alguns avatares; o excedente vira um chip para o número
            exibido continuar sendo o número real de quem entrou. */}
        {data.participants.length > AVATARS && (
          <div
            style={{
              width: 44,
              height: 44,
              marginLeft: -12,
              borderRadius: '50%',
              backgroundColor: palette.background,
              border: `3px solid ${palette.surface}`,
              color: palette.muted,
              fontSize: 16,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            +{data.participants.length - AVATARS}
          </div>
        )}
        <span style={{ marginLeft: 12, color: palette.muted, fontSize: 18 }}>
          {data.participants.length} online
        </span>
      </div>

      <Pill
        style={{
          backgroundColor: running ? '#eef4ff' : palette.background,
          borderColor: running ? '#c7dbff' : palette.border,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: running ? palette.primary : palette.muted,
            opacity: running ? 0.4 + 0.6 * Math.abs(Math.sin(frame / 9)) : 0.4,
          }}
        />
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 22 }}>{clock}</span>
      </Pill>
    </div>
  )
}

function Pill({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        borderRadius: 999,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.background,
        fontSize: 18,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/* ----------------------------------------------------------------- colunas */

function ColumnFrame({
  column,
  count,
  omitted,
  dimmed,
}: {
  column: RecapColumn
  count: number
  omitted: number
  dimmed: number
}) {
  const meta = columns[column]
  const label = column === 'actions' ? 'ações' : 'cards'
  return (
    <div
      style={{
        position: 'absolute',
        left: columnX(column),
        top: boardTop,
        width: columnWidth,
        height: columnHeight,
        borderRadius: 20,
        backgroundColor: meta.tint,
        border: `1px solid ${palette.border}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: layout.columnHeaderHeight,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 20px',
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: meta.accent }} />
        <span style={{ fontSize: 21, fontWeight: 700, color: meta.ink }}>{meta.title}</span>
        {/* Com corte, o contador diz quantos de quantos — mostrar só os exibidos
            faria o vídeo declarar 4 num board de 7. */}
        <span style={{ marginLeft: 'auto', fontSize: 18, color: meta.ink, opacity: 0.6 }}>
          {omitted > 0 ? `${count} de ${count + omitted} ${label}` : count}
        </span>
      </div>

      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#0b1020', opacity: dimmed * 0.55 }} />
    </div>
  )
}

/**
 * Conteúdo de uma coluna dentro de uma janela recortada.
 *
 * É esse recorte que permite a coluna guardar mais card do que cabe em tela: o
 * conteúdo é maior que a janela e desliza (`columnPan`) na cena de varredura, em
 * vez de o card excedente ser jogado fora.
 */
function ColumnContent({
  column,
  timeline,
  dim,
}: {
  column: RecapColumn
  timeline: Timeline
  dim: number
}) {
  const frame = useCurrentFrame()
  const pan = columnPan(timeline, column, frame)
  const scrolls = timeline.fit[column].scroll > 0

  const left = columnX(column)
  const top = columnInnerTop

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: columnWidth,
        height: columnInnerHeight,
        overflow: 'hidden',
        // Bordas esfumadas: sinalizam que a coluna continua além da janela.
        WebkitMaskImage: scrolls
          ? 'linear-gradient(to bottom, transparent 0, #000 26px, #000 calc(100% - 26px), transparent 100%)'
          : undefined,
      }}
    >
      {/* Os filhos usam coordenadas globais do frame; esta camada as traz para
          dentro da janela recortada e aplica a panorâmica. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${-left}px, ${-top - pan}px)`,
        }}
      >
        {column === 'actions'
          ? timeline.actions.map((action) => <ActionView key={action.id} action={action} />)
          : (
              <>
                {timeline.groups
                  .filter((group) => group.column === column)
                  .map((group) => (
                    <GroupBlockView key={group.id} group={group} timeline={timeline} dim={dim} />
                  ))}
                {timeline.cards
                  .filter((track) => track.card.column === column)
                  .map((track) => (
                    <CardView key={track.card.id} track={track} timeline={timeline} dim={dim} />
                  ))}
              </>
            )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- cards */

/**
 * Posição do card no frame atual, entre os três layouts (cronológico, ordenado
 * por votos, agrupado).
 *
 * A reordenação sai escalonada: o card mais votado se move primeiro e os outros
 * seguem em cascata. Um board inteiro trocando de lugar no mesmo frame lê como
 * glitch; em cascata lê como o board se organizando sozinho.
 */
function useCardGeometry(track: Timeline['cards'][number], timeline: Timeline) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { rankFrom, rankTo, groupFrom, groupTo } = timeline.marks

  const stagger = track.columnRank * 3
  const toRanked = interpolate(frame, [rankFrom + stagger, rankTo + stagger], [0, 1], ease)
  // Encaixe com overshoot: o card "assenta" no bloco em vez de escorregar até ele.
  const toGrouped = track.card.groupId
    ? spring({
        frame: frame - groupFrom - stagger,
        fps,
        durationInFrames: Math.max(12, groupTo - groupFrom + 20),
        config: { damping: 13, mass: 0.7 },
      })
    : interpolate(frame, [groupFrom, groupTo], [0, 1], ease)

  const pick = (key: 'x' | 'y' | 'height') =>
    lerp(
      lerp(track.chronological[key], track.ranked[key], toRanked),
      track.grouped[key],
      toGrouped,
    )

  // Quanto o card está em trânsito agora — alimenta a inclinação e o relevo.
  const moving = Math.sin(Math.PI * toRanked) * (track.ranked.y === track.chronological.y ? 0 : 1)
  const direction = Math.sign(track.ranked.y - track.chronological.y) || 1

  return {
    x: pick('x'),
    y: pick('y'),
    height: pick('height'),
    inGroup: toGrouped,
    moving,
    tilt: -direction * moving * 1.6,
  }
}

function CardView({
  track,
  timeline,
  dim,
}: {
  track: Timeline['cards'][number]
  timeline: Timeline
  dim: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { card, metrics } = track
  const geometry = useCardGeometry(track, timeline)

  const entry = spring({ frame: frame - track.appear, fps, config: { damping: 15, mass: 0.6 } })
  if (frame < track.appear) return null

  const hidden = !card.own && frame < timeline.marks.revealAt
  const revealProgress = interpolate(
    frame,
    [timeline.marks.revealAt, timeline.marks.revealAt + 18],
    [0, 1],
    ease,
  )

  const votes = Math.round(
    interpolate(frame, [track.voteAt, track.voteAt + 18], [0, card.votes], ease),
  )
  const voteBump = spring({ frame: frame - track.voteAt, fps, config: { damping: 9, mass: 0.4 } })
  const grouped = geometry.inGroup > 0.5 && card.groupId

  return (
    <div
      style={{
        position: 'absolute',
        left: geometry.x,
        top: geometry.y,
        width: track.chronological.width,
        height: geometry.height,
        opacity: entry * (1 - dim * 0.75),
        // Em trânsito o card sobe um pouco e inclina para o lado que está indo.
        transform:
          `translateY(${(1 - entry) * 26}px)` +
          ` rotate(${geometry.tilt}deg)` +
          ` scale(${(0.94 + entry * 0.06) * (1 + geometry.moving * 0.035)})`,
        zIndex: geometry.moving > 0.05 ? 10 : 1,
      }}
    >
      <div
        style={{
          height: '100%',
          boxSizing: 'border-box',
          padding: `${metrics.paddingY}px ${metrics.paddingX}px`,
          backgroundColor: palette.surface,
          borderRadius: grouped ? 0 : metrics.radius,
          border: grouped ? 'none' : `1px solid ${palette.border}`,
          borderTop: grouped ? `1px solid ${palette.border}` : undefined,
          boxShadow: grouped
            ? 'none'
            : `0 ${1 + geometry.moving * 16}px ${2 + geometry.moving * 34}px rgba(16,24,40,${0.06 + geometry.moving * 0.14})`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {hidden ? (
          <HiddenCardBody metrics={metrics} />
        ) : (
          <div style={{ opacity: card.own ? 1 : revealProgress }}>
            <div
              style={{
                fontSize: metrics.fontSize,
                lineHeight: `${metrics.lineHeight}px`,
                color: palette.foreground,
              }}
            >
              {card.text}
            </div>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {!hidden && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: Math.round(10 * metrics.density),
              opacity: card.own ? 1 : revealProgress,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: Math.round(8 * metrics.density),
                padding: `${Math.round(6 * metrics.density)}px ${Math.round(14 * metrics.density)}px`,
                borderRadius: 999,
                border: `1px solid ${votes > 0 ? '#c7dbff' : palette.border}`,
                backgroundColor: votes > 0 ? '#eef4ff' : palette.background,
                transform: `scale(${1 + voteBump * 0.12 * (card.votes > 0 ? 1 : 0)})`,
              }}
            >
              <span style={{ fontSize: metrics.fontSize - 4 }}>👍</span>
              <span
                style={{
                  fontSize: metrics.fontSize - 3,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {votes}
              </span>
            </div>
            <Reactions card={card} at={track.reactAt} metrics={metrics} />
          </div>
        )}
      </div>
    </div>
  )
}

function HiddenCardBody({ metrics }: { metrics: CardMetrics }) {
  const frame = useCurrentFrame()
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: '100%',
        color: palette.muted,
        fontSize: metrics.fontSize - 3,
      }}
    >
      <span style={{ fontSize: metrics.fontSize, opacity: 0.5 + 0.3 * Math.abs(Math.sin(frame / 14)) }}>
        🙈
      </span>
      <span>Oculto enquanto o timer roda</span>
    </div>
  )
}

function Reactions({
  card,
  at,
  metrics,
}: {
  card: Timeline['cards'][number]['card']
  at: number
  metrics: CardMetrics
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const entries = Object.entries(card.reactions).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {entries.map(([emoji, count], index) => {
        const pop = spring({ frame: frame - at - index * 5, fps, config: { damping: 10, mass: 0.4 } })
        return (
          <div
            key={emoji}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: Math.round(6 * metrics.density),
              padding: `${Math.round(5 * metrics.density)}px ${Math.round(11 * metrics.density)}px`,
              borderRadius: 999,
              backgroundColor: palette.background,
              border: `1px solid ${palette.border}`,
              fontSize: metrics.fontSize - 5,
              transform: `scale(${pop})`,
            }}
          >
            <span>{emoji}</span>
            <span style={{ color: palette.muted, fontWeight: 600 }}>{count}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ grupos */

function GroupBlockView({
  group,
  timeline,
  dim,
}: {
  group: Timeline['groups'][number]
  timeline: Timeline
  dim: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { groupFrom, groupTo } = timeline.marks
  const appear = interpolate(frame, [groupFrom, groupTo], [0, 1], ease)
  if (appear <= 0.01) return null

  const { placement, metrics } = group
  const accent = columns[group.column].accent
  // O bloco fecha com um baque: os cards encaixam e a borda pulsa uma vez.
  const snap = spring({
    frame: frame - groupTo,
    fps,
    config: { damping: 11, mass: 0.5 },
  })
  const flash = interpolate(frame, [groupTo, groupTo + 22], [1, 0], ease)

  return (
    <div
      style={{
        position: 'absolute',
        left: placement.x,
        top: placement.y,
        width: placement.width,
        height: placement.height,
        opacity: appear * (1 - dim * 0.75),
        transform: `scale(${1 + snap * 0.02 * flash})`,
      }}
    >
      {/* camadas deslocadas sugerindo uma pilha de cards */}
      {[2, 1].map((depth) => (
        <div
          key={depth}
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translate(${depth * 6}px, ${depth * 6}px)`,
            borderRadius: 16,
            backgroundColor: palette.surface,
            border: `1px solid ${palette.border}`,
            opacity: 0.55 / depth,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: palette.surface,
          border: `1px solid ${flash > 0.02 ? accent : palette.border}`,
          boxShadow: `0 6px 20px rgba(16,24,40,0.08), 0 0 0 ${flash * 6}px ${accent}${Math.round(flash * 40).toString(16).padStart(2, '0')}`,
        }}
      >
        <div style={{ position: 'absolute', inset: '0 auto 0 0', width: 6, backgroundColor: accent }} />
        <div
          style={{
            height: metrics.groupHeaderHeight,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 18px 0 24px',
          }}
        >
          <span style={{ fontSize: metrics.fontSize - 2, fontWeight: 700 }}>
            {group.label || 'Sem nome'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: metrics.fontSize - 5, color: palette.muted }}>
            {group.count} cards · {group.votes} 👍
          </span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- ações */

function ActionView({ action }: { action: Timeline['actions'][number] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { metrics } = action
  const entry = spring({ frame: frame - action.appear, fps, config: { damping: 14, mass: 0.6 } })
  if (frame < action.appear) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: action.placement.x,
        top: action.placement.y,
        width: action.placement.width,
        height: action.placement.height,
        boxSizing: 'border-box',
        padding: `${metrics.paddingY}px ${metrics.paddingX}px`,
        backgroundColor: palette.surface,
        borderRadius: metrics.radius,
        border: `1px solid ${palette.border}`,
        borderLeft: `4px solid ${columns.actions.accent}`,
        boxShadow: `0 ${8 * entry}px ${26 * entry}px rgba(45,110,237,${0.18 * entry})`,
        opacity: entry,
        transform: `translateX(${(1 - entry) * 30}px)`,
        color: palette.foreground,
        fontSize: metrics.fontSize,
        lineHeight: `${metrics.lineHeight}px`,
      }}
    >
      {action.text}
    </div>
  )
}

/* --------------------------------------------------------------- rabiscos */

/**
 * Laço "à mão livre" em volta de um retângulo: um círculo com ruído senoidal no
 * raio, que é o que dá a aparência de traço humano sem depender de nenhuma lib.
 */
function handDrawnLoop(x: number, y: number, width: number, height: number): string {
  const cx = x + width / 2
  const cy = y + height / 2
  const rx = width / 2 + 22
  const ry = height / 2 + 18
  const points: string[] = []
  const turns = 1.12
  const steps = 90
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * turns - 0.6
    const wobble = 1 + Math.sin(t * 3.1) * 0.03 + Math.sin(t * 7.3) * 0.015
    points.push(`${(cx + Math.cos(t) * rx * wobble).toFixed(1)},${(cy + Math.sin(t) * ry * wobble * 1.02).toFixed(1)}`)
  }
  return `M ${points.join(' L ')}`
}

function Scribbles({ timeline }: { timeline: Timeline }) {
  const frame = useCurrentFrame()
  const draw = timeline.scene('draw')

  // Anotação do recap sobre o card mais votado. Sem votos não há o que destacar
  // e a cena nem existe (`duration: 0`) — desenhar aqui seria inventar um gesto.
  const highlight = [...timeline.cards].sort((a, b) => b.card.votes - a.card.votes)[0]
  if (draw.duration === 0 || !highlight) return null

  const target = timeline.hasGroups ? highlight.grouped : highlight.ranked
  // A coluna pode estar deslocada pela panorâmica; o laço acompanha o card.
  const pan = columnPan(timeline, highlight.card.column, frame)
  const loop = handDrawnLoop(target.x, target.y - pan, target.width, target.height)

  const arrowFromX = target.x + target.width + 34
  const arrowFromY = target.y - pan + target.height / 2
  const arrowToX = columnX('actions') + columnWidth / 2
  const arrowToY = boardTop + 120
  const arrow = `M ${arrowFromX},${arrowFromY} C ${arrowFromX + 160},${arrowFromY - 40} ${arrowToX - 180},${arrowToY + 160} ${arrowToX},${arrowToY}`

  const drawLoop = interpolate(frame, [draw.from + 10, draw.from + 60], [0, 1], ease)
  const drawArrow = interpolate(frame, [draw.from + 55, draw.from + 95], [0, 1], ease)
  // Efêmero: 6s parado, some em 2s. Aqui comprimido para a duração da cena.
  const fade = interpolate(frame, [draw.from + draw.duration - 30, draw.from + draw.duration], [1, 0], ease)
  const ink = participantColor('facilitador')

  if (frame < draw.from || fade <= 0) return null

  return (
    <AbsoluteFill>
      <svg width={WIDTH} height={HEIGHT} style={{ opacity: fade }}>
        <path
          d={loop}
          pathLength={1}
          fill="none"
          stroke={ink}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={1}
          strokeDashoffset={1 - drawLoop}
        />
        {/* A seta só existe se houver ação para apontar. */}
        {timeline.hasActions && (
          <>
            <path
              d={arrow}
              pathLength={1}
              fill="none"
              stroke={ink}
              strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray={1}
              strokeDashoffset={1 - drawArrow}
            />
            {drawArrow > 0.98 && (
              <g stroke={ink} strokeWidth={7} strokeLinecap="round" fill="none">
                <path d={`M ${arrowToX},${arrowToY} l -26,26`} />
                <path d={`M ${arrowToX},${arrowToY} l 22,28`} />
              </g>
            )}
          </>
        )}
      </svg>
    </AbsoluteFill>
  )
}
