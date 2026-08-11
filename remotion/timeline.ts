/**
 * Constrói, a partir dos dados da retro, a linha do tempo inteira do vídeo:
 * cenas, posições de cada card em cada momento e os frames em que cada beat
 * acontece (aparecer, revelar, votar, reagir, agrupar).
 *
 * Tudo aqui é função pura dos dados — nenhum componente guarda estado. Isso é o
 * que permite a mesma composição rodar com dados fictícios na landing e com
 * dados reais no recap de uma sessão, e ser scrubbada pelo scroll sem drift.
 */

import { FPS, columnWidth, cardWidth, layout, HEIGHT, WIDTH, type RecapColumn } from './theme'
import type { RecapCard, RecapData } from './types'

/**
 * Tetos de sanidade, não recorte editorial: o board cabe inteiro via densidade
 * adaptativa + panorâmica (ver `fitColumn`). Só uma sessão absurda encosta aqui,
 * e mesmo assim o vídeo declara em tela quantos ficaram de fora.
 */
export const MAX_CARDS_PER_COLUMN = 24
export const MAX_ACTIONS = 12
export const MAX_CARD_CHARS = 180

/** Abaixo disso o texto do card deixa de ser legível em tela; daí em diante, panorâmica. */
export const MIN_DENSITY = 0.62

const BOARD_COLUMNS = ['good', 'bad', 'ideas', 'actions'] as const
const CARD_COLUMNS = ['good', 'bad', 'ideas'] as const
/** Caracteres por linha na densidade cheia (fonte de 22px na largura do card). */
const CHARS_PER_LINE = 34
const BASE_FONT = 22

export const boardTop = layout.headerHeight + 28
export const columnHeight = HEIGHT - boardTop - 44
/** Área útil de uma coluna, já descontados cabeçalho e respiros. */
export const columnInnerHeight = columnHeight - layout.columnHeaderHeight - layout.columnPadding * 2
export const columnInnerTop = boardTop + layout.columnHeaderHeight + layout.columnPadding

export function columnX(column: RecapColumn): number {
  const index = BOARD_COLUMNS.indexOf(column)
  return layout.boardPadding + index * (columnWidth + layout.columnGap)
}

/* ------------------------------------------------------------- densidade */

/**
 * Métricas de um card numa dada densidade. Encolher o card é o que permite a
 * coluna caber sem jogar card fora — é a diferença entre um recap que resume a
 * retro e um que a censura.
 */
export type CardMetrics = {
  density: number
  paddingY: number
  paddingX: number
  fontSize: number
  lineHeight: number
  footerHeight: number
  reactionsHeight: number
  gap: number
  groupHeaderHeight: number
  charsPerLine: number
  radius: number
}

export function cardMetrics(density: number): CardMetrics {
  const fontSize = Math.max(15, Math.round(BASE_FONT * density))
  return {
    density,
    paddingY: Math.max(8, Math.round(layout.cardPaddingY * density)),
    paddingX: Math.max(12, Math.round(layout.cardPaddingX * density)),
    fontSize,
    lineHeight: Math.max(fontSize + 6, Math.round(layout.cardLineHeight * density)),
    footerHeight: Math.max(28, Math.round(layout.cardFooterHeight * density)),
    reactionsHeight: Math.max(24, Math.round(layout.reactionsHeight * density)),
    gap: Math.max(6, Math.round(layout.cardGap * density)),
    groupHeaderHeight: Math.max(38, Math.round(layout.groupHeaderHeight * density)),
    // A fonte encolhe mas a largura do card não: cabe mais texto por linha.
    charsPerLine: Math.floor((CHARS_PER_LINE * BASE_FONT) / fontSize),
    radius: Math.max(8, Math.round(14 * density)),
  }
}

export function cardHeight(card: Pick<RecapCard, 'text' | 'reactions'>, m: CardMetrics): number {
  const lines = Math.max(1, Math.ceil(card.text.length / m.charsPerLine))
  const reactions = Object.keys(card.reactions).length > 0 ? m.reactionsHeight : 0
  return m.paddingY * 2 + lines * m.lineHeight + m.footerHeight + reactions
}

