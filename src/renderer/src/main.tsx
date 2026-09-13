import React from 'react'
import ReactDOM from 'react-dom/client'
// Tüm monaco-editor paketi yerine yalnızca çekirdek editör + C++ dil
// desteği içe aktarılır. Aksi hâlde @monaco-editor/react'in varsayılan
// yükleyicisi TypeScript, JSON, HTML, Python vb. onlarca dilin tamamını
// (birkaç MB) pakete dahil eder; bu da ilk açılışı gereksiz yere
// yavaşlatır.
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution'
import { loader } from '@monaco-editor/react'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import App from './App'
import './index.css'

/**
 * Monaco'yu CDN yerine yerel (npm) paketten yükletir; strict CSP
 * (script-src 'self') altında dış domainlere istek atılmasını engeller.
 * C++ dilinin kendine özgü bir worker'ı yoktur, bu yüzden tüm istekler
 * için temel editor worker'ı yeterlidir.
 */
self.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker()
  }
}
loader.config({ monaco })

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
