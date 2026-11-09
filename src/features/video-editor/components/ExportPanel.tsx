import { observer } from 'mobx-react-lite'
import { Download, LoaderCircle, Video, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatBytes, formatDuration } from '@/lib/format'
import type { ExportFps, ExportHeight } from '../lib/export-settings'
import { useVideoEditor } from '../store/useVideoEditor'

/** Экспорт монтажа в видеофайл средствами браузера. */
export const ExportPanel = observer(function ExportPanel() {
  const editor = useVideoEditor()
  const size = editor.exportSize
  const progressPercent =
    editor.exportProgress === null ? null : Math.round(editor.exportProgress * 100)

  const handleExport = async () => {
    try {
      const result = await editor.exportVideo()
      if (result) {
        toast.success('Видео сохранено', {
          description: `${result.fileName} · ${formatBytes(result.size)}`,
        })
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.info('Экспорт отменён')
        return
      }
      toast.error('Не удалось сохранить видео', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Экспорт</CardTitle>
        <CardDescription>
          Ролик собирается в реальном времени: экспорт займёт примерно столько же, сколько
          длится монтаж.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="video-file-name">Имя файла</Label>
          <div className="flex items-center gap-2">
            <Input
              id="video-file-name"
              value={editor.fileName}
              onChange={(event) => editor.setFileName(event.target.value)}
              placeholder="video"
              disabled={editor.isExporting}
            />
            <span className="shrink-0 rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
              .{editor.exportExtension}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Высота кадра</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={2}
            value={String(editor.exportHeight)}
            onValueChange={(value) => {
              if (value) editor.setExportHeight(Number(value) as ExportHeight)
            }}
            disabled={editor.isExporting}
            aria-label="Высота кадра"
          >
            {editor.exportHeights.map((height) => (
              <ToggleGroupItem key={height} value={String(height)} className="px-3 text-xs">
                {height}p
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="font-mono text-xs text-muted-foreground">
            Итоговый кадр: {size.width}×{size.height}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Частота кадров</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={2}
            value={String(editor.exportFps)}
            onValueChange={(value) => {
              if (value) editor.setExportFps(Number(value) as ExportFps)
            }}
            disabled={editor.isExporting}
            aria-label="Частота кадров"
          >
            {editor.exportFpsOptions.map((fps) => (
              <ToggleGroupItem key={fps} value={String(fps)} className="px-3 text-xs">
                {fps} к/с
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <div className="min-w-0">
            <Label htmlFor="include-audio">Звук</Label>
            <p className="text-xs text-muted-foreground">Дорожка из исходных файлов</p>
          </div>
          <Switch
            id="include-audio"
            checked={editor.includeAudio}
            disabled={editor.isExporting}
            onCheckedChange={(checked) => editor.setIncludeAudio(checked === true)}
          />
        </div>

        {!editor.exportSupported && (
          <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            Этот браузер не умеет записывать canvas в видео. Откройте инструмент в Chrome,
            Edge или Firefox.
          </p>
        )}

        {progressPercent !== null && (
          <div className="space-y-1">
            <Progress value={progressPercent} />
            <p className="text-right text-xs text-muted-foreground">
              Записываем кадры… {progressPercent}%
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Video className="size-3.5 shrink-0" aria-hidden="true" />
            {editor.estimatedExportBytes !== null
              ? `≈ ${formatBytes(editor.estimatedExportBytes)} · ${formatDuration(editor.duration)}`
              : 'Добавьте фрагменты на шкалу'}
          </p>

          <div className="flex gap-2">
            {editor.isExporting && (
              <Button variant="outline" onClick={() => editor.cancelExport()} className="gap-1.5">
                <X className="size-4" aria-hidden="true" />
                Отменить
              </Button>
            )}
            <Button
              onClick={() => void handleExport()}
              disabled={!editor.hasClips || editor.isExporting || !editor.exportSupported}
              className="gap-1.5"
            >
              {editor.isExporting ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              {editor.isExporting ? 'Записываем…' : 'Скачать видео'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