export function actionHeight(text: string, m: CardMetrics): number {
  const lines = Math.max(1, Math.ceil(text.length / m.charsPerLine))
  return m.paddingY * 2 + lines * m.lineHeight
}

/** Quanto uma coluna ocupa numa densidade, no modo mais alto entre solto e agrupado. */
function measureColumn(cards: RecapCard[], m: CardMetrics): number {
  const loose = cards.reduce((sum, c) => sum + cardHeight(c, m) + m.gap, 0)
  const groups = new Set(cards.map((c) => c.groupId).filter(Boolean) as string[])
  // Agrupar tira um gap por membro extra e acrescenta um cabeçalho por grupo.
  const grouped = groups.size === 0 ? loose : loose + groups.size * m.groupHeaderHeight
  return Math.max(loose, grouped)
}

export type ColumnFit = {
  metrics: CardMetrics
  contentHeight: number
  /** Quanto a coluna precisa deslizar para mostrar o resto do conteúdo. */
  scroll: number
}

function fitColumn(measure: (m: CardMetrics) => number): ColumnFit {
  let metrics = cardMetrics(1)
  for (let step = 100; step >= MIN_DENSITY * 100; step -= 2) {
    metrics = cardMetrics(step / 100)
    if (measure(metrics) <= columnInnerHeight) break
  }
  const contentHeight = measure(metrics)
  return { metrics, contentHeight, scroll: Math.max(0, contentHeight - columnInnerHeight) }
}

/* --------------------------------------------------------------- layout */

export type Placement = { x: number; y: number; width: number; height: number }

export type GroupBlock = {
  id: string
  label: string | null
  column: RecapCard['column']
  votes: number
  count: number
  metrics: CardMetrics
  placement: Placement
}

export type CardTrack = {
  card: RecapCard
  /** Frame em que o card entra no board. */
  appear: number
  /** Frame em que o voto final sobe (contagem animada). */
  voteAt: number
  /** Frame em que as reações estouram. */
  reactAt: number
  /** Posição no ranking geral por votos — cascata da contagem de votos. */
  rankIndex: number
  /** Posição no ranking dentro da própria coluna — atraso na reordenação. */
  columnRank: number
  metrics: CardMetrics
  /** Posição cronológica, ordenada por votos e já dentro do grupo. */
  chronological: Placement
  ranked: Placement
  grouped: Placement
}

export type ActionTrack = {
  id: string
  text: string
  appear: number
  metrics: CardMetrics
  placement: Placement
}

export type Scene = {
  id:
    | 'intro'
    | 'write'
    | 'reveal'
    | 'tour'
    | 'vote'
    | 'group'
    | 'draw'
    | 'highlights'
    | 'actions'
    | 'outro'
  from: number
  duration: number
  title: string
  subtitle: string
}

export type RecapStats = {
  cards: number
  votes: number
  reactions: number
  actions: number
  participants: number
  groups: number
}

export type Timeline = {
  scenes: Scene[]
  scene: (id: Scene['id']) => Scene
  cards: CardTrack[]
  groups: GroupBlock[]
  actions: ActionTrack[]
  /** Cards em destaque na cena de tela cheia, do mais votado para baixo. */
  highlights: CardTrack[]
  fit: Record<RecapColumn, ColumnFit>
  marks: {
    revealAt: number
    rankFrom: number
    rankTo: number
    groupFrom: number
    groupTo: number
    /** Janela da panorâmica das colunas de cards. */
    tourFrom: number
    tourTo: number
    /** Janela da panorâmica da coluna de ações. */
    actionsPanFrom: number
    actionsPanTo: number
    /** Frame a partir do qual o board escurece para destacar as ações. */
    spotlightFrom: number
  }
  hasGroups: boolean
  hasVotes: boolean
  hasActions: boolean
  /** Alguma coluna não coube inteira em tela e ganha panorâmica. */
  needsTour: boolean
  stats: RecapStats
  /** Cards que não couberam em cada coluna — declarados em tela. */
  omitted: Record<'good' | 'bad' | 'ideas', number>
  omittedActions: number
  durationInFrames: number
}

