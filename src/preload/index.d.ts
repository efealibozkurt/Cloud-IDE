import type { DretAPI } from '@shared/types'

// window.api için global tip bildirimi; renderer tarafında import gerektirmeden kullanılır
declare global {
  interface Window {
    api: DretAPI
  }
}
