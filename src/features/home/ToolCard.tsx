import { ArrowRight, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { findCategory, toolHref, type ToolDefinition } from '@/app/tools'

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  const category = findCategory(tool.category)
  const isAvailable = tool.status === 'available'
  const Icon = tool.icon

  const body = (
    <>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              'flex size-10 items-center justify-center rounded-xl',
              isAvailable
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          {isAvailable ? (
            <Badge variant="secondary">Готово</Badge>
          ) : (
            <Badge variant="outline">
              <Clock aria-hidden="true" />
              Скоро
            </Badge>
          )}
        </div>
        <CardTitle className="mt-1 text-base">{tool.title}</CardTitle>
        <CardDescription className="line-clamp-2">{tool.description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{category?.label ?? 'Инструмент'}</span>
        {isAvailable ? (
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            Открыть
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        ) : (
          <span>В разработке</span>
        )}
      </CardContent>
    </>
  )

  if (!isAvailable) {
    return (
      <Card className="h-full opacity-70" aria-disabled="true">
        {body}
      </Card>
    )
  }

  return (
    <Link
      to={toolHref(tool)}
      className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:ring-foreground/20">
        {body}
      </Card>
    </Link>
  )
}
