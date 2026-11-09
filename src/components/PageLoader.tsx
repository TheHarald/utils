import { LoaderCircle } from 'lucide-react'

export function PageLoader({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50svh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
