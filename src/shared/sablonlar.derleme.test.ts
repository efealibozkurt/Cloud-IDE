import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { SABLONLAR, varsayilanDegerler, type KartAilesi } from './sablonlar'

/**
 * Şablonların gerçekten derlendiğini arduino-cli ile doğrular. Yalnızca isteğe bağlı çalışır:
 *   SABLON_DERLE=1 npx vitest run src/shared/sablonlar.derleme.test.ts
 * Gerekenler: kurulu kart paketi ve şablonun kütüphaneleri (eksik olanlar atlanır).
 * Ortam değişkenleri: ARDUINO_CLI (yol), ARDUINO_CLI_CONFIG (yapılandırma dosyası).
 */
const CLI = process.env.ARDUINO_CLI ?? join(process.cwd(), 'resources', 'arduino-cli', 'arduino-cli.exe')
const CONFIG = process.env.ARDUINO_CLI_CONFIG ?? join(process.env.APPDATA ?? '', 'Cloud IDE', 'arduino-cli.yaml')
const CALISTIR = Boolean(process.env.SABLON_DERLE) && existsSync(CLI)

const FQBN: Record<KartAilesi, string> = { avr: 'arduino:avr:uno', esp32: 'esp32:esp32:esp32', esp8266: 'esp8266:esp8266:nodemcuv2' }

function cli(args: string[]): { kod: number; cikti: string } {
  const r = spawnSync(CLI, ['--config-file', CONFIG, ...args], { encoding: 'utf8', timeout: 240_000 })
  return { kod: r.status ?? -1, cikti: `${r.stdout}\n${r.stderr}` }
}

describe.skipIf(!CALISTIR)('şablonlar arduino-cli ile derlenir', () => {
  const cekirdekler = CALISTIR ? cli(['core', 'list']).cikti : ''
  const kurulu = CALISTIR ? cli(['lib', 'list']).cikti : ''

  for (const sablon of SABLONLAR) {
    for (const aile of sablon.uyumlu) {
      const cekirdekAdi = FQBN[aile].split(':').slice(0, 2).join(':')
      const eksikKutuphane = sablon.kutuphaneler(aile).filter((k) => !kurulu.includes(k))
      const calisir = cekirdekler.includes(cekirdekAdi) && eksikKutuphane.length === 0
      it.skipIf(!calisir)(
        `${sablon.id} (${aile})`,
        () => {
          const kok = mkdtempSync(join(tmpdir(), 'sablon-'))
          try {
            const klasor = join(kok, sablon.projeAdi)
            mkdirSync(klasor)
            writeFileSync(join(klasor, `${sablon.projeAdi}.ino`), sablon.kod(varsayilanDegerler(sablon, aile), aile))
            const r = cli(['compile', '--fqbn', FQBN[aile], klasor])
            expect(r.kod, r.cikti.slice(-1500)).toBe(0)
          } finally {
            rmSync(kok, { recursive: true, force: true })
          }
        },
        300_000
      )
    }
  }
})
