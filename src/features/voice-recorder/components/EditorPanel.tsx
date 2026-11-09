import { observer } from 'mobx-react-lite'
import { Eraser, Gauge, RotateCcw, Scissors, Undo2, Volume2, Waves } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { formatDuration } from '@/lib/format'
import { useVoiceRecorder } from '../store/useVoiceRecorder'

export const EditorPanel = observer(function EditorPanel() {
  const recorder = useVoiceRecorder()
  const disabled = !recorder.hasAudio
  const duration = Math.max(recorder.duration, 0.1)

  const handleTrim = () => {
    if (recorder.trimToSelection()) {
      toast.success('Лишнее обрезано', {
        description: `Новая длительность: ${formatDuration(recorder.duration)}`,
      })
    } else {
      toast.info('Сначала выделите фрагмент на волне')
    }
  }

  const handleRemoveSilence = () => {
    if (recorder.removeSilence()) {
      toast.success('Тишина по краям убрана')
    } else {
      toast.info('Тишины по краям не найдено')
    }
  }

  const handleNormalize = () => {
    if (recorder.normalize()) toast.success('Громкость выровнена до −1 дБ')
  }

  const handleGain = () => {
    if (recorder.applyGain()) {
      toast.success('Громкость изменена', {
        description: `${recorder.gainDb > 0 ? '+' : ''}${recorder.gainDb} дБ`,
      })
    } else {
      toast.info('Громкость уже на нуле')
    }
  }

  const handleFade = () => {
    if (recorder.applyFades()) {
      toast.success('Плавные края добавлены', {
        description: `${Math.round(recorder.fadeSeconds * 1000)} мс`,
      })
    }
  }

  const handleUndo = () => {
    if (recorder.undo()) toast.success('Последнее действие отменено')
  }

  const handleReset = () => {
    recorder.resetToOriginal()
    toast.success('Правки сброшены')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Редактор</CardTitle>
        <CardDescription>
          Протяните по волне, чтобы выделить фрагмент, или задайте границы ползунками. Все правки
          можно отменить.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Фрагмент</span>
            <span className="font-mono tabular-nums">
              {formatDuration(recorder.selectionStart)} — {formatDuration(recorder.selectionEnd)}
              {' · '}
              {formatDuration(recorder.selectionDuration)}
            </span>
          </div>
          <Slider
            value={[recorder.selectionStart, recorder.selectionEnd]}
            min={0}
            max={duration}
            step={0.01}
            disabled={disabled}
            aria-label="Границы выделения"
            onValueChange={([start, end]) => recorder.setSelection(start, end)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => recorder.selectAll()}
              disabled={disabled}
            >
              Выделить всё
            </Button>
            <Button
              size="sm"
              onClick={handleTrim}
              disabled={!recorder.hasSelection}
              className="gap-1.5"
            >
              <Scissors className="size-3.5" aria-hidden="true" />
              Обрезать по выделению
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={handleRemoveSilence}
            disabled={disabled}
            className="justify-start gap-2"
          >
            <Eraser className="size-4" aria-hidden="true" />
            Убрать тишину по краям
          </Button>
          <Button
            variant="outline"
            onClick={handleNormalize}
            disabled={disabled}
            className="justify-start gap-2"
          >
            <Gauge className="size-4" aria-hidden="true" />
            Нормализовать до −1 дБ
          </Button>
          <Button
            variant="outline"
            onClick={handleUndo}
            disabled={!recorder.canUndo}
            className="justify-start gap-2"
          >
            <Undo2 className="size-4" aria-hidden="true" />
            Отменить действие
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={disabled || !recorder.canUndo}
            className="justify-start gap-2"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Сбросить все правки
          </Button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="gain-slider">Громкость</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {recorder.gainDb > 0 ? '+' : ''}
                {recorder.gainDb} дБ
              </span>
            </div>
            <Slider
              id="gain-slider"
              value={[recorder.gainDb]}
              min={-24}
              max={24}
              step={1}
              disabled={disabled}
              onValueChange={([value]) => recorder.setGainDb(value)}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={handleGain}
              disabled={disabled || recorder.gainDb === 0}
            >
              <Volume2 className="size-4" aria-hidden="true" />
              Применить усиление
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="fade-slider">Плавные края</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {Math.round(recorder.fadeSeconds * 1000)} мс
              </span>
            </div>
            <Slider
              id="fade-slider"
              value={[recorder.fadeSeconds]}
              min={0.05}
              max={2}
              step={0.05}
              disabled={disabled}
              onValueChange={([value]) => recorder.setFadeSeconds(value)}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={handleFade}
              disabled={disabled}
            >
              <Waves className="size-4" aria-hidden="true" />
              Добавить fade in / fade out
            </Button>
          </div>
        </div>

      </CardContent>
    </Card>
  )
})
