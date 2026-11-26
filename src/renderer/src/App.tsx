import { useEffect, useRef, useState, type ReactElement } from 'react'
import KartTanimaBandi from './components/common/KartTanimaBandi'
import TopBar from './components/layout/TopBar'
import Sidebar, { type SidebarTab } from './components/layout/Sidebar'
import EditorArea from './components/layout/EditorArea'
import BottomPanel, { type BottomPanelTab } from './components/layout/BottomPanel'
import SagPanel, { type SagSekme } from './components/layout/SagPanel'
import SerialMonitor, { type SeriHedef } from './components/serial/SerialMonitor'
import CliStatusBanner from './components/common/CliStatusBanner'
import AIModeScreen, { type AIModeOrigin } from './components/ai/AIModeScreen'
import AgentPanel from './components/ai/AgentPanel'
import SettingsModal from './components/settings/SettingsModal'
import SplashScreen from './components/splash/SplashScreen'
import { TurOtomatikBaslat, YardimProvider } from './state/HelpContext'
import DilSecimi from './components/common/DilSecimi'
import { dilSecilmisMi } from './i18n'
import DeveloperMessageModal, { DEVELOPER_MESSAGE_STORAGE_KEY } from './components/common/DeveloperMessageModal'
import { ToastProvider } from './state/ToastContext'
import { AppStateProvider, useAppState } from './state/AppStateContext'
import { AgentProvider } from './state/AgentContext'
import { cevir } from './i18n'

const SERI_KONUM_ANAHTARI = 'cloud_ide_seri_konum'
type SeriKonum = 'sag' | 'alt'

function kayitliSeriKonumu(): SeriKonum {
  try {
    return localStorage.getItem(SERI_KONUM_ANAHTARI) === 'alt' ? 'alt' : 'sag'
  } catch {
    return 'sag'
  }
}

/**
 * Uygulamanın kök bileşeni. Global sağlayıcıları (Toast, AppState) kurar;
 * gerçek düzen ve etkileşim mantığı AppShell'de, bu sağlayıcıların içinde
 * çalışır (useAppState hook'una erişebilmek için).
 */
