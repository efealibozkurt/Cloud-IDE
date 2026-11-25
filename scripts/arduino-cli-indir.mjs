// Uygulamaya gömülecek arduino-cli ikilisini resmi GitHub sürüm sayfasından indirir, SHA-256 ile doğrular
// ve resources/arduino-cli/ klasörüne çıkarır. Linux/macOS paketleri bu betikle hazırlanır (CI'da çalışır).
//
//   node scripts/arduino-cli-indir.mjs                 → çalışılan platform/mimari için
//   node scripts/arduino-cli-indir.mjs linux x64       → belirli hedef için
//
// Windows için arduino-cli.exe şimdilik elle yerleştirilir (README'ye bakın).
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SURUM = process.env.ARDUINO_CLI_SURUMU ?? '1.5.1'
const platform = process.argv[2] ?? process.platform
const mimari = process.argv[3] ?? process.arch

const ARSIV_ADLARI = {
  'linux-x64': `arduino-cli_${SURUM}_Linux_64bit.tar.gz`,
  'linux-arm64': `arduino-cli_${SURUM}_Linux_ARM64.tar.gz`,
  'darwin-x64': `arduino-cli_${SURUM}_macOS_64bit.tar.gz`,
  'darwin-arm64': `arduino-cli_${SURUM}_macOS_ARM64.tar.gz`
}
const arsivAdi = ARSIV_ADLARI[`${platform}-${mimari}`]
if (!arsivAdi) {
  console.error(`Desteklenmeyen hedef: ${platform}-${mimari}`)
  process.exit(1)
}

const kok = join(dirname(fileURLToPath(import.meta.url)), '..')
const hedefKlasor = join(kok, 'resources', 'arduino-cli')
const hedefDosya = join(hedefKlasor, 'arduino-cli')
const tabanAdres = `https://github.com/arduino/arduino-cli/releases/download/v${SURUM}`

async function indir(adres) {
  const yanit = await fetch(adres, { redirect: 'follow' })
  if (!yanit.ok) throw new Error(`${adres} indirilemedi: HTTP ${yanit.status}`)
  return Buffer.from(await yanit.arrayBuffer())
}

console.log(`arduino-cli ${SURUM} indiriliyor: ${arsivAdi}`)
const [arsiv, ozetler] = await Promise.all([
  indir(`${tabanAdres}/${arsivAdi}`),
  indir(`${tabanAdres}/arduino-cli_${SURUM}_checksums.txt`).then((b) => b.toString('utf-8'))
])

// Resmi checksums dosyasıyla karşılaştır: bozuk ya da değiştirilmiş arşiv pakete girmesin
const beklenen = ozetler
  .split('\n')
  .map((s) => s.trim().split(/\s+/))
  .find((p) => p[1] === arsivAdi)?.[0]
const gercek = createHash('sha256').update(arsiv).digest('hex')
if (!beklenen || beklenen.toLowerCase() !== gercek) {
  console.error(`SHA-256 uyuşmadı! beklenen=${beklenen ?? 'yok'} gerçek=${gercek}`)
  process.exit(1)
}

const gecici = mkdtempSync(join(tmpdir(), 'arduino-cli-'))
try {
  const arsivYolu = join(gecici, arsivAdi)
  writeFileSync(arsivYolu, arsiv)
  const sonuc = spawnSync('tar', ['-xzf', arsivYolu, '-C', gecici, 'arduino-cli'], { stdio: 'inherit' })
  if (sonuc.status !== 0) throw new Error('Arşiv çıkarılamadı (tar)')
  mkdirSync(hedefKlasor, { recursive: true })
  if (existsSync(hedefDosya)) rmSync(hedefDosya)
  renameSync(join(gecici, 'arduino-cli'), hedefDosya)
  chmodSync(hedefDosya, 0o755)

  // GPL-3.0 gereği lisans metni ikiliyle birlikte dağıtılır: arşivdekini al (yoksa depodaki LICENSE.txt kalır)
  const lisans = spawnSync('tar', ['-xzf', arsivYolu, '-C', gecici, 'LICENSE.txt'], { stdio: 'ignore' })
  if (lisans.status === 0 && existsSync(join(gecici, 'LICENSE.txt'))) {
    copyFileSync(join(gecici, 'LICENSE.txt'), join(hedefKlasor, 'LICENSE.txt'))
    console.log('Lisans metni güncellendi: resources/arduino-cli/LICENSE.txt')
  } else {
    console.warn('Arşivde LICENSE.txt bulunamadı; depodaki resources/arduino-cli/LICENSE.txt kullanılacak.')
  }
  if (SURUM !== '1.5.1') {
    console.warn(`Uyarı: resources/arduino-cli/NOTICE.txt ve README sürüm 1.5.1 diyor; ${SURUM} için güncelleyin.`)
  }
  console.log(`Hazır: ${hedefDosya} (sha256 ${gercek.slice(0, 12)}…)`)
} finally {
  rmSync(gecici, { recursive: true, force: true })
}
