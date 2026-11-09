import { voiceRecorderStore } from './instance'
import type { VoiceRecorderStore } from './VoiceRecorderStore'

/** Доступ к стору «Запись голоса». */
export function useVoiceRecorder(): VoiceRecorderStore {
  return voiceRecorderStore
}
