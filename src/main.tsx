import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AppToaster } from '@/components/AppToaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { StoreProvider } from '@/stores/StoreProvider'
import './index.css'

// HashRouter выбран осознанно: GitHub Pages не умеет отдавать index.html
// для вложенных путей, а хеш-маршруты работают всегда.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <TooltipProvider delayDuration={200}>
        <HashRouter>
          <App />
          <AppToaster />
        </HashRouter>
      </TooltipProvider>
    </StoreProvider>
  </StrictMode>,
)
