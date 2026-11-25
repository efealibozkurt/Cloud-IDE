import { EventEmitter } from 'events'
import { SerialPort } from 'serialport'
import { LineEnding, SerialPortInfo } from '@shared/types'
import { izinIpucuylaBirlestir } from '../utils/seriPortIzni'

/** Satır sonu seçimine göre gönderilecek ek karakterler (Arduino IDE ile aynı: NL+CR sırasıyla \n sonra \r) */
const SATIR_SONU_EKLERI: Record<LineEnding, string> = {
  none: '',
  nl: '\n',
  cr: '\r',
  nlcr: '\n\r'
}

const MAKS_TAMPON = 1000

export interface SeriKayit {
  satir: string
  zaman: number
  port: string
}

interface Oturum {
  port: SerialPort
  yol: string
  baud: number
  /** Satır sonu görülmemiş, bir sonraki parçayla birleştirilecek veri */
  yarimSatir: string
}

/**
 * Seri port bağlantılarını yöneten servis. Aynı anda birden çok port açık olabilir
 * (örn. iki kart yan yana izlenirken). IPC'den tamamen bağımsızdır; gelen veriyi
 * port başına satır satır tamponlayıp tam satırlar oluştukça 'data' olayı olarak
 * yayar. "Birincil" port, en son açılan ve hâlâ açık olan porttur; port belirtmeyen
 * eski çağrılar (kapat/yaz) onu hedefler.
 */
export class SerialService extends EventEmitter {
  private oturumlar = new Map<string, Oturum>()
  /** Açılış sırası: sonuncusu birincil port */
  private sira: string[] = []
  /** Son gelen seri çıktı satırları (AI teşhis araçları için dairesel tampon) */
  private tampon: SeriKayit[] = []

