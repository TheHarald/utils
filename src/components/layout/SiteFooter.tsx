import { site } from '@/app/site'

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {site.name} — всё считается локально, данные не покидают браузер
        </p>
        <a
          href={site.repoUrl}
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-foreground"
        >
          Исходный код на GitHub
        </a>
      </div>
    </footer>
  )
}
