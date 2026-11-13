import { describe, expect, it } from 'vitest'
import { eksikBaslikBul } from './errorHints'

describe('eksikBaslikBul', () => {
  it('fatal error satırından başlık adını alır', () => {
    expect(eksikBaslikBul('fatal error: Servo.h: No such file or directory')).toBe('Servo.h')
    expect(eksikBaslikBul('x', 'C:\a\b.ino:3:10: fatal error: DHT.h: No such file or directory\ncompilation terminated.')).toBe('DHT.h')
  })
  it('klasörlü başlıkta yalnızca dosya adını döndürür', () => {
    expect(eksikBaslikBul('fatal error: Adafruit/Adafruit_Sensor.h: No such file or directory')).toBe('Adafruit_Sensor.h')
  })
  it('ilgisiz hatalarda null döner', () => {
    expect(eksikBaslikBul("error: 'foo' was not declared in this scope")).toBeNull()
    expect(eksikBaslikBul(undefined)).toBeNull()
  })
})
