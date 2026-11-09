import { Link, NavLink } from 'react-router-dom'
import { AudioLines } from 'lucide-react'
import { GithubMark } from '@/components/icons/GithubMark'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { site } from '@/app/site'
import { ThemeToggle } from './ThemeToggle'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-2 py-1 text-sm transition-colors hover:text-foreground',
    isActive ? 'text-foreground' : 'text-muted-foreground',
  )

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <AudioLines className="size-4" aria-hidden="true" />
          </span>
          <span className="font-heading text-sm font-semibold tracking-tight">{site.name}</span>
        </Link>

        <nav className="ml-3 hidden items-center gap-1 sm:flex" aria-label="Основная навигация">
          <NavLink to="/" end className={navLinkClass}>
            Все инструменты
          </NavLink>
          <NavLink to="/tools/voice-recorder" className={navLinkClass}>
            Запись голоса
          </NavLink>
          <NavLink to="/tools/video-editor" className={navLinkClass}>
            Редактор видео
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" asChild>
            <a href={site.repoUrl} target="_blank" rel="noreferrer" aria-label="Исходный код на GitHub">
              <GithubMark className="size-4" />
            </a>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
