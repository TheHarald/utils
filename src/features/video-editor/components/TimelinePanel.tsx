import type { MouseEvent } from 'react'
import { observer } from 'mobx-react-lite'
import { ArrowLeft, ArrowRight, Scissors, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { formatDuration } from '@/lib/format'
import { clipDuration } from '../lib/timeline'
import { useVideoEditor } from '../store/useVideoEditor'

/** Шкала фрагментов: длина блока пропорциональна длительности, клик — перемотка. */
export const TimelinePanel = observer(function TimelinePanel() {
  const editor = useVideoEditor()
  const max = Math.max(editor.duration, 0.1)
  const playheadPercent = Math.min(100, Math.max(0, (editor.playhead / max) * 100))

  const handleSeek = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) return
    const ratio = (event.clientX - rect.left) / rect.width
    editor.pause()
    editor.seek(ratio * editor.duration)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Шкала</CardTitle>
        <CardDescription>
          Клик по шкале — перемотка, клик по фрагменту — выбор. Курсор режет фрагмент на две
          части.
        </CardDescription>
        <CardAction>
          <Badge variant="secondary" className="font-mono">
            фрагментов: {editor.clips.length} · {formatDuration(editor.duration)}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="presentation"
          onClick={handleSeek}
          className="relative flex h-20 w-full cursor-crosshair overflow-hidden rounded-lg border bg-muted/40"
        >
          {editor.clips.map((clip, index) => {
            const asset = editor.assets.find((item) => item.id === clip.assetId)
            const selected = clip.id === editor.selectedClipId
            return (
              <button
                key={clip.id}
                type="button"
                style={{ flexGrow: Math.max(clipDuration(clip), 0.05) }}
                onClick={(event) => {
                  event.stopPropagation()
                  editor.selectClip(clip.id)
                }}
                title={asset ? `${asset.name} · ${formatDuration(clipDuration(clip))}` : undefined}
                className={
                  'relative min-w-0 basis-0 overflow-hidden border-r border-background/60 px-2 py-1.5 text-left transition-colors last:border-r-0 ' +
                  (selected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/70 text-secondary-foreground hover:bg-secondary')
                }
              >
                <span className="block truncate text-xs font-medium">
                  {index + 1}. {asset?.name ?? 'файл'}
                </span>
                <span className="block font-mono text-[10px] opacity-80">
                  {formatDuration(clipDuration(clip))}
                </span>
              </button>
            )
          })}
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary-foreground shadow-[0_0_0_1px_var(--color-primary)]"
            style={{ left: `${playheadPercent}%` }}
            aria-hidden="true"
          />
        </div>

        <Slider
          value={[editor.playhead]}
          min={0}
          max={max}
          step={0.01}
          aria-label="Позиция на шкале"
          onValueChange={([value]) => {
            editor.pause()
            editor.seek(value)
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => editor.splitAtPlayhead()}
            disabled={!editor.canSplitAtPlayhead}
          >
            <Scissors className="size-3.5" aria-hidden="true" />
            Разрезать
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => editor.moveSelected(-1)}
            disabled={!editor.canMoveLeft}
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Левее
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => editor.moveSelected(1)}
            disabled={!editor.canMoveRight}
          >
            Правее
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              if (editor.selectedClipId) editor.removeClip(editor.selectedClipId)
            }}
            disabled={!editor.selectedClip}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Удалить
          </Button>

          <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
            {formatDuration(editor.playhead)} / {formatDuration(editor.duration)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
})
