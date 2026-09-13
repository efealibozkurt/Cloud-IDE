import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

/**
 * Uygulamaya özel, kullanıcının mevcut Arduino kurulumundan tamamen
 * izole bir arduino-cli çalışma ortamı. Tüm CLI çağrılarına
 * `--config-file configPath` eklenerek bu ortam kullanılır.
 */
export interface ArduinoCliOrtami {
  dataDir: string
  downloadsDir: string
  userDir: string
  configPath: string
}

/**
 * userData altında arduino-cli-data dizinini ve alt klasörlerini
 * oluşturur, verilen board manager URL'leriyle bir arduino-cli.yaml
 * yazar/günceller. YAML tek satırlık tek-tırnaklı (literal) dizeler
 * kullanır; bu sayede Windows yollarındaki ters eğik çizgiler kaçış
 * karakteri gerektirmeden olduğu gibi korunur.
 */
export async function arduinoCliOrtamiHazirla(
  userDataDir: string,
  boardManagerUrls: string[]
): Promise<ArduinoCliOrtami> {
  const dataDir = join(userDataDir, 'arduino-cli-data')
  const downloadsDir = join(dataDir, 'staging')
  const userDir = join(dataDir, 'user')
  const configPath = join(userDataDir, 'arduino-cli.yaml')

  await mkdir(dataDir, { recursive: true })
  await mkdir(downloadsDir, { recursive: true })
  await mkdir(userDir, { recursive: true })

  const additionalUrlsBlock =
    boardManagerUrls.length > 0
      ? `additional_urls:\n${boardManagerUrls.map((url) => `    - '${url}'`).join('\n')}`
      : 'additional_urls: []'
  const icerik = `board_manager:
  ${additionalUrlsBlock}
directories:
  data: '${dataDir}'
  downloads: '${downloadsDir}'
  user: '${userDir}'
logging:
  level: info
  format: text
`

  await writeFile(configPath, icerik, 'utf8')

  return { dataDir, downloadsDir, userDir, configPath }
}