type LayoutMode = { rank: boolean; group: boolean }

function sortChronological(a: RecapCard, b: RecapCard) {
  return b.createdAt.localeCompare(a.createdAt)
}

/**
 * Posiciona todos os cards de todas as colunas para um dado modo de layout.
 * `rank` ordena por votos (como o board faz de verdade); `group` transforma
 * cards com o mesmo `groupId` num bloco único.
 */
function computeLayout(
  cards: RecapCard[],
  mode: LayoutMode,
  fit: Record<RecapColumn, ColumnFit>,
): {
  placements: Record<string, Placement>
  groups: GroupBlock[]
} {
  const placements: Record<string, Placement> = {}
  const groups: GroupBlock[] = []

  for (const column of CARD_COLUMNS) {
    const m = fit[column].metrics
    const columnCards = cards.filter((c) => c.column === column)
    const x = columnX(column) + layout.columnPadding
    let y = columnInnerTop

    // Itens da coluna: cards soltos e (quando agrupando) blocos de grupo.
    type Item =
      | { kind: 'card'; card: RecapCard; votes: number; createdAt: string; height: number }
      | {
          kind: 'group'
          id: string
          label: string | null
          cards: RecapCard[]
          votes: number
          createdAt: string
          height: number
        }

    const items: Item[] = []
    const seenGroups = new Set<string>()

    for (const card of columnCards) {
      if (mode.group && card.groupId) {
        if (seenGroups.has(card.groupId)) continue
        seenGroups.add(card.groupId)
        const members = columnCards
          .filter((c) => c.groupId === card.groupId)
          .sort((a, b) => b.votes - a.votes || sortChronological(a, b))
        items.push({
          kind: 'group',
          id: card.groupId,
          label: card.groupLabel,
          cards: members,
          votes: members.reduce((sum, c) => sum + c.votes, 0),
          createdAt: members.reduce((max, c) => (c.createdAt > max ? c.createdAt : max), ''),
          height: m.groupHeaderHeight + members.reduce((sum, c) => sum + cardHeight(c, m), 0),
        })
        continue
      }
      items.push({
        kind: 'card',
        card,
        votes: card.votes,
        createdAt: card.createdAt,
        height: cardHeight(card, m),
      })
    }

    items.sort((a, b) =>
      mode.rank
        ? b.votes - a.votes || b.createdAt.localeCompare(a.createdAt)
        : b.createdAt.localeCompare(a.createdAt),
    )

    for (const item of items) {
      if (item.kind === 'card') {
        placements[item.card.id] = { x, y, width: cardWidth, height: item.height }
      } else {
        groups.push({
          id: item.id,
          label: item.label,
          column,
          votes: item.votes,
          count: item.cards.length,
          metrics: m,
          placement: { x, y, width: cardWidth, height: item.height },
        })
        let innerY = y + m.groupHeaderHeight
        for (const member of item.cards) {
          const height = cardHeight(member, m)
          placements[member.id] = { x, y: innerY, width: cardWidth, height }
          innerY += height
        }
      }
      y += item.height + m.gap
    }
  }

  return { placements, groups }
}

export type TrimResult = {
  data: RecapData
  /** Quantos cards de cada coluna não couberam — o vídeo declara isso em tela. */
  omitted: Record<'good' | 'bad' | 'ideas', number>
  omittedActions: number
}

/**
 * Recorta os dados ao teto de sanidade e **devolve o que ficou de fora**.
 * Cortar em silêncio faria o vídeo mostrar 4 cards com o contador da coluna
 * dizendo 4, enquanto o board tem 7 — o recap mentiria sobre a própria retro.
 */
