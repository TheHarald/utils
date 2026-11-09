import { videoEditorStore } from './instance'
import type { VideoEditorStore } from './VideoEditorStore'

/** Доступ к стору «Редактор видео». */
export function useVideoEditor(): VideoEditorStore {
  return videoEditorStore
}
