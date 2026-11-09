import { describe, expect, it } from 'vitest'
import {
  TOOLS,
  TOOL_CATEGORIES,
  findCategory,
  getToolBySlug,
  toolHref,
} from './tools'

describe('реестр инструментов', () => {
  it('слаги уникальны и пригодны для URL', () => {
    const slugs = TOOLS.map((tool) => tool.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('у каждой записи заполнены тексты и теги', () => {
    for (const tool of TOOLS) {
      expect(tool.title.trim()).not.toBe('')
      expect(tool.description.trim()).not.toBe('')
      expect(tool.tags.length).toBeGreaterThan(0)
      expect(tool.icon).toBeTruthy()
    }
  })

  it('категория каждого инструмента есть в справочнике', () => {
    const ids = TOOL_CATEGORIES.map((category) => category.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const tool of TOOLS) {
      expect(findCategory(tool.category)).toBeDefined()
    }
  })

  it('в реестре только готовые инструменты — с ленивым компонентом', () => {
    expect(TOOLS.length).toBeGreaterThan(0)
    for (const tool of TOOLS) {
      expect(tool.component).toBeDefined()
    }
  })
})

describe('getToolBySlug', () => {
  it('находит инструмент по слагу', () => {
    const tool = getToolBySlug('voice-recorder')
    expect(tool?.title).toBe('Запись голоса')
    expect(toolHref(tool!)).toBe('/tools/voice-recorder')
  })

  it('возвращает undefined для неизвестного слага', () => {
    expect(getToolBySlug('nope')).toBeUndefined()
  })

  it('находит редактор видео в категории «Видео»', () => {
    const tool = getToolBySlug('video-editor')
    expect(tool?.category).toBe('video')
    expect(findCategory('video')?.label).toBe('Видео')
    expect(toolHref(tool!)).toBe('/tools/video-editor')
  })
})

