import { promises as fs } from 'fs'
import { join } from 'path'
import type {
  KutuphaneSembolIndeksi,
  KutuphaneSembolKaydi,
  KutuphaneUyeSembolu,
  LibraryInfo
} from '@shared/types'
import { anahtarKelimeleriOku, basliktanSembolCikar } from './knowledge/libraryApi'

export interface KutuphaneListesiKaynagi {
  listLibraries: (force?: boolean) => Promise<LibraryInfo[]>
}

const AZAMI_KUTUPHANE = 120
const AZAMI_BASLIK_DOSYASI = 6
const AZAMI_DOSYA_BOYUTU = 256 * 1024
const AZAMI_KUTUPHANE_UYE = 120
const AZAMI_KUTUPHANE_SABIT = 80
const AZAMI_ANAHTAR_KELIME = 80

/**
 * Kurulu Arduino kütüphanelerinin başlık (`.h`/`.hpp`) dosyalarını ve `keywords.txt`
 * tanımlarını yerel olarak tarayarak çevrimdışı editör otomatik tamamlama indeksini oluşturur.
 */
export class KutuphaneSembolServisi {
  private onbellek: KutuphaneSembolIndeksi | null = null
  private onbellekParmakIzi = ''
  private yukleniyor: Promise<KutuphaneSembolIndeksi> | null = null

  constructor(private readonly cli: KutuphaneListesiKaynagi) {}

  onbellegiTemizle(): void {
    this.onbellek = null
    this.onbellekParmakIzi = ''
  }

  async sembolleriGetir(force = false): Promise<KutuphaneSembolIndeksi> {
    if (force) {
      this.onbellegiTemizle()
      if (this.yukleniyor) {
        await this.yukleniyor.catch(() => {})
      }
    } else if (this.yukleniyor) {
      return this.yukleniyor
    }

    const gorev = this.indeksiDerle(force)
    this.yukleniyor = gorev
    try {
      return await gorev
    } finally {
      if (this.yukleniyor === gorev) {
        this.yukleniyor = null
      }
    }
  }

  private async indeksiDerle(force: boolean): Promise<KutuphaneSembolIndeksi> {
    let kutuphaneler: LibraryInfo[]
    try {
      kutuphaneler = await this.cli.listLibraries(force)
    } catch {
      return this.onbellek ?? { olusturulmaZamani: Date.now(), kutuphaneler: [] }
    }

    const parmakIzi = kutuphaneler
      .map((k) => `${k.name}@${k.version}|${k.installDir}`)
      .sort()
      .join('\n')

    if (!force && this.onbellek && this.onbellekParmakIzi === parmakIzi) {
      return this.onbellek
    }

    const kayitlar: KutuphaneSembolKaydi[] = []
    for (const kut of kutuphaneler.slice(0, AZAMI_KUTUPHANE)) {
      const kayit = await this.kutuphaneyiTara(kut)
      if (kayit) kayitlar.push(kayit)
    }

    const indeks: KutuphaneSembolIndeksi = {
      olusturulmaZamani: Date.now(),
      kutuphaneler: kayitlar
    }
    this.onbellek = indeks
    this.onbellekParmakIzi = parmakIzi
    return indeks
  }

  private async kutuphaneyiTara(kut: LibraryInfo): Promise<KutuphaneSembolKaydi | null> {
    if (!kut.installDir) return null

    const adayDizinler = [join(kut.installDir, 'src'), kut.installDir]
    const baslikYollari: Array<{ ad: string; tamYol: string }> = []
    const gorulenBasliklar = new Set<string>()
    const kisaAd = kut.name.toLowerCase().replace(/[^a-z0-9]/g, '')

    for (const dizin of adayDizinler) {
      let dosyalar: string[]
      try {
        dosyalar = (await fs.readdir(dizin)).filter((d) => /\.(h|hpp)$/i.test(d))
      } catch {
        continue
      }

      const oncelik = (d: string): number => {
        const kok = d.replace(/\.(h|hpp)$/i, '').toLowerCase().replace(/[^a-z0-9]/g, '')
        return kok && (kok === kisaAd || kok.startsWith(kisaAd) || kisaAd.startsWith(kok)) ? 0 : 1
      }
      dosyalar.sort((a, b) => oncelik(a) - oncelik(b) || a.localeCompare(b))

      for (const dosya of dosyalar) {
        const kucuk = dosya.toLowerCase()
        if (gorulenBasliklar.has(kucuk)) continue
        gorulenBasliklar.add(kucuk)
        baslikYollari.push({ ad: dosya, tamYol: join(dizin, dosya) })
        if (baslikYollari.length >= AZAMI_BASLIK_DOSYASI) break
      }
      if (baslikYollari.length >= AZAMI_BASLIK_DOSYASI) break
    }

    const siniflar: string[] = []
    const sinifSeti = new Set<string>()
    const uyeler: KutuphaneUyeSembolu[] = []
    const uyeAnahtarlari = new Set<string>()
    const sabitler: string[] = []
    const sabitSeti = new Set<string>()
    const basliklar: string[] = []

    for (const baslik of baslikYollari) {
      try {
        const st = await fs.stat(baslik.tamYol)
        if (!st.isFile()) continue
        basliklar.push(baslik.ad)
        if (st.size > AZAMI_DOSYA_BOYUTU) continue

        const icerik = await fs.readFile(baslik.tamYol, 'utf-8')
        const cikarilan = basliktanSembolCikar(icerik)

        for (const s of cikarilan.siniflar) {
          if (!sinifSeti.has(s)) {
            sinifSeti.add(s)
            siniflar.push(s)
          }
        }
        for (const sb of cikarilan.sabitler) {
          if (sabitler.length >= AZAMI_KUTUPHANE_SABIT) break
          if (!sabitSeti.has(sb)) {
            sabitSeti.add(sb)
            sabitler.push(sb)
          }
        }
        for (const u of cikarilan.uyeler) {
          if (uyeler.length >= AZAMI_KUTUPHANE_UYE) break
          const anahtar = `${u.sinif ?? ''}#${u.ad}#${u.parametreler}`
          if (!uyeAnahtarlari.has(anahtar)) {
            uyeAnahtarlari.add(anahtar)
            uyeler.push(u)
          }
        }
      } catch {
        // Tekil okuma hatasında diğer başlıklarla devam et
      }
    }

    const uyeAdSeti = new Set(uyeler.map((u) => u.ad))
    let anahtarKelimeler: string[] = []
    try {
      const kwIcerik = await fs.readFile(join(kut.installDir, 'keywords.txt'), 'utf-8')
      anahtarKelimeler = anahtarKelimeleriOku(kwIcerik)
        .filter((k) => !sinifSeti.has(k) && !uyeAdSeti.has(k) && !sabitSeti.has(k))
        .slice(0, AZAMI_ANAHTAR_KELIME)
    } catch {
      // keywords.txt yoksa sorun değil
    }

    if (basliklar.length === 0 && siniflar.length === 0 && uyeler.length === 0 && anahtarKelimeler.length === 0) {
      return null
    }

    return {
      kutuphane: kut.name,
      surum: kut.version,
      aciklama: kut.sentence,
      basliklar,
      siniflar,
      uyeler,
      sabitler,
      anahtarKelimeler
    }
  }
}