  /** Sistemdeki tüm seri portları listeler (serialport paketi üzerinden, arduino-cli'den bağımsız) */
  async listPorts(): Promise<SerialPortInfo[]> {
    const portlar = await SerialPort.list()
    return portlar.map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer,
      vendorId: p.vendorId,
      productId: p.productId
    }))
  }

  /** Port verilirse o port, verilmezse herhangi biri açık mı */
  isOpen(port?: string): boolean {
    if (port) return this.oturumlar.get(port)?.port.isOpen ?? false
    return this.oturumlar.size > 0
  }

  /** Birincil (en son açılan) portun yolu */
  aktifPort(): string | null {
    return this.sira.length ? this.sira[this.sira.length - 1] : null
  }

  aktifBaud(): number | null {
    const yol = this.aktifPort()
    return yol ? (this.oturumlar.get(yol)?.baud ?? null) : null
  }

  baudAl(port: string): number | null {
    return this.oturumlar.get(port)?.baud ?? null
  }

  acikPortlar(): Array<{ port: string; baud: number }> {
    return this.sira.flatMap((yol) => {
      const o = this.oturumlar.get(yol)
      return o ? [{ port: yol, baud: o.baud }] : []
    })
  }

  /** Dairesel tampondaki son seri çıktı satırlarını döner. */
  sonSatirlar(secenekler?: { port?: string; limit?: number }): SeriKayit[] {
    const limit = Math.min(300, Math.max(1, Math.floor(secenekler?.limit ?? 80)))
    const port = secenekler?.port
    const liste = port ? this.tampon.filter((k) => k.port === port) : this.tampon
    return liste.slice(-limit).map((k) => ({ ...k }))
  }

  /** Tampondaki kayıtları port bazlı ya da tamamen temizler. */
  tamponuTemizle(port?: string): void {
    if (port) this.tampon = this.tampon.filter((k) => k.port !== port)
    else this.tampon = []
  }

  /** Belirtilen süre boyunca (veya satır sınırına dek) canlı gelen seri çıktı satırlarını toplar. */
  satirBekle(secenekler: {
    port?: string
    sureMs: number
    enFazlaSatir?: number
    signal?: AbortSignal
  }): Promise<SeriKayit[]> {
    const { port, signal } = secenekler
    if (signal?.aborted) return Promise.resolve([])
    const sureMs = Math.min(8000, Math.max(50, Math.floor(secenekler.sureMs)))
    const enFazla = Math.min(200, Math.max(1, Math.floor(secenekler.enFazlaSatir ?? 80)))

    return new Promise((resolve) => {
      const toplanan: SeriKayit[] = []
      let bitti = false
      let zamanlayici: ReturnType<typeof setTimeout> | null = null

      const bitir = (): void => {
        if (bitti) return
        bitti = true
        this.off('data', dinleyici)
        if (zamanlayici) clearTimeout(zamanlayici)
        signal?.removeEventListener('abort', onAbort)
        resolve(toplanan)
      }

      const onAbort = (): void => bitir()

      const dinleyici = (satir: string, zaman: number, gelenPort: string): void => {
        if (port && gelenPort !== port) return
        toplanan.push({ satir, zaman, port: gelenPort })
        if (toplanan.length >= enFazla) bitir()
      }

      this.on('data', dinleyici)
      signal?.addEventListener('abort', onAbort, { once: true })
      zamanlayici = setTimeout(bitir, sureMs)
    })
  }

  /** Belirtilen portu belirtilen baud hızıyla açar; aynı port zaten açıksa önce onu yeniden açar. Diğer portlara dokunmaz. */
  async open(port: string, baud: number): Promise<void> {
    if (this.oturumlar.has(port)) await this.close(port)

    await new Promise<void>((resolve, reject) => {
      const yeniPort = new SerialPort({ path: port, baudRate: baud, autoOpen: false })
      yeniPort.open((hata) => {
        if (hata) {
          reject(new Error(izinIpucuylaBirlestir(`Port açılamadı: ${hata.message}`)))
          return
        }
        const oturum: Oturum = { port: yeniPort, yol: port, baud, yarimSatir: '' }
        this.oturumlar.set(port, oturum)
        this.sira = this.sira.filter((y) => y !== port)
        this.sira.push(port)
        this.dinleyicileriBagla(oturum)
        this.emit('status')
        resolve()
      })
    })
  }

  private dinleyicileriBagla(oturum: Oturum): void {
    const { port, yol } = oturum
    port.on('data', (parca: Buffer) => {
      // Gelen veriyi önceki yarım satırla birleştirip satırlara böl.
      // split sonucundaki SON eleman: parça bir satır sonuyla bitmediyse
      // yarım kalmış demektir, bir sonraki 'data' olayına taşınır.
      const birlesikMetin = oturum.yarimSatir + parca.toString('utf8')
      const satirlar = birlesikMetin.split(/\r\n|\r|\n/)
      oturum.yarimSatir = satirlar.pop() ?? ''
      const zamanDamgasi = Date.now()
      for (const satir of satirlar) {
        this.tampon.push({ satir, zaman: zamanDamgasi, port: yol })
        if (this.tampon.length > MAKS_TAMPON) {
          this.tampon.splice(0, this.tampon.length - MAKS_TAMPON)
        }
        this.emit('data', satir, zamanDamgasi, yol)
      }
    })
    port.on('close', () => {
      // Aynı yol için yeni bir oturum açılmışsa (yeniden bağlanma) ona dokunma
      if (this.oturumlar.get(yol) === oturum) this.oturumuKaldir(yol)
      this.emit('status')
    })
    port.on('error', () => {
      this.emit('status')
    })
  }

  private oturumuKaldir(yol: string): void {
    this.oturumlar.delete(yol)
    this.sira = this.sira.filter((y) => y !== yol)
  }

  /** Portu kapatır (verilmezse birincil portu); zaten kapalıysa hata fırlatmadan sessizce döner */
  async close(port?: string): Promise<void> {
    const yol = port ?? this.aktifPort()
    if (!yol) return
    const oturum = this.oturumlar.get(yol)
    if (!oturum || !oturum.port.isOpen) {
      this.oturumuKaldir(yol)
      return
    }
    await new Promise<void>((resolve, reject) => {
      oturum.port.close((hata) => {
        if (hata) {
          reject(new Error(`Port kapatılamadı: ${hata.message}`))
          return
        }
        resolve()
      })
    })
    if (this.oturumlar.get(yol) === oturum) this.oturumuKaldir(yol)
    // Alttaki port'un kendi 'close' olayının zamanlamasına güvenmek yerine,
    // burada da açıkça yayınlayarak IPC katmanının durumu anında iletmesini
    // garanti ediyoruz.
    this.emit('status')
  }

  async closeAll(): Promise<void> {
    for (const yol of [...this.sira]) await this.close(yol)
  }

  /** Porta (verilmezse birincil porta) veri yazar; seçilen satır sonu ekini otomatik ekler */
  async write(data: string, satirSonu: LineEnding, port?: string): Promise<void> {
    const yol = port ?? this.aktifPort()
    const oturum = yol ? this.oturumlar.get(yol) : undefined
    if (!oturum || !oturum.port.isOpen) {
      throw new Error('Seri port açık değil')
    }
    const gonderilecekVeri = data + SATIR_SONU_EKLERI[satirSonu]
    await new Promise<void>((resolve, reject) => {
      oturum.port.write(gonderilecekVeri, (hata) => {
        if (hata) {
          reject(new Error(`Veri gönderilemedi: ${hata.message}`))
          return
        }
        resolve()
      })
    })
  }
}

export declare interface SerialService {
  on(event: 'data', listener: (satir: string, zamanDamgasi: number, port: string) => void): this
  on(event: 'status', listener: () => void): this
  off(event: 'data', listener: (satir: string, zamanDamgasi: number, port: string) => void): this
  off(event: 'status', listener: () => void): this
}
