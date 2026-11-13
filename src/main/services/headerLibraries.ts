/**
 * Sık kullanılan başlık dosyalarının hangi Kütüphane Yöneticisi paketinden geldiği.
 * Tabloda olmayan başlıklar için arduino-cli'nin `provides:` araması kullanılır.
 */
export const BILINEN_BASLIKLAR: Record<string, string> = {
  'Servo.h': 'Servo',
  'DHT.h': 'DHT sensor library',
  'DHT_U.h': 'DHT sensor library',
  'Adafruit_Sensor.h': 'Adafruit Unified Sensor',
  'Adafruit_NeoPixel.h': 'Adafruit NeoPixel',
  'Adafruit_GFX.h': 'Adafruit GFX Library',
  'Adafruit_SSD1306.h': 'Adafruit SSD1306',
  'Adafruit_BMP280.h': 'Adafruit BMP280 Library',
  'Adafruit_BME280.h': 'Adafruit BME280 Library',
  'Adafruit_MPU6050.h': 'Adafruit MPU6050',
  'Adafruit_ADXL345_U.h': 'Adafruit ADXL345',
  'LiquidCrystal_I2C.h': 'LiquidCrystal I2C',
  'U8g2lib.h': 'U8g2',
  'ArduinoJson.h': 'ArduinoJson',
  'PubSubClient.h': 'PubSubClient',
  'OneWire.h': 'OneWire',
  'DallasTemperature.h': 'DallasTemperature',
  'IRremote.h': 'IRremote',
  'FastLED.h': 'FastLED',
  'TinyGPS++.h': 'TinyGPSPlus',
  'NewPing.h': 'NewPing',
  'AccelStepper.h': 'AccelStepper',
  'RTClib.h': 'RTClib',
  'MFRC522.h': 'MFRC522',
  'Keypad.h': 'Keypad',
  'ezButton.h': 'ezButton',
  'HX711.h': 'HX711',
  'BluetoothSerial.h': ''
}

/** Kart paketiyle birlikte gelen (ayrıca kütüphane kurulmayan) yaygın başlıklar */
export const KART_PAKETI_BASLIKLARI = new Set([
  'Wire.h',
  'SPI.h',
  'EEPROM.h',
  'SoftwareSerial.h',
  'Stepper.h',
  'SD.h',
  'WiFi.h',
  'WiFiClient.h',
  'WebServer.h',
  'HTTPClient.h',
  'BluetoothSerial.h',
  'BLEDevice.h',
  'Preferences.h',
  'ESP8266WiFi.h',
  'ESP8266WebServer.h',
  'Ethernet.h'
])
