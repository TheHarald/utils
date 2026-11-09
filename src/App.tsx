import { Route, Routes } from 'react-router-dom'
import { PageLayout } from '@/components/layout/PageLayout'
import HomePage from '@/features/home/HomePage'
import NotFoundPage from '@/pages/NotFoundPage'
import ToolRoute from './app/ToolRoute'

export default function App() {
  return (
    <PageLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tools/:slug" element={<ToolRoute />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </PageLayout>
  )
}
