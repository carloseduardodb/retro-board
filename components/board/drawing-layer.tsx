'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Eraser, X } from 'lucide-react'
import {
  useDrawing,
  DRAW_COLORS,
  STROKE_HOLD_MS,
  STROKE_FADE_MS,
  type DrawPoint,
} from '@/hooks/use-drawing'
import { cn } from '@/lib/utils'

type DrawingLayerProps = {
  sessionToken: string
  participantId: string
  /** Em modo desenho o canvas captura o mouse; fora dele só exibe os traços dos outros. */
  isDrawing: boolean
  onExit: () => void
}

const LINE_WIDTH = 3

export function DrawingLayer({ sessionToken, participantId, isDrawing, onExit }: DrawingLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const drawingPointerRef = useRef<number | null>(null)

  const { strokesRef, activityRef, startStroke, addPoint, endStroke, clear, setColor, getColor } = useDrawing(
    sessionToken,
    participantId
  )

  // A cor vive em ref no hook (lida no rAF); o estado aqui é só para a UI da paleta.
  const [selectedColor, setSelectedColor] = useState(getColor)

  const pickColor = (color: string) => {
    setColor(color)
    setSelectedColor(color)
  }

  // Loop de render: desenha os traços e aplica o fade que os apaga sozinhos.
  useEffect(() => {
    let frame = 0

    const render = () => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      const container = containerRef.current

      if (canvas && ctx && container) {
        const { width, height } = container.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1

        if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
          canvas.width = Math.round(width * dpr)
          canvas.height = Math.round(height * dpr)
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, width, height)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = LINE_WIDTH

        const now = Date.now()

        for (const stroke of strokesRef.current.values()) {
          if (stroke.finishedAt !== null) {
            // O relógio do fade é o da última atividade do autor, não o do traço:
            // desenhos de vários traços somem inteiros, não em pedaços.
            const base = Math.max(stroke.finishedAt, activityRef.current.get(stroke.authorId) ?? 0)
            const age = now - base
            if (age > STROKE_HOLD_MS + STROKE_FADE_MS) {
              strokesRef.current.delete(stroke.id)
              continue
            }
            ctx.globalAlpha =
              age <= STROKE_HOLD_MS ? 1 : 1 - (age - STROKE_HOLD_MS) / STROKE_FADE_MS
          } else {
            ctx.globalAlpha = 1
          }

          const pts = stroke.points
          if (pts.length === 0) continue

          ctx.strokeStyle = stroke.color
          ctx.beginPath()
          ctx.moveTo(pts[0].x * width, pts[0].y * height)

          if (pts.length === 1) {
            // Um toque isolado vira um ponto
            ctx.lineTo(pts[0].x * width + 0.1, pts[0].y * height)
          } else {
            // Curvas pelos pontos médios deixam o traço menos "quebrado"
            for (let i = 1; i < pts.length - 1; i++) {
              const mx = ((pts[i].x + pts[i + 1].x) / 2) * width
              const my = ((pts[i].y + pts[i + 1].y) / 2) * height
              ctx.quadraticCurveTo(pts[i].x * width, pts[i].y * height, mx, my)
            }
            const last = pts[pts.length - 1]
            ctx.lineTo(last.x * width, last.y * height)
          }

          ctx.stroke()
        }

        ctx.globalAlpha = 1
      }

      frame = requestAnimationFrame(render)
    }

    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [strokesRef, activityRef])

  const toPoint = useCallback((e: React.PointerEvent): DrawPoint | null => {
    const container = containerRef.current
    if (!container) return null
    const rect = container.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDrawing || drawingPointerRef.current !== null) return
    const point = toPoint(e)
    if (!point) return

    drawingPointerRef.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    startStroke(point)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (drawingPointerRef.current !== e.pointerId) return
    const point = toPoint(e)
    if (point) addPoint(point)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (drawingPointerRef.current !== e.pointerId) return
    drawingPointerRef.current = null
    endStroke()
  }

  // Esc sai do modo desenho
  useEffect(() => {
    if (!isDrawing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDrawing, onExit])

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-40">
      <canvas
        ref={canvasRef}
        className={cn('h-full w-full', isDrawing && 'pointer-events-auto cursor-crosshair')}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {isDrawing && (
        <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur">
          <div className="flex items-center gap-1">
            {DRAW_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => pickColor(color)}
                title={`Cor ${color}`}
                aria-label={`Cor ${color}`}
                style={{ backgroundColor: color }}
                className={cn(
                  'h-5 w-5 rounded-full border-2 transition-transform hover:scale-110',
                  selectedColor === color ? 'border-foreground' : 'border-transparent'
                )}
              />
            ))}
          </div>

          <span className="mx-1 h-5 w-px bg-border" />

          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={clear} title="Apagar todos os rabiscos">
            <Eraser className="h-3.5 w-3.5" />
            Limpar
          </Button>

          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onExit} title="Sair do modo desenho (Esc)">
            <X className="h-3.5 w-3.5" />
            Sair
          </Button>
        </div>
      )}
    </div>
  )
}
