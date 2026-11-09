import { observer } from 'mobx-react-lite'
import { FilePlus2, RotateCcw, Scissors, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { formatDuration } from '@/lib/format'
import { assetSummary } from '../lib/assets'
import { MIN_CLIP_DURATION, clipDuration } from '../lib/timeline'
import { useVideoEditor } from '../store/useVideoEditor'

/** Точная обрезка выбранного фрагмента ползунками. */
export const ClipInspector = observer(function ClipInspector() {
  const editor = useVideoEditor()
  const clip = editor.selectedClip
  const asset = editor.selectedAsset

  if (!clip || !asset) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Фрагмент</CardTitle>
          <CardDescription>Выберите фрагмент на шкале, чтобы обрезать или удалить его.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const handleReset = () => {
    editor.resetClipRange(clip.id)
    toast.success('Обрезка сброшена', {
      description: `Длительность: ${formatDuration(asset.duration)}`,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Фрагмент</CardTitle>
        <CardDescription>
          {asset.name} · {assetSummary(asset)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <Label htmlFor="clip-range">Границы внутри файла</Label>
            <span className="font-mono tabular-nums text-muted-foreground">
              {formatDuration(clip.start)} — {formatDuration(clip.end)} ·{' '}
              {formatDuration(clipDuration(clip))}
            </span>
          </div>
          <Slider
            id="clip-range"
            value={[clip.start, clip.end]}
            min={0}
            max={Math.max(asset.duration, MIN_CLIP_DURATION)}
            step={0.01}
            minStepsBetweenThumbs={Math.round(MIN_CLIP_DURATION / 0.01)}
            disabled={editor.isExporting}
            aria-label="Границы фрагмента"
            onValueChange={([start, end]) => editor.setClipRange(clip.id, start, end)}
          />
          <p className="text-xs text-muted-foreground">
            Длительность файла: {formatDuration(asset.duration)}. Минимальная длина фрагмента —{' '}
            {Math.round(MIN_CLIP_DURATION * 1000)} мс.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleReset}
            disabled={editor.isExporting || (clip.start === 0 && clip.end === asset.duration)}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Сбросить обрезку
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => editor.appendAsset(asset.id)}
            disabled={editor.isExporting}
          >
            <FilePlus2 className="size-3.5" aria-hidden="true" />
            Ещё один фрагмент
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => editor.removeClip(clip.id)}
            disabled={editor.isExporting}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Удалить фрагмент
          </Button>
        </div>

        <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          <Scissors className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Чтобы разделить фрагмент, поставьте курсор на шкале и нажмите «Разрезать» — части
          останутся из того же файла.
        </p>
      </CardContent>
    </Card>
  )
})
