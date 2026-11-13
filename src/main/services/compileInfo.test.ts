import { describe, expect, it } from 'vitest'
import { boyutuAyikla, cekirdegiAyikla, kutuphaneleriAyikla, stderrdenHatalariCikar } from './compileInfo'
import { eksikBaslikBul } from '../../shared/errorHints'

describe('derleyici hata satırı ayrıştırma', () => {
  it('"fatal error" (eksik başlık) bir hata olarak yakalanır', () => {
    const stderr = [
      'C:\\Users\\x\\Deneme\\Deneme.ino:1:10: fatal error: Servo.h: No such file or directory',
      ' #include <Servo.h>',
      '          ^~~~~~~~~',
      'compilation terminated.',
      'Error during build: exit status 1'
    ].join('\n')
    const hatalar = stderrdenHatalariCikar(stderr)
    expect(hatalar).toHaveLength(1)
    expect(hatalar[0]).toMatchObject({ satir: 1, sutun: 10, tur: 'error', mesaj: 'Servo.h: No such file or directory' })
    expect(hatalar[0].dosya.endsWith('Deneme.ino')).toBe(true)
    // Eksik başlık yardımcısı bu mesajdan başlık adını çıkarabilmeli
    expect(eksikBaslikBul(hatalar[0].mesaj, hatalar[0].hamMetin)).toBe('Servo.h')
  })

  it('sıradan error, warning ve note satırları ile CRLF çıktısını okur', () => {
    const stderr = "a.ino:3:5: error: 'x' was not declared in this scope\r\na.ino:4:1: warning: unused variable 'y'\r\na.ino:4:1: note: declared here"
    expect(stderrdenHatalariCikar(stderr).map((h) => h.tur)).toEqual(['error', 'warning', 'note'])
  })
})

const LOG = `
Using board 'uno' from platform in folder: C:\\Users\\x\\AppData\\Local\\Arduino15\\packages\\arduino\\hardware\\avr\\1.8.6
Using core 'arduino' from platform in folder: C:\\Users\\x\\AppData\\Local\\Arduino15\\packages\\arduino\\hardware\\avr\\1.8.6
Detecting libraries used...
Using library Servo at version 1.2.1 in folder: C:\\Users\\x\\Documents\\Arduino\\libraries\\Servo
Using library Adafruit NeoPixel at version 1.12.0 in folder: C:\\Users\\x\\Documents\\Arduino\\libraries\\Adafruit_NeoPixel
Sketch uses 1.234 bytes (3%) of program storage space. Maximum is 32.256 bytes.
Global variables use 9 bytes (0%) of dynamic memory, leaving 2039 bytes for local variables. Maximum is 2048 bytes.
`

describe('derleme çıktısı ayıklama', () => {
  it('flash ve RAM kullanımını okur (binlik ayraçlı sayılar dahil)', () => {
    const b = boyutuAyikla(LOG)
    expect(b?.flash).toEqual({ kullanilan: 1234, azami: 32256 })
    expect(b?.ram).toEqual({ kullanilan: 9, azami: 2048 })
  })

  it('boyut satırı yoksa undefined döner', () => {
    expect(boyutuAyikla('Compilation error: bla')).toBeUndefined()
  })

  it('sadece flash satırı varsa RAM boş kalır', () => {
    const b = boyutuAyikla('Sketch uses 500 bytes (1%) of program storage space. Maximum is 40000 bytes.')
    expect(b?.flash?.kullanilan).toBe(500)
    expect(b?.ram).toBeUndefined()
  })

  it('kütüphane adlarını boşluklu olanlar dahil sürümleriyle okur', () => {
    expect(kutuphaneleriAyikla(LOG)).toEqual({ Servo: '1.2.1', 'Adafruit NeoPixel': '1.12.0' })
  })

  it('çekirdek sürümünü klasör yolunun son parçasından alır', () => {
    expect(cekirdegiAyikla(LOG)).toEqual({ ad: 'arduino', surum: '1.8.6' })
    expect(cekirdegiAyikla("Using core 'esp32' from platform in folder: /home/x/esp32/esp32")).toEqual({ ad: 'esp32', surum: '' })
    expect(cekirdegiAyikla('hiçbir şey')).toBeUndefined()
  })
})
