import { useRef, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { FilePlus2, LoaderCircle, Upload } from 'lucide-react'
import { toast } from 'sonner'
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
import { assetSummary } from '../lib/assets'
import { useVideoEditor } from '../store/useVideoEditor'

/** Импорт видеофайлов: drag&drop и выбор через диалог. Файлы остаются на устройстве. */
export const ImportPanel = observer(function ImportPanel() {
  const editor = useVideoEditor()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = async (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : []
    if (inputRef.current) inputRef.current.value = ''
    if (files.length === 0) return

    const outcome = await editor.importFiles(files)

    if (outcome.added.length > 0) {
      toast.success(`Добавлено видео: ${outcome.added.length}`, {
        description: outcome.added.map((asset) => asset.name).join(', '),
      })
    }
    if (outcome.failed.length > 0) {
      toast.error('Не удалось открыть файлы', {
        description: outcome.failed.map((item) => `«${item.name}»: ${item.reason}`).join(' '),
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Видео</CardTitle>
        <CardDescription>
          Перетащите файлы сюда или выберите на диске. Импорт читает только метаданные —
          файлы не отправляются на сервер.
        </CardDescription>
        <CardAction>
          <Badge variant="secondary" className="font-mono">
            файлов: {editor.assetCount}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            void handleFiles(event.dataTransfer.files)
          }}
          className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-border/70'
          }`}
        >
          <span className="flex size-11 items-center justify-center rounded-2xl bg-muted">
            {editor.status === 'importing' ? (
              <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="size-5" aria-hidden="true" />
            )}
          </span>

          <div className="space-y-1">
            <p className="text-sm font-medium">
              {editor.status === 'importing' ? 'Читаем видео…' : 'Перетащите видеофайлы'}
            </p>
            <p className="text-xs text-muted-foreground">MP4, WebM, MOV — до нескольких файлов</p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={!editor.canImport}
          >
            Выбрать файлы
          </Button>

          {!editor.canImport && !editor.isBusy && (
            <p className="text-xs text-destructive">
              Браузер не поддерживает работу с локальным видео
            </p>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />

        {editor.assets.length > 0 && (
          <ul className="space-y-2">
            {editor.assets.map((asset) => (
              <li
                key={asset.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{asset.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{assetSummary(asset)}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => editor.appendAsset(asset.id)}
                  disabled={editor.isExporting}
                >
                  <FilePlus2 className="size-3.5" aria-hidden="true" />
                  На шкалу
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
})
