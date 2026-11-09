import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { ArrowLeft, Clapperboard, Fingerprint, Keyboard, Scissors, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipInspector } from './components/ClipInspector'
import { ExportPanel } from './components/ExportPanel'
import { ImportPanel } from './components/ImportPanel'
import { PreviewPanel } from './components/PreviewPanel'
import { TimelinePanel } from './components/TimelinePanel'
import { useVideoEditor } from './store/useVideoEditor'

const VideoEditorPage = observer(function VideoEditorPage() {
  const editor = useVideoEditor()

  // Уходя со страницы, останавливаем предпросмотр: файлы остаются в памяти вкладки.
  useEffect(
    () => () => {
      editor.pause()
    },
    [editor],
  )

  // Пробел — смотреть / пауза, если фокус не в поле ввода.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || target?.isContentEditable) {
        return
      }
      event.preventDefault()
      editor.togglePlayback()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editor])

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-6 pb-16">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link to="/">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Все инструменты
        </Link>
      </Button>

      <header className="flex flex-wrap items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Clapperboard className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Редактор видео
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Соберите ролик из нескольких файлов: обрежьте лишнее, поменяйте фрагменты местами и
            скачайте готовое видео. Всё происходит в браузере — файлы не загружаются на сервер.
          </p>
        </div>
      </header>

      {editor.error && (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {editor.error}
        </p>
      )}

      <div className="mt-6 space-y-4">
        <ImportPanel />

        {editor.hasClips ? (
          <>
            <PreviewPanel />
            <TimelinePanel />
            <div className="grid gap-4 lg:grid-cols-2">
              <ClipInspector />
              <ExportPanel />
            </div>
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Как это работает</CardTitle>
              <CardDescription>
                Три шага — и ролик готов. Ничего не нужно устанавливать.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                  <Sparkles className="size-4" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium">Добавьте видео</p>
                <p className="text-xs text-muted-foreground">
                  Перетащите файлы или выберите их на диске — сразу появится шкала.
                </p>
              </div>
              <div className="space-y-1">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                  <Scissors className="size-4" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium">Смонтируйте</p>
                <p className="text-xs text-muted-foreground">
                  Режьте по курсору, обрезайте края фрагментов и меняйте их порядок.
                </p>
              </div>
              <div className="space-y-1">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                  <Clapperboard className="size-4" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium">Скачайте</p>
                <p className="text-xs text-muted-foreground">
                  Выберите высоту кадра и звук — браузер запишет файл без сервера.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <section className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border/60 px-4 py-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Keyboard className="size-3.5" aria-hidden="true" />
            Пробел — смотреть / пауза
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Fingerprint className="size-3.5" aria-hidden="true" />
            Видео не покидает устройство
          </span>
        </section>
      </div>
    </div>
  )
})

export default VideoEditorPage
