import { describe, expect, it } from 'vitest'
import { koddanBaudBul } from './seriBaud'

describe('koddanBaudBul', () => {
  it('doğrudan sayıyı bulur', () => {
    expect(koddanBaudBul(['void setup() { Serial.begin(9600); }'])).toBe(9600)
    expect(koddanBaudBul(['Serial.begin(115200, SERIAL_8N1);'])).toBe(115200)
  })

  it('#define ve const sabitlerini çözer (başka dosyadan da)', () => {
    expect(koddanBaudBul(['#define BAUD 57600', 'Serial.begin(BAUD);'])).toBe(57600)
    expect(koddanBaudBul(['const unsigned long HIZ = 19200UL;\nSerial.begin(HIZ);'])).toBe(19200)
  })

  it('yorum ve metin içindeki örnekleri saymaz', () => {
    expect(koddanBaudBul(['// Serial.begin(9600);\n/* Serial.begin(19200); */\nSerial.begin(115200);'])).toBe(115200)
    expect(koddanBaudBul(['const char* s = "Serial.begin(9600)";'])).toBeNull()
  })

  it('başka seri hatları yok sayar', () => {
    expect(koddanBaudBul(['Serial1.begin(9600); mySerial.begin(4800); gpsSerial.begin(9600);'])).toBeNull()
    expect(koddanBaudBul(['Serial2.begin(9600); Serial.begin(115200);'])).toBe(115200)
  })

  it('belirsiz, desteklenmeyen ya da yarım yazılmış değerde tahmin yürütmez', () => {
    expect(koddanBaudBul(['Serial.begin(9600); Serial.begin(115200);'])).toBeNull()
    expect(koddanBaudBul(['Serial.begin(12345);'])).toBeNull()
    expect(koddanBaudBul(['Serial.begin(hiz);'])).toBeNull()
    expect(koddanBaudBul(['Serial.begin(1152'])).toBeNull()
  })
})
