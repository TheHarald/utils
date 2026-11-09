import { useEffect, useState } from 'react'

/** Содержимое `/info.json`, которое генерирует CI перед сборкой. */
export interface BuildInfo {
  buildDate: string
  buildVersion: string
}

function isBuildInfo(value: unknown): value is BuildInfo {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<BuildInfo>
  return typeof candidate.buildDate === 'string' && typeof candidate.buildVersion === 'string'
}

/**
 * Разбор `/info.json`. Терпит BOM (файл могли сохранить из PowerShell) и мусор:
 * при любой проблеме возвращает null, а не бросает исключение.
 */
export function parseBuildInfo(raw: string): BuildInfo | null {
  try {
    const data: unknown = JSON.parse(raw.replace(/^\uFEFF/, ''))
    return isBuildInfo(data) ? data : null
  } catch {
    return null
  }
}

/**
 * Версия задеплоенной сборки. Файл создаёт workflow, поэтому локально его нет —
 * в этом случае хук просто возвращает null, и футер не показывает версию.
 */
export function useBuildInfo(): BuildInfo | null {
  const [info, setInfo] = useState<BuildInfo | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const url = `${import.meta.env.BASE_URL}info.json`

    async function load(): Promise<void> {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) return
        const parsed = parseBuildInfo(await response.text())
        if (parsed) setInfo(parsed)
      } catch {
        /* локальная разработка, офлайн или битый файл — версию просто не показываем */
      }
    }

    void load()

    return () => controller.abort()
  }, [])

  return info
}

export function formatBuildDate(value: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
