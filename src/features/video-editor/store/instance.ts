import { VideoEditorStore } from './VideoEditorStore'

/**
 * Стор инструмента создаётся один раз на вкладку и живёт вне React-дерева:
 * так импортированные файлы и монтаж сохраняются при переходах между страницами.
 * Модуль попадает в ленивый чанк инструмента вместе с плеером и экспортом.
 */
export const videoEditorStore = new VideoEditorStore()
