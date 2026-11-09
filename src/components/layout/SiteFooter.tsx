import { formatBuildDate, useBuildInfo } from '@/app/build-info'
import { site } from '@/app/site'

export function SiteFooter() {
  const buildInfo = useBuildInfo()
  const buildDate = buildInfo ? formatBuildDate(buildInfo.buildDate) : null

  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {site.name} — всё считается локально, данные не покидают браузер
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {buildInfo ? (
            <a
              href={`${site.repoUrl}/commit/${buildInfo.buildVersion}`}
              target="_blank"
              rel="noreferrer"
              title="Хэш и дата задеплоенной сборки"
              className="tabular-nums transition-colors hover:text-foreground"
            >
              сборка {buildInfo.buildVersion}
              {buildDate ? ` · ${buildDate}` : null}
            </a>
          ) : null}
          <a
            href={site.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Исходный код на GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
