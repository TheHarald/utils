import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { ArrowLeft, AudioLines, Fingerprint, Keyboard } from 'lucide-react'
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
import { formatDuration } from '@/lib/format'
import { useStore } from '@/stores/storeContext'
import { useVoiceRecorder } from './store/useVoiceRecorder'
import { EditorPanel } from './components/EditorPanel'
import { ExportPanel } from './components/ExportPanel'
import { PlaybackControls } from './components/PlaybackControls'
import { RecorderPanel } from './components/RecorderPanel'
import { Waveform } from './components/Waveform'

const VoiceRecorderPage = observer(function VoiceRecorderPage() {
  const recorder = useVoiceRecorder()
  const { theme } = useStore()

  // Уходя со страницы, завершаем активную запись и останавливаем воспроизведение.
  useEffect(
    () => () => {
      if (recorder.status === 'recording' || recorder.status === 'paused') {
        void recorder.stopRecording()
      }
      recorder.stopPlayback()
    },
    [recorder],
  )

  // Пробел — быстрый play/pause, если фокус не в поле ввода.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || target?.isContentEditable) {
        return
      }
      event.preventDefault()
      recorder.togglePlayback()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [recorder])

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
          <AudioLines className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Запись голоса
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Запишите голос, обрежьте лишнее и скачайте файл в нужном формате. Всё происходит в
            браузере — запись не отправляется на сервер.
          </p>
        </div>
      </header>

      <div className="mt-6 space-y-4">
        <RecorderPanel />

        {recorder.pcm && (
          <Card>
            <CardHeader>
              <CardTitle>Волна</CardTitle>
              <CardDescription>
                Клик — перемотка, протяжка — выделение фрагмента, двойной клик — выделить всё.
              </CardDescription>
              <CardAction>
                <Badge variant="secondary" className="font-mono">
                  {formatDuration(recorder.duration)}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <Waveform
                pcm={recorder.pcm}
                selectionStart={recorder.selectionStart}
                selectionEnd={recorder.selectionEnd}
                playhead={recorder.playhead}
                themeKey={theme.resolvedMode}
                onSeek={(time) => recorder.seek(time)}
                onSelectionChange={(start, end) => recorder.setSelection(start, end)}
              />
              <PlaybackControls />
            </CardContent>
          </Card>
        )}

        {recorder.hasAudio && (
          <>
            <EditorPanel />
            <ExportPanel />
          </>
        )}

        <section className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border/60 px-4 py-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Keyboard className="size-3.5" aria-hidden="true" />
            Пробел — слушать / пауза
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Fingerprint className="size-3.5" aria-hidden="true" />
            Запись не покидает устройство
          </span>
        </section>
      </div>
    </div>
  )
})

export default VoiceRecorderPage
