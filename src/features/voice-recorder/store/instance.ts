import { VoiceRecorderStore } from './VoiceRecorderStore'

/**
 * Стор инструмента создаётся один раз на вкладку и живёт вне React-дерева:
 * так запись и правки сохраняются при переходах между страницами.
 * Модуль попадает в ленивый чанк инструмента вместе с кодеками.
 */
export const voiceRecorderStore = new VoiceRecorderStore()
