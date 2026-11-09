import { useEffect, useRef, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { Pause, Play, SkipBack, Video, Volume2, VolumeX } from 'lucide-react'
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
import { clipDuration } from '../lib/timeline'
import { useVideoEditor } from '../store/useVideoEditor'

/** Допуск на «последний кадр»: видео редко доходит ровно до конца фрагмента. */
const END_GUARD = 0.05

/**
 * Предпросмотр монтажа: один `<video>`, который переключает источник
 * на файл текущего фрагмента и перематывается по общей шкале.
 */
export const PreviewPanel = observer(function PreviewPanel() {
  const editor = useVideoEditor()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(false)

  const clip = editor.currentClip
  const asset = clip ? (editor.assets.find((item) => item.id === clip.assetId) ?? null) : null
  const position = editor.currentPosition

  // Перемотка и смена фрагмента в паузе: ставим плеер на нужный кадр.
  useEffect(() => {
    const video = videoRef.current
    const current = editor.currentPosition
    if (!video || !current || editor.isPlaying || video.readyState < 1) return

    const desired = current.clip.start + current.localTime
    if (Math.abs(video.currentTime - desired) < 0.05) return
    video.currentTime = desired
  }, [editor, editor.playhead, editor.isPlaying, clip, asset])

  // Пока идёт проигрывание, курсор ведём по часам плеера, а не по таймеру.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (!editor.isPlaying) {
      video.pause()
      return
    }

    if (video.readyState >= 2 && video.paused) {
      void video.play().catch(() => editor.pause())
    }

    let frame = 0
    const tick = () => {
      const live = editor.currentPosition
      const element = videoRef.current
      if (!live || !element) return

      const length = clipDuration(live.clip)
      const local = element.currentTime - live.clip.start
      if (local >= length - END_GUARD) {
        const next = live.offset + length
        if (next >= editor.duration - END_GUARD) {
          element.pause()
          editor.seek(editor.duration)
          editor.pause()
          return
        }
        // Переходим на следующий фрагмент: эффект перезапустится для нового источника.
        editor.seek(next)
        return
      }

      editor.seek(live.offset + Math.max(local, 0))
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)

    return () => window.cancelAnimationFrame(frame)
  }, [editor, editor.isPlaying, editor.duration, clip?.id, asset?.url])

  const handleLoadedMetadata = () => {
    const video = videoRef.current
    const current = editor.currentPosition
    if (!video || !current) return

    const desired = current.clip.start + current.localTime
    if (Number.isFinite(desired) && Math.abs(video.currentTime - desired) > 0.05) {
      video.currentTime = desired
    }
    // Новый источник грузится заново — продолжение воспроизведения запускаем здесь.
    if (editor.isPlaying) void video.play().catch(() => editor.pause())
  }

  const handleEnded = () => {
    editor.pause()
    editor.seek(editor.duration)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Предпросмотр</CardTitle>
        <CardDescription>
          {clip && asset && position
            ? `${asset.name} · фрагмент ${position.index + 1} из ${editor.clips.length}`
            : 'Добавьте видео, чтобы начать монтаж'}
        </CardDescription>
        <CardAction>
          <Badge variant="secondary" className="font-mono">
            {formatDuration(editor.playhead)} / {formatDuration(editor.duration)}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-hidden rounded-xl bg-black">
          {asset ? (
            <video
              ref={videoRef}
              src={asset.url}
              muted={muted}
              playsInline
              preload="auto"
              className="mx-auto max-h-[55vh] w-full object-contain"
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
            />
          ) : (
            <div className="flex aspect-video items-center justify-center text-muted-foreground">
              <Video className="size-8" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              editor.pause()
              editor.seek(0)
            }}
            aria-label="В начало"
          >
            <SkipBack className="size-4" aria-hidden="true" />
          </Button>

          <Button
            onClick={() => editor.togglePlayback()}
            disabled={!editor.hasClips || editor.isExporting}
            className="gap-1.5"
            aria-label={editor.isPlaying ? 'Пауза' : 'Смотреть'}
          >
            {editor.isPlaying ? (
              <Pause className="size-4" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
            {editor.isPlaying ? 'Пауза' : 'Смотреть'}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setMuted((value) => !value)}
            aria-pressed={muted}
            aria-label={muted ? 'Включить звук' : 'Выключить звук'}
          >
            {muted ? (
              <VolumeX className="size-4" aria-hidden="true" />
            ) : (
              <Volume2 className="size-4" aria-hidden="true" />
            )}
          </Button>

          <span className="ml-auto text-xs text-muted-foreground">
            Пробел — смотреть / пауза
          </span>
        </div>
      </CardContent>
    </Card>
  )
})
