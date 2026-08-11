/**
 * A câmera do recap.
 *
 * O board é sempre desenhado em 1920x1080 nas coordenadas canônicas
 * (`remotion/timeline.ts`); é esta camada que decide o que está em quadro em
 * cada momento — plano aberto na escrita, close no bloco agrupado, close no
 * card mais votado, plano médio nas ações.
 *
 * Função pura do frame, como o resto da composição: scrubbar pelo scroll dá o
 * mesmo enquadramento que assistir do início.
 */

import { columnWidth, HEIGHT, WIDTH } from './theme'
import { boardTop, columnHeight, columnX, type Placement, type Timeline } from './timeline'

/** Frames de transição entre um enquadramento e o seguinte. */
const RAMP = 26

export type Shot = {
  from: number
  to: number
  /** Escala no início e no fim do plano — a diferença é o "push" lento. */
  scale: [number, number]
  /** Ponto do board que fica no centro do quadro. */
  cx: number
  cy: number
}

export type Camera = { scale: number; x: number; y: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Escala que faz `rect` ocupar `coverage` da altura do quadro, sem passar dos
 * limites — um card de uma linha não pode virar um outdoor.
 */
function fit(rect: Placement, coverage: number, min: number, max: number): number {
  return clamp((HEIGHT * coverage) / rect.height, min, max)
}

function shotOn(rect: Placement, from: number, to: number, scale: number, push = 0.04): Shot {
  return {
    from,
    to,
    scale: [scale, scale * (1 + push)],
    cx: rect.x + rect.width / 2,
    cy: rect.y + rect.height / 2,
  }
}

/**
 * Monta o roteiro de câmera: uma lista contígua de planos cobrindo o vídeo
 * inteiro. Cada cena escolhe seu alvo; o que não tem alvo fica no plano aberto.
 */
export function buildCamera(timeline: Timeline): Shot[] {
  const wide = (from: number, to: number, scale: [number, number] = [1, 1.03]): Shot => ({
    from,
    to,
    scale,
    cx: WIDTH / 2,
    cy: HEIGHT / 2,
  })

  const shots: Shot[] = []
  const scenes = timeline.scenes.filter((scene) => scene.duration > 0)

  // Card mais votado e maior bloco de tema: os dois closes do vídeo.
  const top = [...timeline.cards].sort((a, b) => b.card.votes - a.card.votes)[0]
  const biggestGroup = [...timeline.groups].sort(
    (a, b) => b.count - a.count || b.votes - a.votes,
  )[0]

  for (const scene of scenes) {
    const from = scene.from
    const to = scene.from + scene.duration

    switch (scene.id) {
      case 'group': {
        if (!biggestGroup) {
          shots.push(wide(from, to))
          break
        }
        // Espera o bloco fechar antes de aproximar: dar close num agrupamento
        // que ainda não aconteceu mostraria cards soltos em tamanho gigante.
        const settle = Math.min(to, timeline.marks.groupTo + 10)
        shots.push(wide(from, settle, [1.03, 1.05]))
        shots.push(
          shotOn(biggestGroup.placement, settle, to, fit(biggestGroup.placement, 0.62, 1.2, 2.1)),
        )
        break
      }
      case 'draw': {
        if (!top) {
          shots.push(wide(from, to))
          break
        }
        const target = timeline.hasGroups ? top.grouped : top.ranked
        // O quadro abre antes de a seta terminar: ela é desenhada até a coluna
        // de ações, que num close no card fica fora de quadro.
        const close = fit(target, 0.42, 1.25, 2.4)
        const openAt = to - 62
        shots.push(shotOn(target, from, openAt, close, 0.02))
        shots.push({
          from: openAt,
          to,
          scale: [close * 0.72, 1.05],
          cx: lerp(target.x + target.width / 2, WIDTH / 2, 0.6),
          cy: HEIGHT / 2,
        })
        break
      }
      case 'actions': {
        const column: Placement = {
          x: columnX('actions'),
          y: boardTop,
          width: columnWidth,
          height: columnHeight,
        }
        shots.push(wide(from, from + 40, [1.03, 1.05]))
        shots.push(shotOn(column, from + 40, to, 1.34, 0.03))
        break
      }
      case 'tour': {
        // A varredura já é o movimento; a câmera só respira junto.
        shots.push(wide(from, to, [1.04, 1.02]))
        break
      }
      case 'highlights':
      case 'outro':
        // Overlays de tela cheia: a câmera fica parada atrás deles.
        shots.push(wide(from, to, [1.05, 1.06]))
        break
      default:
        shots.push(wide(from, to))
    }
  }

  return shots.filter((shot) => shot.to > shot.from)
}

/** Valor de um plano no seu próprio fim — ponto de partida da transição seguinte. */
const endOf = (shot: Shot) => ({ scale: shot.scale[1], cx: shot.cx, cy: shot.cy })

export function cameraAt(shots: Shot[], frame: number): Camera {
  if (shots.length === 0) return { scale: 1, x: 0, y: 0 }

  let index = shots.findIndex((shot) => frame < shot.to)
  if (index === -1) index = shots.length - 1
  const shot = shots[index]
  const previous = index > 0 ? endOf(shots[index - 1]) : endOf(shot)

  const local = clamp(frame - shot.from, 0, shot.to - shot.from)
  const progress = local / Math.max(1, shot.to - shot.from)
  const target = {
    scale: lerp(shot.scale[0], shot.scale[1], progress),
    cx: shot.cx,
    cy: shot.cy,
  }

  // Transição suave a partir de onde o plano anterior parou.
  const blend = easeInOut(clamp(local / RAMP, 0, 1))
  const scale = lerp(previous.scale, target.scale, blend)
  const cx = lerp(previous.cx, target.cx, blend)
  const cy = lerp(previous.cy, target.cy, blend)

  // Sem clamp, um alvo perto da borda deixaria fundo vazio entrar em quadro.
  const x = clamp(WIDTH / 2 - cx * scale, WIDTH - WIDTH * scale, 0)
  const y = clamp(HEIGHT / 2 - cy * scale, HEIGHT - HEIGHT * scale, 0)

  return { scale, x, y }
}
