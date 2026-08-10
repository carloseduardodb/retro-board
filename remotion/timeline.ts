/**
 * Constrói, a partir dos dados da retro, a linha do tempo inteira do vídeo:
 * cenas, posições de cada card em cada momento e os frames em que cada beat
 * acontece (aparecer, revelar, votar, reagir, agrupar).
 *
 * Tudo aqui é função pura dos dados — nenhum componente guarda estado. Isso é o
 * que permite a mesma composição rodar com dados fictícios na landing e com
 * dados reais no recap de uma sessão, e ser scrubbada pelo scroll sem drift.
 */

import { FPS, columnWidth, cardWidth, layout, HEIGHT, WIDTH } from './theme'
import type { RecapCard, RecapData } from './types'

export const MAX_CARDS_PER_COLUMN = 4
export const MAX_ACTIONS = 5
export const MAX_CARD_CHARS = 80

const BOARD_COLUMNS = ['good', 'bad', 'ideas', 'actions'] as const
const CHARS_PER_LINE = 34

export const boardTop = layout.headerHeight + 28
export const columnHeight = HEIGHT - boardTop - 44

export function columnX(column: (typeof BOARD_COLUMNS)[number]): number {
  const index = BOARD_COLUMNS.indexOf(column)
  return layout.boardPadding + index * (columnWidth + layout.columnGap)
}

export function cardHeight(card: Pick<RecapCard, 'text' | 'reactions'>): number {
  const lines = Math.max(1, Math.ceil(card.text.length / CHARS_PER_LINE))
  const reactions = Object.keys(card.reactions).length > 0 ? layout.reactionsHeight : 0
  return layout.cardPaddingY * 2 + lines * layout.cardLineHeight + layout.cardFooterHeight + reactions
}

export function actionHeight(text: string): number {
  const lines = Math.max(1, Math.ceil(text.length / CHARS_PER_LINE))
  return layout.cardPaddingY * 2 + lines * layout.cardLineHeight
}

export type Placement = { x: number; y: number; width: number; height: number }

export type GroupBlock = {
  id: string
  label: string | null
  column: RecapCard['column']
  votes: number
  count: number
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
  /** Posição cronológica, ordenada por votos e já dentro do grupo. */
  chronological: Placement
  ranked: Placement
  grouped: Placement
}

export type ActionTrack = {
  id: string
  text: string
  appear: number
  placement: Placement
}

export type Scene = {
  id: 'intro' | 'write' | 'reveal' | 'vote' | 'group' | 'draw' | 'actions' | 'outro'
  from: number
  duration: number
  title: string
  subtitle: string
}

export type Timeline = {
  scenes: Scene[]
  scene: (id: Scene['id']) => Scene
  cards: CardTrack[]
  groups: GroupBlock[]
  actions: ActionTrack[]
  marks: {
    revealAt: number
    rankFrom: number
    rankTo: number
    groupFrom: number
    groupTo: number
    /** Frame a partir do qual o board escurece para destacar as ações. */
    spotlightFrom: number
  }
  hasGroups: boolean
  hasVotes: boolean
  hasActions: boolean
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
function computeLayout(cards: RecapCard[], mode: LayoutMode): {
  placements: Record<string, Placement>
  groups: GroupBlock[]
} {
  const placements: Record<string, Placement> = {}
  const groups: GroupBlock[] = []

  for (const column of ['good', 'bad', 'ideas'] as const) {
    const columnCards = cards.filter((c) => c.column === column)
    const x = columnX(column) + layout.columnPadding
    let y = boardTop + layout.columnHeaderHeight + layout.columnPadding

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
          height:
            layout.groupHeaderHeight + members.reduce((sum, c) => sum + cardHeight(c), 0),
        })
        continue
      }
      items.push({
        kind: 'card',
        card,
        votes: card.votes,
        createdAt: card.createdAt,
        height: cardHeight(card),
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
          placement: { x, y, width: cardWidth, height: item.height },
        })
        let innerY = y + layout.groupHeaderHeight
        for (const member of item.cards) {
          const height = cardHeight(member)
          placements[member.id] = { x, y: innerY, width: cardWidth, height }
          innerY += height
        }
      }
      y += item.height + layout.cardGap
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
 * Recorta os dados ao que cabe em tela e **devolve o que ficou de fora**.
 * Cortar em silêncio faria o vídeo mostrar 4 cards com o contador da coluna
 * dizendo 4, enquanto o board tem 7 — o recap mentiria sobre a própria retro.
 */
