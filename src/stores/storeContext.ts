import { createContext, useContext } from 'react'
import { rootStore, type RootStore } from './rootStore'

export const StoreContext = createContext<RootStore>(rootStore)

/** Доступ к корневому стору из любого компонента. */
export function useStore(): RootStore {
  return useContext(StoreContext)
}
