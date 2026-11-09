import type { ReactNode } from 'react'
import { rootStore } from './rootStore'
import { StoreContext } from './storeContext'

export function StoreProvider({ children }: { children: ReactNode }) {
  return <StoreContext.Provider value={rootStore}>{children}</StoreContext.Provider>
}
