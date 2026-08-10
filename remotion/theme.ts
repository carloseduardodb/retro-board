/**
 * Tokens visuais da composição Remotion.
 *
 * A composição usa estilos inline (e não classes do Tailwind) de propósito: assim
 * ela continua idêntica se um dia for renderizada fora do navegador do app
 * (`@remotion/renderer`), onde o CSS global do Next não existe.
 * Os valores espelham as variáveis de `app/globals.css`.
 */

export const FPS = 30
export const WIDTH = 1920
export const HEIGHT = 1080

export const font =
  "'Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

export const palette = {
  background: '#f5f7fb',
  surface: '#ffffff',
  foreground: '#1c1f24',
  muted: '#6b7280',
  border: '#e3e7ee',
  primary: '#2f6fed',
  primaryFg: '#ffffff',
  danger: '#e04b4b',
} as const

export type RecapColumn = 'good' | 'bad' | 'ideas' | 'actions'

export const columns: Record<
  RecapColumn,
  { title: string; accent: string; tint: string; ink: string }
> = {
  good: { title: 'O que foi bom', accent: '#34d399', tint: '#e9fbf3', ink: '#0f6b4a' },
  bad: { title: 'O que pode melhorar', accent: '#fb7185', tint: '#fff0f2', ink: '#9f1239' },
  ideas: { title: 'Ideias', accent: '#fbbf24', tint: '#fff8e8', ink: '#8a5a06' },
  actions: { title: 'Ações', accent: '#60a5fa', tint: '#eef4ff', ink: '#1d4ed8' },
}

/** Geometria do board dentro do frame de 1920x1080. */
export const layout = {
  headerHeight: 96,
  boardPadding: 56,
  columnGap: 24,
  columnPadding: 16,
  columnHeaderHeight: 64,
  cardGap: 12,
  cardPaddingY: 18,
  cardPaddingX: 20,
  cardLineHeight: 30,
  cardFooterHeight: 44,
  reactionsHeight: 38,
  groupHeaderHeight: 58,
} as const

export const columnWidth =
  (WIDTH - layout.boardPadding * 2 - layout.columnGap * 3) / 4

export const cardWidth = columnWidth - layout.columnPadding * 2

/** Cor estável por participante, no mesmo espírito do modo desenho do board. */
const inkColors = ['#2f6fed', '#e0559a', '#12a594', '#f08c00', '#7c5cf0', '#e04b4b']

export function participantColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return inkColors[Math.abs(hash) % inkColors.length]
}
