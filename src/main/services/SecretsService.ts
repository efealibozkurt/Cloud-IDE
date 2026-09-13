import { safeStorage } from 'electron'
import Store from 'electron-store'
import { AIProviderId } from '@shared/types'

interface SecretsSemasi {
  /** Sağlayıcı başına, base64'e çevrilmiş `safeStorage.encryptString()` çıktısı */
  encryptedKeys: Partial<Record<AIProviderId, string>>
}

/**
 * API anahtarlarını işletim sistemi düzeyinde şifreleyerek saklayan servis.
 * `settings.json`'dan (SettingsService) BİLİNÇLİ olarak ayrı bir dosyada
 * (`secrets.json`) tutulur ki genel ayarlar `settings:get` ile renderer'a
 * toptan gönderilirken anahtarlar asla bu akışa karışmasın. Aynı sebeple bu
 * sınıfın bir "getApiKey" metodu YOKTUR — şifre çözme (v0.2'de gerçek bir AI
 * çağrısı yapılacağı zaman main process içinde, IPC'ye hiç çıkmadan)
 * ihtiyaç doğduğunda eklenecektir; bugün için yalnızca yazma ve "ayarlı mı"
 * sorgusu yeterlidir.
 *
 * `safeStorage` Windows'ta DPAPI, macOS'ta Keychain, Linux'ta Secret
 * Service/kwallet kullanır; şifrelenmiş veri yalnızca aynı bilgisayardaki
 * aynı kullanıcı hesabıyla çözülebilir.
 */
export class SecretsService {
  private store = new Store<SecretsSemasi>({
    name: 'secrets',
    defaults: { encryptedKeys: {} }
  })

  setApiKey(provider: AIProviderId, apiKey: string): void {
    const guvenliAnahtar = apiKey.trim()
    if (!guvenliAnahtar) {
      throw new Error('API anahtarı boş olamaz')
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        'Bu bilgisayarda güvenli (şifreli) depolama kullanılamıyor; API anahtarı güvenlik nedeniyle kaydedilmedi.'
      )
    }
    const sifrelenmis = safeStorage.encryptString(guvenliAnahtar).toString('base64')
    const tumAnahtarlar = this.store.get('encryptedKeys')
    this.store.set('encryptedKeys', { ...tumAnahtarlar, [provider]: sifrelenmis })
  }

  clearApiKey(provider: AIProviderId): void {
    const tumAnahtarlar = { ...this.store.get('encryptedKeys') }
    delete tumAnahtarlar[provider]
    this.store.set('encryptedKeys', tumAnahtarlar)
  }

  /** Hangi sağlayıcılar için bir anahtar kayıtlı olduğunu döner (anahtarların kendisini DEĞİL) */
  getConfiguredProviders(): AIProviderId[] {
    const tumAnahtarlar = this.store.get('encryptedKeys')
    return (Object.keys(tumAnahtarlar) as AIProviderId[]).filter((id) => Boolean(tumAnahtarlar[id]))
  }

  /**
   * Yalnızca main process içindeki servislerin (LlmService) kullanımına sunulan
   * ve işletim sistemi düzeyinde çözülen API anahtarını döner. Renderer'a ASLA gönderilmez.
   */
  getDecryptedApiKey(provider: AIProviderId): string | null {
    const tumAnahtarlar = this.store.get('encryptedKeys')
    const sifreli = tumAnahtarlar[provider]
    if (!sifreli) {
      if (provider === 'lmstudio') {
        return 'lm-studio' // Yerel LM Studio sunucusu için varsayılan token
      }
      return null
    }
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return null
      }
      const buffer = Buffer.from(sifreli, 'base64')
      return safeStorage.decryptString(buffer)
    } catch (err) {
      console.error(`API anahtarı çözülemedi (${provider}):`, err)
      return null
    }
  }
}
