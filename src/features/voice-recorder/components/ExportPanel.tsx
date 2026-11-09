import { observer } from 'mobx-react-lite'
import { Download, FileAudio, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatBytes } from '@/lib/format'
import type { Mp3Bitrate } from '../lib/encoders/mp3'
import { MP3_BITRATES } from '../lib/export-formats'
import { useVoiceRecorder } from '../store/useVoiceRecorder'

export const ExportPanel = observer(function ExportPanel() {
  const recorder = useVoiceRecorder()
  const format = recorder.activeFormat

  const handleExport = async () => {
    try {
      const result = await recorder.exportAudio()
      if (result) {
        toast.success('Файл сохранён', {
          description: `${result.fileName} · ${formatBytes(result.size)}`,
        })
      }
    } catch (error) {
      toast.error('Не удалось сохранить файл', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  const progressPercent =
    recorder.exportProgress === null ? null : Math.round(recorder.exportProgress * 100)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Экспорт</CardTitle>
        <CardDescription>
          Выберите формат — файл соберётся прямо в браузере и сразу скачается.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Формат</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={2}
            value={recorder.exportFormat}
            onValueChange={(value) => {
              if (value) recorder.setExportFormat(value)
            }}
            className="flex-wrap"
            aria-label="Формат файла"
          >
            {recorder.formats.map((item) => (
              <ToggleGroupItem key={item.id} value={item.id} className="px-3 text-xs">
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">{format.description}</p>
        </div>

        {format.kind === 'mp3' && (
          <div className="space-y-2">
            <Label>Битрейт</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={2}
              value={String(recorder.mp3Bitrate)}
              onValueChange={(value) => {
                if (value) recorder.setMp3Bitrate(Number(value) as Mp3Bitrate)
              }}
              aria-label="Битрейт MP3"
            >
              {MP3_BITRATES.map((bitrate) => (
                <ToggleGroupItem
                  key={bitrate}
                  value={String(bitrate)}
                  className="px-3 text-xs"
                >
                  {bitrate} кбит/с
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="file-name">Имя файла</Label>
          <div className="flex items-center gap-2">
            <Input
              id="file-name"
              value={recorder.fileName}
              onChange={(event) => recorder.setFileName(event.target.value)}
              placeholder="recording"
              disabled={recorder.isExporting}
            />
            <span className="shrink-0 rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
              .{format.extension}
            </span>
          </div>
        </div>

        {format.kind === 'native' && (
          <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            <FileAudio className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {format.label} кодируется в реальном времени: экспорт займёт примерно столько же,
            сколько длится запись. Для мгновенного результата выберите WAV или MP3.
          </p>
        )}

        {progressPercent !== null && (
          <div className="space-y-1">
            <Progress value={progressPercent} />
            <p className="text-right text-xs text-muted-foreground">
              Перекодирование… {progressPercent}%
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {recorder.estimatedExportBytes !== null
              ? `Примерный размер: ${formatBytes(recorder.estimatedExportBytes)}`
              : 'Размер будет известен после кодирования'}
          </p>
          <Button
            onClick={() => void handleExport()}
            disabled={!recorder.hasAudio || recorder.isExporting}
            className="gap-1.5"
          >
            {recorder.isExporting ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            {recorder.isExporting ? 'Готовим файл…' : 'Скачать'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})
