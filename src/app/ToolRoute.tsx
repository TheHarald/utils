import { Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { PageLoader } from '@/components/PageLoader'
import NotFoundPage from '@/pages/NotFoundPage'
import { getToolBySlug } from './tools'

/** Маршрут /tools/:slug — берёт инструмент из реестра и грузит его лениво. */
export default function ToolRoute() {
  const { slug } = useParams<{ slug: string }>()
  const tool = slug ? getToolBySlug(slug) : undefined
  const ToolComponent = tool?.component

  if (!tool || !ToolComponent) {
    return <NotFoundPage />
  }

  return (
    <Suspense fallback={<PageLoader label="Загружаем инструмент…" />}>
      <ToolComponent />
    </Suspense>
  )
}