function App(): ReactElement {
  return (
    <ToastProvider>
      <AppStateProvider>
        <AgentProvider>
          <AppShell />
        </AgentProvider>
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
    openInNewWindow,
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
  const [dilSecimiAcik, setDilSecimiAcik] = useState(() => !dilSecilmisMi())
  const [asgariSureTamam, setAsgariSureTamam] = useState(false)
  const oncekiIslemRef = useRef<string | null>(null)

  // Seri monitör: yerleşik konumu (sağ/alt) hatırlanır, tam ekran geçicidir
  const [seriKonum, setSeriKonum] = useState<SeriKonum>(kayitliSeriKonumu)
  const [sagSeriAcik, setSagSeriAcik] = useState(false)
  const [seriTam, setSeriTam] = useState(false)
  const [sagSekme, setSagSekme] = useState<SagSekme>('seri')
  const sagSeri = seriKonum === 'sag' && sagSeriAcik
  const sagAi = state.dretAi.open
  const sagAktif: SagSekme = sagSeri && sagAi ? sagSekme : sagSeri ? 'seri' : 'ai'
  const seriGorunur =
    seriTam || (seriKonum === 'sag' ? sagSeri && sagAktif === 'seri' : bottomPanelOpen && bottomPanelTab === 'seri')

  // Cloud AI açılınca (ya da ona yeni bir soru gönderilince) sağ alanda öne gelsin
  useEffect(() => {
    if (state.dretAi.open) setSagSekme('ai')
  }, [state.dretAi.open])
  useEffect(() => {
    if (!state.dretAi.seed) return
    setSagSekme('ai')
    setSeriTam(false)
  }, [state.dretAi.seed])

  useEffect(() => {
    window.api.app.getVersion().then(setAppVersion)
  }, [])

  // Açılış ekranı, gerçek başlangıç verisi yüklenmiş olsa BİLE en az bu kadar
  // görünsün ki hızlı sistemlerde bir anlık yanıp sönme gibi görünmesin.
  useEffect(() => {
    const zamanlayici = setTimeout(() => setAsgariSureTamam(true), 1000)
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
    if (seriTam) {
      setSeriTam(false)
      return
    }
    if (seriKonum === 'sag') {
      if (seriGorunur) {
        setSagSeriAcik(false)
      } else {
        setSagSeriAcik(true)
        setSagSekme('seri')
      }
      return
    }
    if (seriGorunur) {
      setBottomPanelOpen(false)
      return
    }
    setBottomPanelTab('seri')
    setBottomPanelOpen(true)
  }
  // Klavye kısayolu dinleyicisi her zaman güncel durumu görsün
  const seriDegistirRef = useRef(toggleSerialMonitor)
  seriDegistirRef.current = toggleSerialMonitor

  const seriKonumunuSec = (hedef: SeriHedef): void => {
    if (hedef === 'tam') {
      setSeriTam(true)
      return
    }
    setSeriTam(false)
    if (hedef === 'cik') return
    setSeriKonum(hedef)
    try {
      localStorage.setItem(SERI_KONUM_ANAHTARI, hedef)
    } catch {
      // yalnızca bu oturumda geçerli olur
    }
    if (hedef === 'sag') {
      setSagSeriAcik(true)
      setSagSekme('seri')
      setBottomPanelTab((s) => (s === 'seri' ? 'cikti' : s))
    } else {
      setSagSeriAcik(false)
      setBottomPanelTab('seri')
      setBottomPanelOpen(true)
    }
  }

  // Tam ekrandan Esc ile çık. Üstte bir pencere açıksa Esc ona kalır; yakalama aşamasında
  // dinlenir ki arkadaki editörün Esc işlemleri (örn. AI değişikliğini geri alma) tetiklenmesin.
  useEffect(() => {
    if (!seriTam) return
    const tus = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (settingsOpen || developerMessageOpen || aiModeOrigin || document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      e.stopImmediatePropagation()
      setSeriTam(false)
    }
    window.addEventListener('keydown', tus, true)
    return () => window.removeEventListener('keydown', tus, true)
  }, [seriTam, settingsOpen, developerMessageOpen, aiModeOrigin])

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
        if (e.shiftKey) {
          void openInNewWindow()
        } else {
          void newSketch()
        }
      } else if (tus === 'o') {
        e.preventDefault()
        void openSketchDialog()
      } else if (tus === 'w') {
        e.preventDefault()
        if (state.sketch.activeTabPath) closeTab(state.sketch.activeTabPath)
      } else if (e.shiftKey && tus === 'm') {
        e.preventDefault()
        seriDegistirRef.current()
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
      const devamEt = window.confirm(cevir('Kaydedilmemiş değişiklikler var. Kaydetmeden çıkılsın mı?'))
      window.api.window.replyCloseRequest(devamEt)
    })
  }, [hasUnsavedChanges])

  return (
    <YardimProvider surum={appVersion}>
    <TurOtomatikBaslat hazir={!splashGorunur && !developerMessageOpen && !dilSecimiAcik && state.ready} />
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <TopBar
        appVersion={appVersion}
        onToggleSerialMonitor={toggleSerialMonitor}
        serialMonitorActive={seriGorunur}
        onOpenAiMode={(origin) => setAiModeOrigin(origin)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenDeveloperMessage={() => setDeveloperMessageOpen(true)}
        onToggleDretAi={() => {
          // Cloud AI açık ama seri sekmesinin arkasındaysa kapatmak yerine öne getir
          if (sagAi && sagAktif !== 'ai') setSagSekme('ai')
          else toggleDretAi()
        }}
        dretAiActive={sagAi && sagAktif === 'ai'}
      />
      <CliStatusBanner />
      <KartTanimaBandi />

      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <Sidebar activeTab={sidebarTab} onTabChange={setSidebarTab} />
            <EditorArea />
          </div>

          {bottomPanelOpen && (
            <BottomPanel
              activeTab={bottomPanelTab}
              onTabChange={setBottomPanelTab}
              onClose={() => setBottomPanelOpen(false)}
              seri={seriKonum === 'alt' ? (seriTam ? null : <SerialMonitor konum="alt" onKonum={seriKonumunuSec} />) : undefined}
            />
          )}
        </div>

        {(sagSeri || sagAi) && (
          <SagPanel
            seri={
              sagSeri ? (
                // Tam ekrandayken yer korunur ama monitör yalnızca bir kez gösterilir
                seriTam ? <div /> : <SerialMonitor konum="sag" onKonum={seriKonumunuSec} onKapat={() => setSagSeriAcik(false)} />
              ) : null
            }
            ai={sagAi ? <AgentPanel onClose={closeDretAi} /> : null}
            aktif={sagAktif}
            onSekme={setSagSekme}
          />
        )}

        {seriTam && (
          <div className="absolute inset-0 z-40 bg-panel-light">
            <SerialMonitor konum="tam" onKonum={seriKonumunuSec} />
          </div>
        )}
      </div>

      {aiModeOrigin && <AIModeScreen origin={aiModeOrigin} onClose={() => setAiModeOrigin(null)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {developerMessageOpen && <DeveloperMessageModal onClose={() => setDeveloperMessageOpen(false)} />}
      {dilSecimiAcik && <DilSecimi onSecildi={() => setDilSecimiAcik(false)} />}
      {splashGorunur && (
        <SplashScreen hazir={state.ready && asgariSureTamam} onTamamlandi={handleSplashTamamlandi} surum={appVersion === '0.0.0' ? undefined : appVersion} />
      )}
    </div>
    </YardimProvider>
  )
}

export default App
