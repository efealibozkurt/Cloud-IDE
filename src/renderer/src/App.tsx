import { useEffect, useRef, useState, type ReactElement } from 'react'
import TopBar from './components/layout/TopBar'
import Sidebar, { type SidebarTab } from './components/layout/Sidebar'
import EditorArea from './components/layout/EditorArea'
import BottomPanel, { type BottomPanelTab } from './components/layout/BottomPanel'
import CliStatusBanner from './components/common/CliStatusBanner'
import AIModeScreen, { type AIModeOrigin } from './components/ai/AIModeScreen'
import DretAIPanel from './components/ai/DretAIPanel'
import SettingsModal from './components/settings/SettingsModal'
import SplashScreen from './components/splash/SplashScreen'
import DeveloperMessageModal, { DEVELOPER_MESSAGE_STORAGE_KEY } from './components/common/DeveloperMessageModal'
import { ToastProvider } from './state/ToastContext'
import { AppStateProvider, useAppState } from './state/AppStateContext'

/**
 * Uygulamanın kök bileşeni. Global sağlayıcıları (Toast, AppState) kurar;
 * gerçek düzen ve etkileşim mantığı AppShell'de, bu sağlayıcıların içinde
 * çalışır (useAppState hook'una erişebilmek için).
 */
function App(): ReactElement {
  return (
    <ToastProvider>
      <AppStateProvider>
        <AppShell />
      </AppStateProvider>
    </ToastProvider>
  )
}

/**
 * Üç bölgeli düzeni kurar; bölgeler arası paylaşılan gezinme durumunu
 * (aktif sekmeler, alt panelin açık/kapalı olması), klavye kısayollarını
 * ve pencere kapatma onayı akışını yönetir.
 */
function AppShell(): ReactElement {
  const {
    state,
    saveTab,
    compileActive,
    uploadActive,
    newSketch,
    openSketchDialog,
    closeTab,
    hasUnsavedChanges,
    toggleDretAi,
    closeDretAi
  } = useAppState()
  const [appVersion, setAppVersion] = useState('0.0.0')
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('dosyalar')
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true)
  const [bottomPanelTab, setBottomPanelTab] = useState<BottomPanelTab>('cikti')
  const [aiModeOrigin, setAiModeOrigin] = useState<AIModeOrigin | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [developerMessageOpen, setDeveloperMessageOpen] = useState(false)
  const [splashGorunur, setSplashGorunur] = useState(true)
  const [asgariSureTamam, setAsgariSureTamam] = useState(false)
  const oncekiIslemRef = useRef<string | null>(null)

  useEffect(() => {
    window.api.app.getVersion().then(setAppVersion)
  }, [])

  // Açılış ekranı, gerçek başlangıç verisi yüklenmiş olsa BİLE en az bu kadar
  // görünsün ki hızlı sistemlerde bir anlık yanıp sönme gibi görünmesin.
  useEffect(() => {
    const zamanlayici = setTimeout(() => setAsgariSureTamam(true), 1200)
    return () => clearTimeout(zamanlayici)
  }, [])

  // Açılış ekranı tamamlandığında eğer kullanıcı "bir daha gösterme"
  // seçmediyse geliştiriciden mesaj modalını aç.
  const handleSplashTamamlandi = (): void => {
    setSplashGorunur(false)
    const gizle = localStorage.getItem(DEVELOPER_MESSAGE_STORAGE_KEY) === 'true'
    if (!gizle) {
      setDeveloperMessageOpen(true)
    }
  }

  const toggleSerialMonitor = (): void => {
    if (bottomPanelOpen && bottomPanelTab === 'seri') {
      setBottomPanelOpen(false)
      return
    }
    setBottomPanelTab('seri')
    setBottomPanelOpen(true)
  }

  // Derleme/yükleme başlayınca Çıktı sekmesini otomatik öne getir; derleme
  // hatayla bitince Problems sekmesine geç.
  useEffect(() => {
    const onceki = oncekiIslemRef.current
    const simdi = state.build.currentOperation
    if (simdi && !onceki) {
      setBottomPanelOpen(true)
      setBottomPanelTab('cikti')
    }
    if (!simdi && onceki === 'compile' && state.build.errors.length > 0) {
      setBottomPanelTab('problems')
    }
    oncekiIslemRef.current = simdi
  }, [state.build.currentOperation, state.build.errors])

  // Klavye kısayolları: Ctrl+S kaydet, Ctrl+R derle, Ctrl+U yükle,
  // Ctrl+Shift+M seri monitör, Ctrl+N yeni, Ctrl+O aç, Ctrl+W sekme kapat
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return
      const tus = e.key.toLowerCase()
      if (tus === 's') {
        e.preventDefault()
        if (state.sketch.activeTabPath) void saveTab(state.sketch.activeTabPath)
      } else if (tus === 'r') {
        e.preventDefault()
        void compileActive()
      } else if (tus === 'u') {
        e.preventDefault()
        void uploadActive()
      } else if (tus === 'n') {
        e.preventDefault()
        void newSketch()
      } else if (tus === 'o') {
        e.preventDefault()
        void openSketchDialog()
      } else if (tus === 'w') {
        e.preventDefault()
        if (state.sketch.activeTabPath) closeTab(state.sketch.activeTabPath)
      } else if (e.shiftKey && tus === 'm') {
        e.preventDefault()
        toggleSerialMonitor()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sketch.activeTabPath, saveTab, compileActive, uploadActive, newSketch, openSketchDialog, closeTab])

  // Pencere kapatılmak istendiğinde main process bu olayı gönderir;
  // kaydedilmemiş değişiklik varsa kullanıcıya sorup cevabı main'e iletiriz.
  useEffect(() => {
    return window.api.window.onCloseRequested(() => {
      if (!hasUnsavedChanges()) {
        window.api.window.replyCloseRequest(true)
        return
      }
      const devamEt = window.confirm('Kaydedilmemiş değişiklikler var. Kaydetmeden çıkılsın mı?')
      window.api.window.replyCloseRequest(devamEt)
    })
  }, [hasUnsavedChanges])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <TopBar
        appVersion={appVersion}
        onToggleSerialMonitor={toggleSerialMonitor}
        serialMonitorActive={bottomPanelOpen && bottomPanelTab === 'seri'}
        onOpenAiMode={(origin) => setAiModeOrigin(origin)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenDeveloperMessage={() => setDeveloperMessageOpen(true)}
        onToggleDretAi={toggleDretAi}
        dretAiActive={state.dretAi.open}
      />
      <CliStatusBanner />

      <div className="flex min-h-0 flex-1">
        <Sidebar activeTab={sidebarTab} onTabChange={setSidebarTab} />
        <EditorArea />
        {state.dretAi.open && <DretAIPanel onClose={closeDretAi} />}
      </div>

      {bottomPanelOpen && (
        <BottomPanel
          activeTab={bottomPanelTab}
          onTabChange={setBottomPanelTab}
          onClose={() => setBottomPanelOpen(false)}
        />
      )}

      {aiModeOrigin && <AIModeScreen origin={aiModeOrigin} onClose={() => setAiModeOrigin(null)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {developerMessageOpen && <DeveloperMessageModal onClose={() => setDeveloperMessageOpen(false)} />}
      {splashGorunur && (
        <SplashScreen hazir={state.ready && asgariSureTamam} onTamamlandi={handleSplashTamamlandi} />
      )}
    </div>
  )
}

export default App
