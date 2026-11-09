import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { AudioLines, Clapperboard, type LucideIcon } from 'lucide-react'

export type ToolCategory =
  | 'audio'
  | 'video'
  | 'text'
  | 'data'
  | 'web'
  | 'image'
  | 'security'
  | 'time'

export interface ToolCategoryInfo {
  id: ToolCategory
  label: string
}

export interface ToolDefinition {
  slug: string
  title: string
  description: string
  icon: LucideIcon
  category: ToolCategory
  tags: string[]
  /** Загружается лениво: код инструмента не попадает в основной бандл. */
  component: LazyExoticComponent<ComponentType>
}

export const TOOL_CATEGORIES: ToolCategoryInfo[] = [
  { id: 'audio', label: 'Аудио' },
  { id: 'video', label: 'Видео' },
  { id: 'text', label: 'Текст' },
  { id: 'data', label: 'Данные' },
  { id: 'web', label: 'Веб' },
  { id: 'image', label: 'Изображения' },
  { id: 'security', label: 'Безопасность' },
  { id: 'time', label: 'Время' },
]

/**
 * Реестр инструментов — единственное место, куда нужно добавить запись,
 * чтобы новый инструмент появился на главной и получил свой маршрут.
 * Здесь только работающие инструменты: карточек-анонсов без страницы нет.
 */
export const TOOLS: ToolDefinition[] = [
  {
    slug: 'voice-recorder',
    title: 'Запись голоса',
    description:
      'Запишите голос с микрофона, обрежьте лишнее, уберите тишину и скачайте в WAV, MP3 или другом формате.',
    icon: AudioLines,
    category: 'audio',
    tags: ['микрофон', 'mp3', 'wav', 'обрезка'],
    component: lazy(() => import('@/features/voice-recorder/VoiceRecorderPage')),
  },
  {
    slug: 'video-editor',
    title: 'Редактор видео',
    description:
      'Соберите ролик из нескольких видео: обрежьте фрагменты, поменяйте их местами и скачайте готовый файл.',
    icon: Clapperboard,
    category: 'video',
    tags: ['видео', 'монтаж', 'обрезка', 'webm'],
    component: lazy(() => import('@/features/video-editor/VideoEditorPage')),
  },
]

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.slug === slug)
}

export function toolHref(tool: ToolDefinition): string {
  return `/tools/${tool.slug}`
}

export function findCategory(id: ToolCategory): ToolCategoryInfo | undefined {
  return TOOL_CATEGORIES.find((category) => category.id === id)
}
