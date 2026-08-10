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
  HEIGHT,
  WIDTH,
} from './theme'
import { boardTop, columnHeight, columnX, type Timeline } from './timeline'
import type { RecapData } from './types'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const ease = { easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

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
        {(['good', 'bad', 'ideas', 'actions'] as const).map((column) => (
          <ColumnFrame
            key={column}
            column={column}
            dimmed={column === 'actions' ? 0 : spotlight * 0.72}
            count={
              column === 'actions'
                ? timeline.actions.filter((a) => frame >= a.appear).length
                : timeline.cards.filter((c) => c.card.column === column && frame >= c.appear).length
            }
          />
        ))}

        {timeline.groups.map((group) => (
          <GroupBlockView key={group.id} group={group} timeline={timeline} dim={spotlight * 0.72} />
        ))}

        {timeline.cards.map((track) => (
          <CardView key={track.card.id} track={track} timeline={timeline} dim={spotlight * 0.72} />
        ))}

        {timeline.actions.map((action) => (
          <ActionView key={action.id} action={action} />
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
        {data.participants.map((name, index) => {
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
                zIndex: data.participants.length - index,
              }}
            >
              {name.slice(0, 1).toUpperCase()}
            </div>
          )
        })}
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
  dimmed,
}: {
  column: keyof typeof columns
  count: number
  dimmed: number
}) {
  const meta = columns[column]
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
        <span style={{ marginLeft: 'auto', fontSize: 18, color: meta.ink, opacity: 0.6 }}>{count}</span>
      </div>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#0b1020', opacity: dimmed * 0.55 }} />
    </div>
  )
}

/* ------------------------------------------------------------------- cards */

function useCardGeometry(track: Timeline['cards'][number], timeline: Timeline) {
  const frame = useCurrentFrame()
  const { rankFrom, rankTo, groupFrom, groupTo } = timeline.marks

  const toRanked = interpolate(frame, [rankFrom, rankTo], [0, 1], ease)
  const toGrouped = interpolate(frame, [groupFrom, groupTo], [0, 1], ease)

  const pick = (key: 'x' | 'y' | 'height') =>
    lerp(
      lerp(track.chronological[key], track.ranked[key], toRanked),
      track.grouped[key],
      toGrouped,
    )

  return { x: pick('x'), y: pick('y'), height: pick('height'), inGroup: toGrouped }
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
  const { card } = track
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
        transform: `translateY(${(1 - entry) * 26}px) scale(${0.94 + entry * 0.06})`,
      }}
    >
      <div
        style={{
          height: '100%',
          boxSizing: 'border-box',
          padding: `${layout.cardPaddingY}px ${layout.cardPaddingX}px`,
          backgroundColor: palette.surface,
          borderRadius: grouped ? 0 : 14,
          border: grouped ? 'none' : `1px solid ${palette.border}`,
          borderTop: grouped ? `1px solid ${palette.border}` : undefined,
          boxShadow: grouped ? 'none' : '0 1px 2px rgba(16,24,40,0.06)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {hidden ? (
          <HiddenCardBody />
        ) : (
          <div style={{ opacity: card.own ? 1 : revealProgress }}>
            <div style={{ fontSize: 22, lineHeight: `${layout.cardLineHeight}px`, color: palette.foreground }}>
              {card.text}
            </div>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {!hidden && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: card.own ? 1 : revealProgress }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 999,
                border: `1px solid ${votes > 0 ? '#c7dbff' : palette.border}`,
                backgroundColor: votes > 0 ? '#eef4ff' : palette.background,
                transform: `scale(${1 + voteBump * 0.12 * (card.votes > 0 ? 1 : 0)})`,
              }}
            >
              <span style={{ fontSize: 18 }}>👍</span>
              <span style={{ fontSize: 19, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {votes}
              </span>
            </div>
            <Reactions card={card} at={track.reactAt} />
          </div>
        )}
      </div>
    </div>
  )
}

function HiddenCardBody() {
  const frame = useCurrentFrame()
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: '100%',
        color: palette.muted,
        fontSize: 19,
      }}
    >
      <span style={{ fontSize: 22, opacity: 0.5 + 0.3 * Math.abs(Math.sin(frame / 14)) }}>🙈</span>
      <span>Oculto enquanto o timer roda</span>
    </div>
  )
}

function Reactions({ card, at }: { card: Timeline['cards'][number]['card']; at: number }) {
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
              gap: 6,
              padding: '5px 11px',
              borderRadius: 999,
              backgroundColor: palette.background,
              border: `1px solid ${palette.border}`,
              fontSize: 17,
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
  const { groupFrom, groupTo } = timeline.marks
  const appear = interpolate(frame, [groupFrom, groupTo], [0, 1], ease)
  if (appear <= 0.01) return null

  const { placement } = group
  const accent = columns[group.column].accent

  return (
    <div
      style={{
        position: 'absolute',
        left: placement.x,
        top: placement.y,
        width: placement.width,
        height: placement.height,
        opacity: appear * (1 - dim * 0.75),
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
          border: `1px solid ${palette.border}`,
          boxShadow: '0 6px 20px rgba(16,24,40,0.08)',
        }}
      >
        <div style={{ position: 'absolute', inset: '0 auto 0 0', width: 6, backgroundColor: accent }} />
        <div
          style={{
            height: layout.groupHeaderHeight,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 18px 0 24px',
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 700 }}>{group.label || 'Sem nome'}</span>
          <span style={{ marginLeft: 'auto', fontSize: 17, color: palette.muted }}>
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
        padding: `${layout.cardPaddingY}px ${layout.cardPaddingX}px`,
        backgroundColor: palette.surface,
        borderRadius: 14,
        border: `1px solid ${palette.border}`,
        borderLeft: `4px solid ${columns.actions.accent}`,
        boxShadow: `0 ${8 * entry}px ${26 * entry}px rgba(45,110,237,${0.18 * entry})`,
        opacity: entry,
        transform: `translateX(${(1 - entry) * 30}px)`,
        color: palette.foreground,
        fontSize: 22,
        lineHeight: `${layout.cardLineHeight}px`,
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

  // O traço destaca o card mais votado — o mesmo gesto que alguém faria ao vivo.
  const highlight = [...timeline.cards].sort((a, b) => b.card.votes - a.card.votes)[0]
  if (!highlight) return null

  const target = timeline.hasGroups ? highlight.grouped : highlight.ranked
  const loop = handDrawnLoop(target.x, target.y, target.width, target.height)

  const arrowFromX = target.x + target.width + 34
  const arrowFromY = target.y + target.height / 2
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
      </svg>
    </AbsoluteFill>
  )
}
