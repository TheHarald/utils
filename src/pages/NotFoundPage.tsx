import { Link } from 'react-router-dom'
import { ArrowLeft, CircleHelp } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <CircleHelp className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 font-heading text-2xl font-semibold tracking-tight">Страница не найдена</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Такого инструмента пока нет. Возможно, он ещё в разработке — загляните на главную и выберите
        что-то из списка.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">
          <ArrowLeft className="size-4" aria-hidden="true" />
          На главную
        </Link>
      </Button>
    </div>
  )
}
