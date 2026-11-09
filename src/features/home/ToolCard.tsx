import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { findCategory, toolHref, type ToolDefinition } from '@/app/tools'

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  const category = findCategory(tool.category)
  const Icon = tool.icon

  return (
    <Link
      to={toolHref(tool)}
      className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:ring-foreground/20">
        <CardHeader>
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <CardTitle className="mt-1 text-base">{tool.title}</CardTitle>
          <CardDescription className="line-clamp-2">{tool.description}</CardDescription>
        </CardHeader>
        <CardContent className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{category?.label ?? 'Инструмент'}</span>
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            Открыть
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
