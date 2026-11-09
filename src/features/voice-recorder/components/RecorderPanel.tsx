import { observer } from 'mobx-react-lite'
import { CircleAlert, LoaderCircle, Mic, Pause, Play, RotateCcw, Square, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { amplitudeToDb, clamp, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useVoiceRecorder } from '../store/useVoiceRecorder'

const METER_SEGMENTS = 30

export const RecorderPanel = observer(function RecorderPanel() {
  const recorder = useVoiceRecorder()
  const isRecording = recorder.status === 'recording'
  const isPaused = recorder.status === 'paused'
  const isProcessing = recorder.status === 'processing'
  const isRequesting = recorder.status === 'requesting'
  const isBusy = isProcessing || isRequesting
  const isLive = isRecording || isPaused

  const levelRatio = clamp((amplitudeToDb(recorder.level) + 48) / 48, 0, 1)
  const channelInfo = recorder.pcm
    ? `${Math.round(recorder.pcm.sampleRate / 1000)} кГц · ${recorder.pcm.channels.length} кан.`
    : null

  const handlePrimaryAction = () => {
    if (isLive) {
      void recorder.stopRecording()
      return
    }
    void recorder.startRecording()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Запись</CardTitle>
        <CardDescription>
          {isProcessing
            ? 'Обрабатываем запись…'
            : isLive
              ? 'Идёт запись — говорите в микрофон. Можно поставить паузу.'
              : recorder.hasAudio
                ? 'Запись готова: прослушайте её и отредактируйте ниже.'
                : 'Нажмите «Записать» и разрешите браузеру доступ к микрофону.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!recorder.canRecord && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              Браузер не поддерживает запись звука или страница открыта без HTTPS. Попробуйте Chrome,
              Firefox или Safari на защищённом соединении.
            </p>
          </div>
        )}

        {recorder.error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{recorder.error}</p>
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                'size-2 rounded-full',
                isRecording
                  ? 'animate-pulse bg-destructive'
                  : isPaused
                    ? 'bg-amber-500'
                    : 'bg-muted-foreground/40',
              )}
            />
            <span className="font-mono text-2xl tabular-nums">
              {formatDuration(recorder.elapsedMs / 1000)}
            </span>
            <span className="text-xs text-muted-foreground">
              {isRecording ? 'запись' : isPaused ? 'пауза' : isProcessing ? 'обработка' : 'таймер'}
            </span>
          </div>

          <LevelMeter ratio={levelRatio} active={isRecording} />

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-lg"
                  className={cn(
                    'size-14 rounded-full',
                    isLive && 'bg-destructive text-white hover:bg-destructive/90',
                  )}
                  onClick={handlePrimaryAction}
                  disabled={!recorder.canRecord || isBusy}
                  aria-label={isLive ? 'Остановить запись' : 'Начать запись'}
                >
                  {isBusy ? (
                    <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
                  ) : isLive ? (
                    <Square className="size-5" aria-hidden="true" />
                  ) : (
                    <Mic className="size-5" aria-hidden="true" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isBusy ? 'Подождите…' : isLive ? 'Остановить и обработать' : 'Начать запись'}
              </TooltipContent>
            </Tooltip>

            {isLive && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-lg"
                    className="size-12 rounded-full"
                    onClick={() =>
                      isPaused ? recorder.resumeRecording() : recorder.pauseRecording()
                    }
                    aria-label={isPaused ? 'Продолжить запись' : 'Пауза'}
                  >
                    {isPaused ? (
                      <Play className="size-5" aria-hidden="true" />
                    ) : (
                      <Pause className="size-5" aria-hidden="true" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isPaused ? 'Продолжить' : 'Пауза'}</TooltipContent>
              </Tooltip>
            )}

            {recorder.hasAudio && !isLive && !isBusy && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-lg"
                      className="size-12 rounded-full"
                      onClick={() => void recorder.startRecording()}
                      aria-label="Записать заново"
                    >
                      <RotateCcw className="size-5" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Записать заново</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-lg"
                      className="size-12 rounded-full"
                      onClick={() => recorder.discardRecording()}
                      aria-label="Удалить запись"
                    >
                      <Trash2 className="size-5" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Удалить запись</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>

        {recorder.hasAudio && (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
            <span>Длительность: {formatDuration(recorder.duration)}</span>
            <span>Источник: {recorder.sourceFormatLabel}</span>
            <span>
              Пик: {Number.isFinite(recorder.peakDb) ? `${recorder.peakDb.toFixed(1)} дБ` : '—'}
            </span>
            {channelInfo && <span>{channelInfo}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
})

function LevelMeter({ ratio, active }: { ratio: number; active: boolean }) {
  const litCount = Math.round(ratio * METER_SEGMENTS)

  return (
    <div className="flex w-full max-w-sm items-center gap-1" aria-hidden="true">
      {Array.from({ length: METER_SEGMENTS }, (_, index) => {
        const position = index / METER_SEGMENTS
        const color =
          position >= 0.88 ? 'bg-destructive' : position >= 0.66 ? 'bg-amber-500' : 'bg-emerald-500'
        const isLit = active && index < litCount
        return (
          <span
            key={index}
            className={cn('h-2 flex-1 rounded-full transition-colors', isLit ? color : 'bg-muted')}
          />
        )
      })}
    </div>
  )
}