export function trimData(data: RecapData): TrimResult {
  const cards: RecapCard[] = []
  const omitted = { good: 0, bad: 0, ideas: 0 }
  for (const column of CARD_COLUMNS) {
    const all = data.cards
      .filter((c) => c.column === column)
      .sort((a, b) => b.votes - a.votes || sortChronological(a, b))
    omitted[column] = Math.max(0, all.length - MAX_CARDS_PER_COLUMN)
    cards.push(...all.slice(0, MAX_CARDS_PER_COLUMN))
  }
  // Grupos que perderam membros no corte deixam de ser grupos.
  const groupCounts = new Map<string, number>()
  for (const card of cards) {
    if (card.groupId) groupCounts.set(card.groupId, (groupCounts.get(card.groupId) ?? 0) + 1)
  }
  const trimmed = cards.map((card) => ({
    ...card,
    text: clamp(card.text),
    groupId: card.groupId && (groupCounts.get(card.groupId) ?? 0) > 1 ? card.groupId : null,
    groupLabel: card.groupId && (groupCounts.get(card.groupId) ?? 0) > 1 ? card.groupLabel : null,
  }))

  return {
    data: {
      ...data,
      cards: trimmed,
      actions: data.actions.slice(0, MAX_ACTIONS).map((action) => ({
        ...action,
        text: clamp(action.text),
      })),
    },
    omitted,
    omittedActions: Math.max(0, data.actions.length - MAX_ACTIONS),
  }
}

const clamp = (text: string) =>
  text.length > MAX_CARD_CHARS ? `${text.slice(0, MAX_CARD_CHARS - 1).trimEnd()}…` : text

/* ------------------------------------------------------------- timeline */

