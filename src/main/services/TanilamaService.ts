import { app } from 'electron'
import { arch, homedir, totalmem, type, userInfo, release } from 'os'
import type { TanilamaVerisi } from '@shared/types'
import { surumAdiBul } from '@shared/surumAdlari'
import type { ArduinoCliService } from './ArduinoCliService'
import { logSatirlari } from './LogTamponu'

/** Sorun raporu için sistem bilgisini toplar. Hiçbir kimlik bilgisi ya da proje içeriği okumaz. */
export class TanilamaService {
  constructor(private readonly cli: ArduinoCliService) {}

  async topla(): Promise<TanilamaVerisi> {
    const [durum, cekirdekler, kutuphaneler] = await Promise.all([
      this.cli.getStatus().catch(() => null),
      this.cli.listCores().catch(() => []),
      this.cli.listLibraries().catch(() => [])
    ])
    const surum = app.getVersion()
    let kullaniciAdi = ''
    try {
      kullaniciAdi = userInfo().username
    } catch {
      // bazı ortamlarda kullanıcı bilgisi alınamaz
    }
    return {
      sistem: {
        uygulamaSurumu: surum,
        kodAdi: surumAdiBul(surum).ad,
        electron: process.versions.electron ?? '?',
        chrome: process.versions.chrome ?? '?',
        node: process.versions.node ?? '?',
        isletimSistemi: `${type()} ${release()}`,
        mimari: arch(),
        ramGb: Math.round(totalmem() / 1024 ** 3),
        cliSurumu: durum?.version ?? null,
        kartPaketleri: cekirdekler.filter((c) => c.installedVersion).map((c) => ({ id: c.id, surum: c.installedVersion as string })),
        kutuphaneler: kutuphaneler.map((k) => ({ ad: k.name, surum: k.version })),
        anaGunluk: logSatirlari()
      },
      temizleme: { anaDizin: homedir(), kullaniciAdi }
    }
  }
}
