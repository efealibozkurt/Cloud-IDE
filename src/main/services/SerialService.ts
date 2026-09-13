import { EventEmitter } from 'events'
import { SerialPort } from 'serialport'
import { LineEnding, SerialPortInfo } from '@shared/types'

/** Satır sonu seçimine göre gönderilecek ek karakterler (Arduino IDE ile aynı: NL+CR sırasıyla \n sonra \r) */
const SATIR_SONU_EKLERI: Record<LineEnding, string> = {
  none: '',
  nl: '\n',
  cr: '\r',
  nlcr: '\n\r'
}

/**
 * Seri port bağlantısını yöneten servis. IPC'den tamamen bağımsızdır;
 * gelen veriyi satır satır tamponlayıp tam satırlar oluştukça 'data'
 * olayı olarak yayar. Yarım kalan (satır sonu görülmemiş) veri bir
 * sonraki parçayla birleştirilmek üzere saklanır.
 */
export class SerialService extends EventEmitter {
  private port: SerialPort | null = null
  private yarimSatir = ''
  private acikPortYolu: string | null = null
  private acikBaud: number | null = null

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

  isOpen(): boolean {
    return this.port?.isOpen ?? false
  }

  aktifPort(): string | null {
    return this.acikPortYolu
  }

  aktifBaud(): number | null {
    return this.acikBaud
  }

  /** Belirtilen portu belirtilen baud hızıyla açar; zaten açık bir port varsa önce onu kapatır */
  async open(port: string, baud: number): Promise<void> {
    if (this.port?.isOpen) {
      await this.close()
    }

    await new Promise<void>((resolve, reject) => {
      const yeniPort = new SerialPort({ path: port, baudRate: baud, autoOpen: false })
      yeniPort.open((hata) => {
        if (hata) {
          reject(new Error(`Port açılamadı: ${hata.message}`))
          return
        }
        this.port = yeniPort
        this.acikPortYolu = port
        this.acikBaud = baud
        this.yarimSatir = ''
        this.dinleyicileriBagla(yeniPort)
        this.emit('status')
        resolve()
      })
    })
  }

  private dinleyicileriBagla(port: SerialPort): void {
    port.on('data', (parca: Buffer) => {
      // Gelen veriyi önceki yarım satırla birleştirip satırlara böl.
      // split sonucundaki SON eleman: parça bir satır sonuyla bitmediyse
      // yarım kalmış demektir, bir sonraki 'data' olayına taşınır.
      const birlesikMetin = this.yarimSatir + parca.toString('utf8')
      const satirlar = birlesikMetin.split(/\r\n|\r|\n/)
      this.yarimSatir = satirlar.pop() ?? ''
      const zamanDamgasi = Date.now()
      for (const satir of satirlar) {
        this.emit('data', satir, zamanDamgasi)
      }
    })
    port.on('close', () => {
      this.port = null
      this.acikPortYolu = null
      this.acikBaud = null
      this.emit('status')
    })
    port.on('error', () => {
      this.emit('status')
    })
  }

  /** Portu kapatır; zaten kapalıysa hata fırlatmadan sessizce döner */
  async close(): Promise<void> {
    if (!this.port || !this.port.isOpen) {
      this.port = null
      this.acikPortYolu = null
      this.acikBaud = null
      return
    }
    await new Promise<void>((resolve, reject) => {
      this.port!.close((hata) => {
        if (hata) {
          reject(new Error(`Port kapatılamadı: ${hata.message}`))
          return
        }
        resolve()
      })
    })
    this.port = null
    this.acikPortYolu = null
    this.acikBaud = null
    // Alttaki port'un kendi 'close' olayının zamanlamasına güvenmek yerine,
    // burada da açıkça yayınlayarak IPC katmanının durumu anında iletmesini
    // garanti ediyoruz.
    this.emit('status')
  }

  /** Porta veri yazar; seçilen satır sonu ekini otomatik ekler */
  async write(data: string, satirSonu: LineEnding): Promise<void> {
    if (!this.port || !this.port.isOpen) {
      throw new Error('Seri port açık değil')
    }
    const gonderilecekVeri = data + SATIR_SONU_EKLERI[satirSonu]
    await new Promise<void>((resolve, reject) => {
      this.port!.write(gonderilecekVeri, (hata) => {
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
  on(event: 'data', listener: (satir: string, zamanDamgasi: number) => void): this
  on(event: 'status', listener: () => void): this
  off(event: 'data', listener: (satir: string, zamanDamgasi: number) => void): this
  off(event: 'status', listener: () => void): this
}