export function buildTimeline(raw: RecapData): Timeline {
  const { data, omitted, omittedActions } = trimData(raw)
  const cards = data.cards

  // Cada cena só entra se a retro tiver o que ela narra. Sem isso o vídeo
  // anuncia "votos reordenam o board" sobre cards zerados, ou circula um card
  // "mais votado" que ninguém votou.
  const hasGroups = cards.some((c) => c.groupId)
  const hasVotes = cards.some((c) => c.votes > 0)
  const hasReactions = cards.some((c) => Object.keys(c.reactions).length > 0)
  const hasEngagement = hasVotes || hasReactions
  const hasActions = data.actions.length > 0

  // Cada coluna encolhe o quanto precisar para caber; o que sobrar vira panorâmica.
  const fit = {
    good: fitColumn((m) => measureColumn(cards.filter((c) => c.column === 'good'), m)),
    bad: fitColumn((m) => measureColumn(cards.filter((c) => c.column === 'bad'), m)),
    ideas: fitColumn((m) => measureColumn(cards.filter((c) => c.column === 'ideas'), m)),
    actions: fitColumn((m) =>
      data.actions.reduce((sum, a) => sum + actionHeight(a.text, m) + m.gap, 0),
    ),
  } satisfies Record<RecapColumn, ColumnFit>

  const cardScroll = Math.max(fit.good.scroll, fit.bad.scroll, fit.ideas.scroll)
  const needsTour = cardScroll > 0

  const chronological = computeLayout(cards, { rank: false, group: false }, fit)
  const ranked = computeLayout(cards, { rank: true, group: false }, fit)
  const grouped = computeLayout(cards, { rank: true, group: true }, fit)

  const scenes: Scene[] = []
  let cursor = 0
  const push = (scene: Omit<Scene, 'from'>) => {
    scenes.push({ ...scene, from: cursor })
    cursor += scene.duration
    return scenes[scenes.length - 1]
  }

  // Ritmo proporcional ao volume: uma retro de 30 cards não pode ter o mesmo
  // tempo de escrita de uma de 5, senão os cards entram atropelados.
  const writeStep = cards.length > 14 ? 4 : 7
  const writeDuration = 70 + cards.length * writeStep
  const voteStep = cards.length > 14 ? 4 : 6
  const voteDuration = 60 + cards.length * voteStep + 50
  const tourDuration = needsTour ? Math.round(110 + Math.min(cardScroll, 1400) * 0.16) : 0

  const highlights = hasVotes
    ? cards
        .filter((c) => c.votes > 0)
        .sort((a, b) => b.votes - a.votes || sortChronological(a, b))
        .slice(0, 3)
    : []
  const highlightsDuration = highlights.length > 1 ? 40 + highlights.length * 78 : 0

  push({
    id: 'intro',
    duration: 110,
    title: 'Um link. Nada de cadastro.',
    subtitle: `Sessão ${data.token} · ${data.participants.length} pessoas entraram`,
  })
  const write = push({
    id: 'write',
    duration: writeDuration,
    title: 'Todo mundo escreve ao mesmo tempo',
    subtitle: `Timer de ${data.timerMinutes} min rodando — os cards dos outros ficam ocultos`,
  })
  const reveal = push({
    id: 'reveal',
    duration: 80,
    title: 'O timer para. Tudo aparece de uma vez.',
    subtitle: 'Ninguém ancora a opinião do time no que já estava escrito',
  })
  // A varredura existe justamente para o recap não deixar card de fora: a
  // coluna que não coube em tela desliza inteira, do topo ao último card.
  const tour = push({
    id: 'tour',
    duration: tourDuration,
    title: `Os ${cards.length} cards da retro, sem corte`,
    subtitle: 'O board desce inteiro — nenhum card fica fora do recap',
  })
  const vote = push({
    id: 'vote',
    duration: hasEngagement ? voteDuration : 0,
    title: hasVotes ? 'Votos e reações reordenam o board' : 'As reações do time',
    subtitle: hasVotes
      ? 'O que importa para o time sobe sozinho'
      : 'Reagir não muda a ordem — só marca o que ressoou',
  })
  const group = push({
    id: 'group',
    duration: hasGroups ? 100 : 0,
    title: 'Temas repetidos viram um bloco só',
    subtitle: 'Arraste um card sobre o outro e os votos somam',
  })
  // O destaque é uma anotação do próprio recap, não a reprodução de um rabisco:
  // os traços do modo desenho são efêmeros e nunca chegam ao banco.
  push({
    id: 'draw',
    duration: hasVotes ? 130 : 0,
    title: 'O card que mais pesou',
    subtitle: hasActions
      ? 'O recap circula o mais votado e aponta para o que virou ação'
      : 'O recap circula o card mais votado da retro',
  })
  push({
    id: 'highlights',
    duration: highlightsDuration,
    title: 'O que o time mais votou',
    subtitle: 'Card a card, em tamanho de leitura',
  })
  const actionsScene = push({
    id: 'actions',
    duration: hasActions ? 90 + data.actions.length * 16 + 70 : 0,
    title: 'A retro termina em ações',
    subtitle: 'Elas voltam marcadas na próxima sprint',
  })
  push({
    id: 'outro',
    duration: 150,
    title: 'A retro cabe em um link',
    subtitle: 'Crie a sessão, mande o código, rode o timer',
  })

  const appearBase = write.from + 30
  const byCreation = [...cards].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const byVotes = [...cards].sort((a, b) => b.votes - a.votes || sortChronological(a, b))
  // O atraso da reordenação é por coluna: as três se reorganizam em paralelo. Um
  // atraso global faria o último card de um board grande partir depois de a
  // animação dos primeiros já ter acabado.
  const byVotesInColumn = new Map(
    CARD_COLUMNS.map((column) => [column, byVotes.filter((c) => c.column === column)]),
  )

  const revealAt = reveal.from + 24
  // Sem votos a ordenação final é igual à cronológica; a janela existe só para
  // `interpolate` não receber um intervalo degenerado.
  const rankFrom = hasEngagement ? vote.from + 40 + cards.length * voteStep : vote.from
  const rankTo = rankFrom + (hasEngagement ? 30 : 1)
  const groupFrom = hasGroups ? group.from + 20 : rankTo
  // Sem grupos o layout final é igual ao ordenado, mas a janela precisa ter
  // largura > 0: `interpolate` rejeita um intervalo degenerado.
  const groupTo = groupFrom + (hasGroups ? 45 : 1)

  const tracks: CardTrack[] = cards.map((card) => {
    const rankIndex = byVotes.findIndex((c) => c.id === card.id)
    const columnRank = byVotesInColumn.get(card.column)!.findIndex((c) => c.id === card.id)
    return {
      card,
      appear: appearBase + byCreation.findIndex((c) => c.id === card.id) * writeStep,
      voteAt: vote.from + 30 + rankIndex * voteStep,
      reactAt: vote.from + 46 + rankIndex * voteStep,
      rankIndex,
      columnRank,
      metrics: fit[card.column].metrics,
      chronological: chronological.placements[card.id],
      ranked: ranked.placements[card.id],
      grouped: grouped.placements[card.id],
    }
  })

  const actionMetrics = fit.actions.metrics
  const actionsX = columnX('actions') + layout.columnPadding
  let actionY = columnInnerTop
  const actionTracks: ActionTrack[] = data.actions.map((action, index) => {
    const height = actionHeight(action.text, actionMetrics)
    const placement = { x: actionsX, y: actionY, width: cardWidth, height }
    actionY += height + actionMetrics.gap
    return {
      ...action,
      appear: actionsScene.from + 60 + index * 16,
      metrics: actionMetrics,
      placement,
    }
  })

  const highlightTracks = highlights
    .map((card) => tracks.find((t) => t.card.id === card.id)!)
    .filter(Boolean)

  return {
    scenes,
    scene: (id) => scenes.find((s) => s.id === id)!,
    cards: tracks,
    groups: grouped.groups,
    actions: actionTracks,
    highlights: highlightTracks,
    fit,
    marks: {
      revealAt,
      rankFrom,
      rankTo,
      groupFrom,
      groupTo,
      tourFrom: needsTour ? tour.from + 12 : cursor + 60,
      tourTo: needsTour ? tour.from + tour.duration - 6 : cursor + 61,
      actionsPanFrom: hasActions ? actionsScene.from + 70 + data.actions.length * 16 : cursor + 60,
      actionsPanTo: hasActions ? actionsScene.from + actionsScene.duration - 10 : cursor + 61,
      // Sem ações não há holofote: um frame além do fim nunca é alcançado.
      spotlightFrom: hasActions ? actionsScene.from + 20 : cursor + 60,
    },
    hasGroups,
    hasVotes,
    hasActions,
    needsTour,
    stats: {
      cards: cards.length,
      votes: cards.reduce((sum, c) => sum + c.votes, 0),
      reactions: cards.reduce(
        (sum, c) => sum + Object.values(c.reactions).reduce((a, b) => a + b, 0),
        0,
      ),
      actions: data.actions.length,
      participants: data.participants.length,
      groups: new Set(cards.map((c) => c.groupId).filter(Boolean)).size,
    },
    omitted,
    omittedActions,
    durationInFrames: cursor,
  }
}

