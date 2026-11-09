import { observer } from 'mobx-react-lite'
import { Toaster as SonnerToaster } from '@/components/ui/sonner'
import { useStore } from '@/stores/storeContext'

/** Уведомления shadcn/sonner, синхронизированные с нашей темой. */
export const AppToaster = observer(function AppToaster() {
  const { theme } = useStore()

  return (
    <SonnerToaster
      theme={theme.resolvedMode}
      position="bottom-right"
      closeButton
      toastOptions={{ classNames: { toast: 'cn-toast' } }}
    />
  )
})
