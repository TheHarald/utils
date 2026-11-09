import { useMemo, useState, type ReactNode } from 'react'
import { Fingerprint, LayoutGrid, Search, Sparkles, X, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { site } from '@/app/site'
import { TOOLS, TOOL_CATEGORIES, countToolsByStatus, type ToolCategory } from '@/app/tools'
import { cn } from '@/lib/utils'
import { ToolCard } from './ToolCard'

const ALL_CATEGORIES = 'all' as const
type CategoryFilter = ToolCategory | typeof ALL_CATEGORIES

const HIGHLIGHTS = [
  {
    icon: Fingerprint,
    title: 'Данные остаются у вас',
    text: 'Записи и файлы обрабатываются локально и не отправляются на сервер.',
  },
  {
    icon: Zap,
    title: 'Без регистрации',
    text: 'Открыли, сделали дело, закрыли. Никаких аккаунтов и лимитов.',
  },
  {
    icon: LayoutGrid,
    title: 'Работает на любом устройстве',
    text: 'Интерфейс подстраивается под телефон, планшет и десктоп.',
  },
]

export default function HomePage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>(ALL_CATEGORIES)
  const stats = useMemo(() => countToolsByStatus(), [])

  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return TOOLS.filter((tool) => {
      if (category !== ALL_CATEGORIES && tool.category !== category) return false
      if (!normalized) return true
      return [tool.title, tool.description, ...tool.tags].some((value) =>
        value.toLowerCase().includes(normalized),
      )
    })
  }, [category, query])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20">
      <section className="relative overflow-hidden pt-14 pb-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[38rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="flex flex-col items-center text-center">
          <Badge variant="outline" className="gap-1.5">
            <Sparkles aria-hidden="true" />
            {stats.available} готово · {stats.soon} в разработке
          </Badge>
          <h1 className="mt-5 max-w-2xl font-heading text-4xl font-semibold tracking-tight text-balance-tight sm:text-5xl">
            Полезные утилиты, которые живут в браузере
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            {site.description}
          </p>

          <div className="relative mt-7 w-full max-w-md">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти инструмент: голос, json, цвет…"
              aria-label="Поиск инструментов"
              className="h-10 pr-9 pl-9"
            />
            {query.length > 0 && (
              <Button
                variant="ghost"
                size="icon-xs"
                className="absolute top-1/2 right-1.5 -translate-y-1/2"
                onClick={() => setQuery('')}
                aria-label="Очистить поиск"
              >
                <X aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </section>

      <section
        aria-label="Фильтр по категориям"
        className="flex flex-wrap items-center justify-center gap-2"
      >
        <CategoryChip
          active={category === ALL_CATEGORIES}
          onClick={() => setCategory(ALL_CATEGORIES)}
        >
          Все
        </CategoryChip>
        {TOOL_CATEGORIES.map((item) => (
          <CategoryChip
            key={item.id}
            active={category === item.id}
            onClick={() => setCategory(item.id)}
          >
            {item.label}
          </CategoryChip>
        ))}
      </section>

      <section className="mt-8">
        {filteredTools.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-sm font-medium">Ничего не нашлось</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Попробуйте другой запрос или выберите категорию «Все».
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-14 rounded-2xl border border-border/70 bg-muted/40 p-6 sm:p-8">
        <h2 className="font-heading text-lg font-semibold tracking-tight">Почему это удобно</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <div key={item.title}>
              <span className="flex size-9 items-center justify-center rounded-lg bg-background text-foreground ring-1 ring-border">
                <item.icon className="size-4" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
        active
          ? 'border-transparent bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
