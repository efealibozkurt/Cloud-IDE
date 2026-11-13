import { describe, expect, it } from 'vitest'
import { bayraksizMetin, disAdresMi, httpAdresi, mutlakYol, okunabilirDosya, yazilabilirDosya } from './yolDogrulama'

describe('yolDogrulama', () => {
  it('mutlak olmayan, NUL içeren ve metin olmayan yolları reddeder', () => {
    expect(() => mutlakYol('goreli/yol.ino')).toThrow()
    expect(() => mutlakYol('C:\\a\0b.ino')).toThrow()
    expect(() => mutlakYol(42)).toThrow()
    expect(() => mutlakYol('')).toThrow()
  })

  it('yazma yalnızca kaynak uzantılarına ve NOTLAR.md dosyasına izin verir', () => {
    expect(yazilabilirDosya('C:\\p\\p.ino')).toBe('C:\\p\\p.ino')
    expect(yazilabilirDosya('C:\\p\\NOTLAR.md')).toBe('C:\\p\\NOTLAR.md')
    expect(() => yazilabilirDosya('C:\\Windows\\sistem.dll')).toThrow()
    expect(() => yazilabilirDosya('C:\\p\\baska.md')).toThrow()
    expect(() => yazilabilirDosya('C:\\p\\a.bat')).toThrow()
  })

  it('okuma kütüphane başlıklarını ve notları kabul eder, ikili dosyaları reddeder', () => {
    expect(okunabilirDosya('C:\\lib\\x.h')).toBeTruthy()
    expect(okunabilirDosya('C:\\p\\NOTLAR.md')).toBeTruthy()
    expect(() => okunabilirDosya('C:\\Users\\a\\.ssh\\id_rsa')).toThrow()
    expect(() => okunabilirDosya('C:\\x\\secrets.json')).toThrow()
  })

  it('bayraksizMetin "-" ile başlayan ve satır sonu içeren değerleri reddeder', () => {
    expect(bayraksizMetin('arduino:avr:nano:cpu=atmega328')).toBeTruthy()
    expect(bayraksizMetin('COM3')).toBe('COM3')
    expect(bayraksizMetin('')).toBe('')
    expect(() => bayraksizMetin('--config-file=x')).toThrow()
    expect(() => bayraksizMetin(' -v')).toThrow()
    expect(() => bayraksizMetin('a\nb')).toThrow()
    expect(() => bayraksizMetin(undefined)).toThrow()
  })

  it('httpAdresi yalnızca http/https kabul eder', () => {
    expect(httpAdresi('https://dl.espressif.com/x.json')).toBeTruthy()
    expect(() => httpAdresi('file:///C:/x.json')).toThrow()
    expect(() => httpAdresi('javascript:alert(1)')).toThrow()
    expect(() => httpAdresi('bozuk')).toThrow()
  })

  it('disAdresMi şema beyaz listesi uygular', () => {
    expect(disAdresMi('https://github.com/a')).toBe(true)
    expect(disAdresMi('mailto:a@b.co')).toBe(true)
    expect(disAdresMi('file:///C:/Windows/System32/calc.exe')).toBe(false)
    expect(disAdresMi('smb://host/x')).toBe(false)
    expect(disAdresMi('ms-msdt:/id')).toBe(false)
    expect(disAdresMi('göreli')).toBe(false)
  })
})
