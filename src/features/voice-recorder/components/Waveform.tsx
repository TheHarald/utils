import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { clamp } from '@/lib/format'
import { cn } from '@/lib/utils'
import { computePeaks } from '../lib/audio-edit'
import { pcmDuration, type PcmData } from '../lib/pcm'

const HANDLE_HIT_PX = 10
const MIN_DRAG_PX = 3

export interface WaveformProps {
  pcm: PcmData
  selectionStart: number
  selectionEnd: number
  playhead: number
  height?: number
  className?: string
  /** Меняется при смене темы — заставляет перерисовать canvas. */
  themeKey?: string
  onSeek: (time: number) => void
  onSelectionChange: (start: number, end: number) => void
}

interface DragState {
  mode: 'start' | 'end' | 'new'
  anchorTime: number
  anchorX: number
  moved: boolean
  previous: [number, number]
}

/**
 * Интерактивная волна на canvas: клик — перемотка, протяжка — выделение,
 * тяга за края выделения — точная подстройка границ.
 */
export function Waveform({
  pcm,
  selectionStart,
  selectionEnd,
  playhead,
  height = 148,
  className,
  themeKey,
  onSeek,
  onSelectionChange,
}: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [width, setWidth] = useState(0)

  const duration = pcmDuration(pcm)
  const barCount = Math.max(60, Math.min(900, Math.floor(width / 3) || 240))
  const peaks = useMemo(() => computePeaks(pcm, barCount), [pcm, barCount])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setWidth(rect.width)
    })
    observer.observe(element)
    setWidth(element.clientWidth)
    return () => observer.disconnect()
  }, [])

  const timeFromClientX = useCallback(
    (clientX: number): number => {
      const canvas = canvasRef.current
      if (!canvas || duration <= 0) return 0
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0) return 0
      return clamp((clientX - rect.left) / rect.width, 0, 1) * duration
    },
    [duration],
  )

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width === 0) return
    const context = canvas.getContext('2d')
    if (!context) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, width, height)

    const styles = window.getComputedStyle(canvas)
    const mutedColor = styles.getPropertyValue('--muted-foreground').trim() || '#71717a'
    const primaryColor = styles.getPropertyValue('--primary').trim() || '#18181b'
    const foregroundColor = styles.getPropertyValue('--foreground').trim() || '#18181b'

    const toX = (time: number) => (duration > 0 ? (time / duration) * width : 0)
    const startX = toX(selectionStart)
    const endX = toX(selectionEnd)
    const hasSelection = duration - (selectionEnd - selectionStart) > 0.02

    // Подсветка выделенного фрагмента.
    context.globalAlpha = 0.12
    context.fillStyle = primaryColor
    context.fillRect(startX, 0, Math.max(0, endX - startX), height)
    context.globalAlpha = 1

    const centerY = height / 2
    const maxBar = height * 0.44
    const step = peaks.length > 0 ? width / peaks.length : width
    const barWidth = Math.max(1, step * 0.68)
    const radius = Math.min(barWidth / 2, 2)
    const supportsRoundRect = typeof context.roundRect === 'function'

    peaks.forEach((peak, index) => {
      const x = index * step
      const amplitude = Math.max(0.015, peak) * maxBar
      const center = x + barWidth / 2
      const inside = center >= startX && center <= endX
      context.globalAlpha = inside ? 0.95 : 0.35
      context.fillStyle = inside ? primaryColor : mutedColor
      if (supportsRoundRect) {
        context.beginPath()
        context.roundRect(x, centerY - amplitude, barWidth, amplitude * 2, radius)
        context.fill()
      } else {
        context.fillRect(x, centerY - amplitude, barWidth, amplitude * 2)
      }
    })
    context.globalAlpha = 1

    // Ручки выделения.
    if (hasSelection) {
      context.fillStyle = primaryColor
      context.fillRect(startX - 1, 0, 2, height)
      context.fillRect(endX - 1, 0, 2, height)
    }

    // Плейхед.
    const playheadX = toX(playhead)
    context.strokeStyle = foregroundColor
    context.lineWidth = 1.5
    context.beginPath()
    context.moveTo(playheadX, 2)
    context.lineTo(playheadX, height - 2)
    context.stroke()
  }, [peaks, width, height, duration, selectionStart, selectionEnd, playhead, themeKey])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const time = timeFromClientX(event.clientX)
    const startX = (selectionStart / duration) * rect.width
    const endX = (selectionEnd / duration) * rect.width

    let mode: DragState['mode'] = 'new'
    if (selectionStart > 0.001 && Math.abs(x - startX) <= HANDLE_HIT_PX) {
      mode = 'start'
    } else if (selectionEnd < duration - 0.001 && Math.abs(x - endX) <= HANDLE_HIT_PX) {
      mode = 'end'
    }

    dragRef.current = {
      mode,
      anchorTime: time,
      anchorX: event.clientX,
      moved: false,
      previous: [selectionStart, selectionEnd],
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    if (!drag.moved && Math.abs(event.clientX - drag.anchorX) > MIN_DRAG_PX) {
      drag.moved = true
    }
    if (!drag.moved) return

    const time = timeFromClientX(event.clientX)
    if (drag.mode === 'new') {
      onSelectionChange(Math.min(drag.anchorTime, time), Math.max(drag.anchorTime, time))
    } else if (drag.mode === 'start') {
      onSelectionChange(Math.min(time, selectionEnd), selectionEnd)
    } else {
      onSelectionChange(selectionStart, Math.max(time, selectionStart))
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    // Обычный клик без протяжки — это перемотка, выделение не меняем.
    if (drag.mode === 'new' && !drag.moved) {
      onSelectionChange(drag.previous[0], drag.previous[1])
      onSeek(timeFromClientX(event.clientX))
    }
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      onSeek(playhead - 0.5)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      onSeek(playhead + 0.5)
    } else if (event.key === 'Home') {
      event.preventDefault()
      onSeek(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      onSeek(duration)
    }
  }

  return (
    <div
      ref={containerRef}
      role="group"
      tabIndex={0}
      aria-label="Волна записи: клик — перемотка, протяжка — выделение фрагмента"
      className={cn(
        'relative w-full touch-none rounded-lg bg-muted/40 ring-1 ring-border/60 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/60',
        className,
      )}
      style={{ height }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={() => onSelectionChange(0, duration)}
      onKeyDown={handleKeyDown}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair rounded-lg"
        style={{ height }}
      />
    </div>
  )
}

