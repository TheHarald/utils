import { observer } from 'mobx-react-lite'
import { Pause, Play, Repeat, SkipBack } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDuration } from '@/lib/format'
import { useVoiceRecorder } from '../store/useVoiceRecorder'

export const PlaybackControls = observer(function PlaybackControls() {
  const recorder = useVoiceRecorder()
  const disabled = !recorder.hasAudio

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={() => recorder.seek(0)}
            disabled={disabled}
            aria-label="В начало"
          >
            <SkipBack className="size-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>В начало</TooltipContent>
      </Tooltip>

      <Button
        onClick={() => recorder.togglePlayback()}
        disabled={disabled}
        className="gap-1.5"
        aria-label={recorder.isPlaying ? 'Пауза' : 'Слушать'}
      >
        {recorder.isPlaying ? (
          <Pause className="size-4" aria-hidden="true" />
        ) : (
          <Play className="size-4" aria-hidden="true" />
        )}
        {recorder.isPlaying ? 'Пауза' : 'Слушать'}
      </Button>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={recorder.loop ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => recorder.toggleLoop()}
            aria-pressed={recorder.loop}
            aria-label="Повторять воспроизведение"
          >
            <Repeat className="size-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{recorder.loop ? 'Повтор включён' : 'Повторять'}</TooltipContent>
      </Tooltip>

      <Button
        variant="outline"
        size="sm"
        onClick={() => recorder.playSelection()}
        disabled={!recorder.hasSelection}
        className="gap-1.5"
      >
        <Play className="size-3.5" aria-hidden="true" />
        Выделение
      </Button>

      <div className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
        <span className="text-foreground">{formatDuration(recorder.playhead)}</span>
        {' / '}
        {formatDuration(recorder.duration)}
      </div>
    </div>
  )
})
