import Store from 'electron-store'
import {
  AppSettings,
  DEFAULT_BAUD_RATE,
  DEFAULT_BOARD_MANAGER_URLS,
  DEFAULT_EDITOR_FONT_SIZE,
  DEFAULT_EDITOR_THEME
} from '@shared/types'

const VARSAYILAN_AYARLAR: AppSettings = {
  arduinoCliPath: null,
  boardManagerUrls: [...DEFAULT_BOARD_MANAGER_URLS],
  selectedFqbn: null,
  selectedPort: null,
  selectedBaud: DEFAULT_BAUD_RATE,
  recentSketches: [],
  lastOpenedSketch: null,
  editorFontSize: DEFAULT_EDITOR_FONT_SIZE,
  editorTheme: DEFAULT_EDITOR_THEME,
  selectedAiProvider: null,
  selectedModelPerProvider: {},
  selectedReasoningEffort: 'medium',
  customContextLimits: {}
}

/**
 * electron-store üzerinden kalıcı ayarları okuyup yazan ince servis.
 * IPC'den bağımsızdır; diğer servisler (ArduinoCliService, DeviceLock vb.)
 * bu sınıfı doğrudan çağırarak ayarlara erişebilir.
 */
export class SettingsService {
  private store: Store<AppSettings>

  constructor() {
    this.store = new Store<AppSettings>({
      name: 'settings',
      defaults: VARSAYILAN_AYARLAR
    })
  }

  getAll(): AppSettings {
    return {
      arduinoCliPath: this.store.get('arduinoCliPath'),
      boardManagerUrls: this.store.get('boardManagerUrls'),
      selectedFqbn: this.store.get('selectedFqbn'),
      selectedPort: this.store.get('selectedPort'),
      selectedBaud: this.store.get('selectedBaud'),
      recentSketches: this.store.get('recentSketches'),
      lastOpenedSketch: this.store.get('lastOpenedSketch'),
      editorFontSize: this.store.get('editorFontSize'),
      editorTheme: this.store.get('editorTheme'),
      selectedAiProvider: this.store.get('selectedAiProvider'),
      selectedModelPerProvider: this.store.get('selectedModelPerProvider') || {},
      selectedReasoningEffort: this.store.get('selectedReasoningEffort') || 'medium',
      customContextLimits: this.store.get('customContextLimits') || {}
    }
  }

  get<K extends keyof AppSettings>(anahtar: K): AppSettings[K] {
    return this.store.get(anahtar)
  }

  set<K extends keyof AppSettings>(anahtar: K, deger: AppSettings[K]): AppSettings {
    this.store.set(anahtar, deger)
    return this.getAll()
  }

  /** Son açılan sketch listesine ekler; en yeni başta, en fazla 10 kayıt tutulur */
  sonAcilanaEkle(sketchKlasoru: string): void {
    const mevcut = this.store.get('recentSketches').filter((yol) => yol !== sketchKlasoru)
    const guncellenmis = [sketchKlasoru, ...mevcut].slice(0, 10)
    this.store.set('recentSketches', guncellenmis)
    this.store.set('lastOpenedSketch', sketchKlasoru)
  }

  /** Sketch klasörü yeniden adlandırıldığında eski yolu yenisiyle günceller */
  eskiSketchYolunuGuncelle(eskiYol: string, yeniYol: string): void {
    const mevcut = this.store.get('recentSketches').map((yol) => (yol === eskiYol ? yeniYol : yol))
    this.store.set('recentSketches', mevcut)
    if (this.store.get('lastOpenedSketch') === eskiYol) {
      this.store.set('lastOpenedSketch', yeniYol)
    }
  }
}
