import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import {
  AudioLines,
  Binary,
  Clock,
  Code,
  FileImage,
  FileJson2,
  Fingerprint,
  Hash,
  KeyRound,
  Palette,
  QrCode,
  Type,
  type LucideIcon,
} from 'lucide-react'

export type ToolCategory = 'audio' | 'text' | 'data' | 'web' | 'image' | 'security' | 'time'

export type ToolStatus = 'available' | 'soon'

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
  status: ToolStatus
  tags: string[]
  /** Загружается лениво: код инструмента не попадает в основной бандл. */
  component?: LazyExoticComponent<ComponentType>
}

export const TOOL_CATEGORIES: ToolCategoryInfo[] = [
  { id: 'audio', label: 'Аудио' },
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
 */
export const TOOLS: ToolDefinition[] = [
  {
    slug: 'voice-recorder',
    title: 'Запись голоса',
    description:
      'Запишите голос с микрофона, обрежьте лишнее, уберите тишину и скачайте в WAV, MP3 или другом формате.',
    icon: AudioLines,
    category: 'audio',
    status: 'available',
    tags: ['микрофон', 'mp3', 'wav', 'обрезка'],
    component: lazy(() => import('@/features/voice-recorder/VoiceRecorderPage')),
  },
  {
    slug: 'json-formatter',
    title: 'JSON-форматтер',
    description: 'Форматирование, минификация и проверка JSON с подсветкой ошибок.',
    icon: FileJson2,
    category: 'data',
    status: 'soon',
    tags: ['json', 'валидация'],
  },
  {
    slug: 'base64',
    title: 'Base64',
    description: 'Кодирование и декодирование текста и файлов в Base64.',
    icon: Binary,
    category: 'data',
    status: 'soon',
    tags: ['base64', 'кодирование'],
  },
  {
    slug: 'qr-code',
    title: 'QR-генератор',
    description: 'Быстрое создание QR-кодов для ссылок и текста со скачиванием в SVG.',
    icon: QrCode,
    category: 'web',
    status: 'soon',
    tags: ['qr', 'svg'],
  },
  {
    slug: 'color-converter',
    title: 'Цвета',
    description: 'Конвертер HEX, RGB, HSL и OKLCH с проверкой контраста.',
    icon: Palette,
    category: 'web',
    status: 'soon',
    tags: ['hex', 'rgb', 'oklch'],
  },
  {
    slug: 'hash-generator',
    title: 'Хеши',
    description: 'MD5, SHA-1, SHA-256 и SHA-512 для текста и файлов — локально в браузере.',
    icon: Fingerprint,
    category: 'security',
    status: 'soon',
    tags: ['sha256', 'md5'],
  },
  {
    slug: 'password-generator',
    title: 'Генератор паролей',
    description: 'Надёжные пароли и passphrase с настройкой длины и алфавита.',
    icon: KeyRound,
    category: 'security',
    status: 'soon',
    tags: ['пароли', 'passphrase'],
  },
  {
    slug: 'image-converter',
    title: 'Конвертер изображений',
    description: 'Сжатие и конвертация PNG, JPEG, WebP и AVIF прямо в браузере.',
    icon: FileImage,
    category: 'image',
    status: 'soon',
    tags: ['png', 'webp', 'сжатие'],
  },
  {
    slug: 'timestamp-converter',
    title: 'Timestamp',
    description: 'Перевод Unix-времени в дату и обратно, с учётом часового пояса.',
    icon: Clock,
    category: 'time',
    status: 'soon',
    tags: ['unix', 'дата'],
  },
  {
    slug: 'regex-tester',
    title: 'Regex-тестер',
    description: 'Проверка регулярных выражений с подсветкой совпадений и группами.',
    icon: Code,
    category: 'text',
    status: 'soon',
    tags: ['regex', 'regexp'],
  },
  {
    slug: 'text-case',
    title: 'Регистр текста',
    description: 'Смена регистра, транслитерация и очистка текста от лишних символов.',
    icon: Type,
    category: 'text',
    status: 'soon',
    tags: ['текст', 'транслит'],
  },
  {
    slug: 'uuid-generator',
    title: 'UUID',
    description: 'Генерация UUID v4 и коротких идентификаторов пачками.',
    icon: Hash,
    category: 'data',
    status: 'soon',
    tags: ['uuid', 'id'],
  },
]

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.slug === slug)
}

export function toolHref(tool: ToolDefinition): string {
  return `/tools/${tool.slug}`
}

export function countToolsByStatus(): { available: number; soon: number } {
  return TOOLS.reduce(
    (acc, tool) => {
      if (tool.status === 'available') acc.available += 1
      else acc.soon += 1
      return acc
    },
    { available: 0, soon: 0 },
  )
}

export function findCategory(id: ToolCategory): ToolCategoryInfo | undefined {
  return TOOL_CATEGORIES.find((category) => category.id === id)
}