export function trimData(data: RecapData): TrimResult {
  const cards: RecapCard[] = []
  const omitted = { good: 0, bad: 0, ideas: 0 }
  for (const column of ['good', 'bad', 'ideas'] as const) {
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
    text:
      card.text.length > MAX_CARD_CHARS
        ? `${card.text.slice(0, MAX_CARD_CHARS - 1).trimEnd()}…`
        : card.text,
    groupId: card.groupId && (groupCounts.get(card.groupId) ?? 0) > 1 ? card.groupId : null,
    groupLabel: card.groupId && (groupCounts.get(card.groupId) ?? 0) > 1 ? card.groupLabel : null,
  }))

  return {
    data: {
      ...data,
      cards: trimmed,
      actions: data.actions.slice(0, MAX_ACTIONS).map((action) => ({
        ...action,
        text:
          action.text.length > MAX_CARD_CHARS
            ? `${action.text.slice(0, MAX_CARD_CHARS - 1).trimEnd()}…`
            : action.text,
      })),
    },
    omitted,
    omittedActions: Math.max(0, data.actions.length - MAX_ACTIONS),
  }
}

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

  const chronological = computeLayout(cards, { rank: false, group: false })
  const ranked = computeLayout(cards, { rank: true, group: false })
  const grouped = computeLayout(cards, { rank: true, group: true })

  const scenes: Scene[] = []
  let cursor = 0
  const push = (scene: Omit<Scene, 'from'>) => {
    scenes.push({ ...scene, from: cursor })
    cursor += scene.duration
    return scenes[scenes.length - 1]
  }

  const writeDuration = 70 + cards.length * 7
  const voteDuration = 60 + cards.length * 6 + 50

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
  const actionsScene = push({
    id: 'actions',
    duration: hasActions ? 90 + data.actions.length * 16 + 70 : 0,
    title: 'A retro termina em ações',
    subtitle: 'Elas voltam marcadas na próxima sprint',
  })
  push({
    id: 'outro',
    duration: 130,
    title: 'A retro cabe em um link',
    subtitle: 'Crie a sessão, mande o código, rode o timer',
  })

  const appearBase = write.from + 30
  const byCreation = [...cards].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const byVotes = [...cards].sort((a, b) => b.votes - a.votes || sortChronological(a, b))

  const revealAt = reveal.from + 24
  // Sem votos a ordenação final é igual à cronológica; a janela existe só para
  // `interpolate` não receber um intervalo degenerado.
  const rankFrom = hasEngagement ? vote.from + 40 + cards.length * 6 : vote.from
  const rankTo = rankFrom + (hasEngagement ? 30 : 1)
  const groupFrom = hasGroups ? group.from + 20 : rankTo
  // Sem grupos o layout final é igual ao ordenado, mas a janela precisa ter
  // largura > 0: `interpolate` rejeita um intervalo degenerado.
  const groupTo = groupFrom + (hasGroups ? 45 : 1)

  const tracks: CardTrack[] = cards.map((card) => ({
    card,
    appear: appearBase + byCreation.findIndex((c) => c.id === card.id) * 7,
    voteAt: vote.from + 30 + byVotes.findIndex((c) => c.id === card.id) * 6,
    reactAt: vote.from + 46 + byVotes.findIndex((c) => c.id === card.id) * 6,
    chronological: chronological.placements[card.id],
    ranked: ranked.placements[card.id],
    grouped: grouped.placements[card.id],
  }))

  const actionsX = columnX('actions') + layout.columnPadding
  let actionY = boardTop + layout.columnHeaderHeight + layout.columnPadding
  const actionTracks: ActionTrack[] = data.actions.map((action, index) => {
    const height = actionHeight(action.text)
    const placement = { x: actionsX, y: actionY, width: cardWidth, height }
    actionY += height + layout.cardGap
    return { ...action, appear: actionsScene.from + 60 + index * 16, placement }
  })

  return {
    scenes,
    scene: (id) => scenes.find((s) => s.id === id)!,
    cards: tracks,
    groups: grouped.groups,
    actions: actionTracks,
    marks: {
      revealAt,
      rankFrom,
      rankTo,
      groupFrom,
      groupTo,
      // Sem ações não há holofote: um frame além do fim nunca é alcançado.
      spotlightFrom: hasActions ? actionsScene.from + 20 : cursor + 60,
    },
    hasGroups,
    hasVotes,
    hasActions,
    omitted,
    omittedActions,
    durationInFrames: cursor,
  }
}

export const secondsToFrames = (seconds: number) => Math.round(seconds * FPS)
export const boardBounds = { width: WIDTH, height: HEIGHT }
