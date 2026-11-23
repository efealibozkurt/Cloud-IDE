import React from 'react'
import { arayuzGunluguKur } from './utils/arayuzGunlugu'
import ReactDOM from 'react-dom/client'
// Tüm monaco-editor paketi yerine çekirdek editör + temel düzenleyici katkıları
// (suggest/hover/parameterHints/snippet/codicon/find vb.) + C++ dil desteği
// içe aktarılır. Diğer onlarca dil paketi ve ağır worker'lar dışarıda bırakılır.
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import 'monaco-editor/esm/vs/editor/editor.all'
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution'
import { loader } from '@monaco-editor/react'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import App from './App'
import { LanguageProvider } from './i18n'
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

arayuzGunluguKur()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
)