/* ------------------------------------------------------------ panorâmica */

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function ramp(frame: number, points: number[], values: number[]): number {
  if (frame <= points[0]) return values[0]
  for (let i = 1; i < points.length; i++) {
    if (frame <= points[i]) {
      const span = points[i] - points[i - 1]
      const t = span <= 0 ? 1 : (frame - points[i - 1]) / span
      return values[i - 1] + (values[i] - values[i - 1]) * easeInOut(t)
    }
  }
  return values[values.length - 1]
}

/**
 * Deslocamento vertical da coluna no frame atual. A coluna que não coube desce
 * até o último card, segura, e volta ao topo antes das cenas seguintes — assim
 * o resto do vídeo continua acontecendo na posição canônica.
 */
export function columnPan(timeline: Timeline, column: RecapColumn, frame: number): number {
  const distance = timeline.fit[column].scroll
  if (distance <= 0) return 0

  const [from, to] =
    column === 'actions'
      ? [timeline.marks.actionsPanFrom, timeline.marks.actionsPanTo]
      : [timeline.marks.tourFrom, timeline.marks.tourTo]
  if (to <= from) return 0

  const span = to - from
  // A coluna de ações não volta: o holofote final precisa terminar na última ação.
  return column === 'actions'
    ? ramp(frame, [from, to], [0, distance])
    : ramp(
        frame,
        [from, from + span * 0.45, from + span * 0.68, to],
        [0, distance, distance, 0],
      )
}

export const secondsToFrames = (seconds: number) => Math.round(seconds * FPS)
export const boardBounds = { width: WIDTH, height: HEIGHT }
