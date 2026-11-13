import { describe, expect, it } from 'vitest'
import { argumanlariAyristir } from './providers'

describe('argumanlariAyristir', () => {
  it('geçerli JSON metnini ayrıştırır', () => {
    expect(argumanlariAyristir('{"path":"a.ino"}')).toEqual({ path: 'a.ino' })
  })

  it('nesneyi olduğu gibi döndürür', () => {
    expect(argumanlariAyristir({ a: 1 })).toEqual({ a: 1 })
  })

  it('boş girdiyi boş nesneye çevirir', () => {
    expect(argumanlariAyristir(undefined)).toEqual({})
    expect(argumanlariAyristir('')).toEqual({})
  })

  it('eksik kapanışlı JSON’u onarmaya çalışır', () => {
    const sonuc = argumanlariAyristir('{"path":"a.ino","content":"abc"')
    expect(sonuc.path).toBe('a.ino')
  })
})
