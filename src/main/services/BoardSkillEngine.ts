import { promises as fs } from 'fs'
import { join } from 'path'
import type { ArduinoCliService } from './ArduinoCliService'
import type { RagService } from './RagService'
import type { CustomSkillService } from './CustomSkillService'
import type { BoardProfileInfo, BoardModelVariant } from '@shared/types'

export interface BoardContext {
  name?: string
  fqbn?: string
  platformName?: string
  platformId?: string
}

export const SABIT_KART_PROFILLERI: BoardProfileInfo[] = [
  {
    family: 'deneyap',
    name: 'Deneyap Kart Ailesi',
    architecture: 'ESP32 (Xtensa Dual-Core / RISC-V)',
    voltage: '3.3V (5V Toleranssız)',
    clockSpeed: '240 MHz',
    flashRam: '4MB Flash / 520KB SRAM',
    features: [
      'Dahili 6-Eksen IMU (LSM6DSM / MPU6050 İvmeölçer & Jiroskop)',
      'Dahili Adreslenebilir RGB LED (D_RGB)',
      'Dahili Kullanıcı Butonu (GPKEY)',
      '2.4GHz Wi-Fi (802.11 b/g/n) & Bluetooth 5.0 BLE'
    ],
    pins: ['D0 - D15 (Dijital)', 'A0 - A7 (Analog)', 'PWM0, PWM1', 'D_RGB', 'GPKEY'],
    libraries: ['deneyap.h', 'Deneyap_OLED.h', 'Deneyap_Servo.h', 'WiFi.h', 'BLEDevice.h'],
    rules: [
      'GPIO pinleri 3.3V seviyesindedir, 5V toleranslı DEĞİLDİR.',
      "Pinlerde standart rakamlar yerine 'D0', 'D1', 'A0', 'D_RGB', 'GPKEY' adlarını kullan.",
      'Dahili IMU için mutlaka #include <deneyap.h> ve if (!IMU.begin()) kontrolü yap.'
    ],
    models: [
      {
        id: 'deneyap_1a',
        name: 'Deneyap Kart (1A)',
        fqbnMatch: ['deneyapkart', 'deneyapkart1a'],
        architecture: 'ESP32-WROVER-E (Xtensa Dual-Core LX6 @ 240MHz)',
        voltage: '3.3V (5V Toleranssız)',
        clockSpeed: '240 MHz',
        flashRam: '4MB Flash / 8MB PSRAM / 520KB SRAM',
        features: [
          'Dahili 6-Eksen IMU (LSM6DSM İvmeölçer & Jiroskop)',
          'Dahili Adreslenebilir RGB LED (D_RGB)',
          'Dahili MP34DT05-A MEMS Mikrofon',
          'Dahili Kullanıcı Butonu (GPKEY)',
          '2.4GHz Wi-Fi (802.11 b/g/n) & Bluetooth 5.0 BLE'
        ],
        pins: [
          'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7',
          'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15',
          'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7',
          'PWM0', 'PWM1', 'D_RGB', 'GPKEY',
          'SDA (D4)', 'SCL (D5)', 'MOSI (D11)', 'MISO (D12)', 'SCK (D13)'
        ],
        rules: [
          "Pinlerde sayı yerine resmi Deneyap takma adlarını ('D0', 'A0', 'D_RGB', 'GPKEY') kullan.",
          'GPIO pinleri 3.3V lojiktir, 5V toleransı YOKTUR. Sensörleri 3.3V ile besle.',
          'Dahili IMU için #include <deneyap.h> ve if (!IMU.begin()) kontrolü zorunludur.'
        ]
      },
      {
        id: 'deneyap_1a_v2',
        name: 'Deneyap Kart 1A v2',
        fqbnMatch: ['deneyapkart1av2'],
        architecture: 'ESP32-S3 (Xtensa Dual-Core LX7 @ 240MHz + AI Vektör)',
        voltage: '3.3V (5V Toleranssız)',
        clockSpeed: '240 MHz',
        flashRam: '8MB Flash / 2MB PSRAM / 512KB SRAM',
        features: [
          'Dahili 6-Eksen IMU (LSM6DSM)',
          'Dahili RGB LED (D_RGB)',
          'Dahili Kullanıcı Butonu (GPKEY)',
          'Dahili USB-C Native USB Serial/JTAG',
          'Wi-Fi 2.4GHz & BLE 5.0'
        ],
        pins: [
          'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7',
          'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15',
          'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7',
          'D_RGB', 'GPKEY', 'SDA (D4)', 'SCL (D5)', 'TX', 'RX'
        ],
        rules: [
          'ESP32-S3 çekirdeğidir, USB Serial JTAG destekler.',
          'IMU ve RGB LED Deneyap SDK 2.x ile tam uyumludur.'
        ]
      },
      {
        id: 'deneyap_g',
        name: 'Deneyap Kart G',
        fqbnMatch: ['deneyapkartg'],
        architecture: 'ESP32-C3 (32-bit RISC-V Tek Çekirdek @ 160MHz)',
        voltage: '3.3V',
        clockSpeed: '160 MHz',
        flashRam: '4MB Flash / 400KB SRAM',
        features: [
          'Dahili Sıcaklık & Bağıl Nem Sensörü (SHTC3)',
          'Dahili I2C Qwiic Soketi',
          'Dahili Kullanıcı Butonu (GPKEY)',
          'Dahili RGB LED (LEDR, LEDG, LEDB)',
          'Wi-Fi 4 & BLE 5.0'
        ],
        pins: [
          'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8',
          'A0', 'A1', 'A2', 'A3', 'A4',
          'GPKEY', 'LEDR', 'LEDG', 'LEDB', 'SDA', 'SCL', 'TX', 'RX'
        ],
        rules: [
          'RISC-V mimarisine sahiptir.',
          'Dahili SHTC3 sensörü Wire (I2C) hattı üzerinden okunur.'
        ]
      },
      {
        id: 'deneyap_mini',
        name: 'Deneyap Mini / Mini v2',
        fqbnMatch: ['deneyapmini', 'deneyapminiv2'],
        architecture: 'ESP32-S2 / S3 Kompakt Çekirdek @ 240MHz',
        voltage: '3.3V',
        clockSpeed: '240 MHz',
        flashRam: '4MB Flash / 320KB SRAM',
        features: [
          'Ultra Kompakt Boyut',
          'Dahili Adreslenebilir RGB LED',
          'Dahili Buton (GPKEY)',
          'Qwiic / I2C Konnektörü'
        ],
        pins: [
          'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9',
          'A0', 'A1', 'A2', 'A3', 'A4', 'A5',
          'D_RGB', 'GPKEY', 'SDA', 'SCL'
        ],
        rules: [
          'Küçük form faktörü sebebiyle pin sayısı kısıtlıdır.',
          '3.3V mantık seviyesine dikkat edilmelidir.'
        ]
      },
      {
        id: 'deneyap_kamera',
        name: 'Deneyap Kart Kamera',
        fqbnMatch: ['deneyapkamerakart', 'deneyapcamera'],
        architecture: 'ESP32-WROVER (Xtensa Dual-Core @ 240MHz)',
        voltage: '3.3V',
        clockSpeed: '240 MHz',
        flashRam: '4MB Flash / 8MB PSRAM',
        features: [
          'OV2640 2 Megapiksel Kamera Soketi',
          'MicroSD Kart Yuvası',
          'Dahili Güçlü Flaş LED',
          'Wi-Fi 802.11 b/g/n & Bluetooth 4.2 BLE'
        ],
        pins: [
          'CAM_Y2', 'CAM_Y3', 'CAM_Y4', 'CAM_Y5', 'CAM_Y6', 'CAM_Y7', 'CAM_Y8', 'CAM_Y9',
          'CAM_XCLK', 'CAM_PCLK', 'CAM_VSYNC', 'CAM_HREF', 'FLASH_LED',
          'SD_CMD', 'SD_CLK', 'SD_D0',
          'D0', 'D1', 'D2', 'D3', 'D4', 'D5'
        ],
        rules: [
          'Kamera ve SD kart pinleri yüksek hızlı bus veri yollarıdır.',
          'Görüntü yakalama işlemlerinde PSRAM hafızası aktif edilmelidir.'
        ]
      }
    ]
  },
  {
    family: 'esp32',
    name: 'ESP32 Ailesi (ESP32 / S2 / S3 / C3)',
    architecture: '32-bit Xtensa Dual-Core / RISC-V',
    voltage: '3.3V (5V Toleranssız)',
    clockSpeed: '240 MHz',
    flashRam: '4MB - 16MB Flash / 520KB SRAM',
    features: [
      'Wi-Fi 802.11 b/g/n',
      'Bluetooth 4.2 / 5.0 BLE',
      'Donanımsal LEDC PWM Birimi',
      'Dahili FreeRTOS Çoklu Görev Desteği',
      'Kalıcı Veri Deposu (Preferences API)'
    ],
    pins: ['GPIO 0 - 39 (GPIO 34-39 YALNIZCA GİRİŞ)', 'I2C (SDA: 21, SCL: 22)', 'SPI (MOSI: 23, MISO: 19, SCK: 18)'],
    libraries: ['WiFi.h', 'WebServer.h', 'Preferences.h', 'BLEDevice.h', 'HTTPClient.h'],
    rules: [
      "analogWrite yerine modern 'ledcAttach' ve 'ledcWrite' kullan.",
      "EEPROM yerine modern #include <Preferences.h> tercih et.",
      'GPIO 34, 35, 36, 39 pinlerini output olarak atama (yalnızca giriştir).'
    ],
    models: [
      {
        id: 'esp32_wroom',
        name: 'ESP32 DevKit (WROOM-32)',
        fqbnMatch: ['esp32:esp32:esp32', 'esp32:esp32:nodemcu-32s'],
        architecture: '32-bit Xtensa Dual-Core LX6 @ 240MHz',
        voltage: '3.3V (5V Toleranssız)',
        clockSpeed: '240 MHz',
        flashRam: '4MB Flash / 520KB SRAM',
        features: [
          'Wi-Fi 802.11 b/g/n & Bluetooth 4.2 BR/EDR/BLE',
          'Donanımsal LEDC PWM Birimi',
          'FreeRTOS Çoklu Görev',
          'Kalıcı Veri Deposu (Preferences API)'
        ],
        pins: [
          'GPIO 0 (Boot)', 'GPIO 2 (LED_BUILTIN)', 'GPIO 4', 'GPIO 5 (CS)',
          'GPIO 12', 'GPIO 13', 'GPIO 14', 'GPIO 15', 'GPIO 16', 'GPIO 17', 'GPIO 18 (SCK)', 'GPIO 19 (MISO)',
          'GPIO 21 (SDA)', 'GPIO 22 (SCL)', 'GPIO 23 (MOSI)', 'GPIO 25', 'GPIO 26', 'GPIO 27', 'GPIO 32', 'GPIO 33',
          'GPIO 34 (YALNIZCA GİRİŞ)', 'GPIO 35 (YALNIZCA GİRİŞ)', 'GPIO 36 (SENSOR_VP)', 'GPIO 39 (SENSOR_VN)'
        ],
        rules: [
          'GPIO 34, 35, 36, 39 pinlerini output olarak atama (yalnızca giriştir, dahili pull-up yoktur).',
          'EEPROM yerine modern #include <Preferences.h> tercih et.',
          "analogWrite yerine modern 'ledcAttach' ve 'ledcWrite' kullan."
        ]
      },
      {
        id: 'esp32_s3',
        name: 'ESP32-S3 DevKit',
        fqbnMatch: ['esp32:esp32:esp32s3'],
        architecture: '32-bit Xtensa Dual-Core LX7 @ 240MHz (AI Vektör Hızlandırıcı)',
        voltage: '3.3V',
        clockSpeed: '240 MHz',
        flashRam: '8MB - 16MB Flash / 512KB SRAM / 2-8MB PSRAM',
        features: [
          'Dahili USB OTG & USB Serial/JTAG',
          'Dahili Adreslenebilir RGB LED (GPIO 48 / 38)',
          '44 Programlanabilir GPIO',
          'Yapay Zeka ve Makine Öğrenimi Vektör Komutları'
        ],
        pins: [
          'GPIO 1 - 21', 'GPIO 35 - 48',
          'USB D- (GPIO 19)', 'USB D+ (GPIO 20)',
          'I2C (SDA: 8, SCL: 9)', 'SPI (MOSI: 11, MISO: 13, SCK: 12, CS: 10)',
          'RGB LED (GPIO 48)'
        ],
        rules: [
          'USB CDC On Boot ayarı Seri port çıktısı için önemlidir.',
          'Dahili RGB LED için WS2812 / NeoPixel veya ledc kullanılabilir.'
        ]
      },
      {
        id: 'esp32_c3',
        name: 'ESP32-C3 SuperMini / DevKit',
        fqbnMatch: ['esp32:esp32:esp32c3'],
        architecture: '32-bit RISC-V Tek Çekirdek @ 160MHz',
        voltage: '3.3V',
        clockSpeed: '160 MHz',
        flashRam: '4MB Flash / 400KB SRAM',
        features: [
          'Düşük Güç Tüketimi',
          'Wi-Fi 4 ve Bluetooth 5.0 LE',
          'Dahili USB-Serial JTAG',
          'Dahili Durum LEDi (GPIO 8)'
        ],
        pins: [
          'GPIO 0 - 10', 'GPIO 18 - 21',
          'I2C (SDA: 8, SCL: 9)', 'SPI (MOSI: 6, MISO: 5, SCK: 4, CS: 7)',
          'LED_BUILTIN (GPIO 8)'
        ],
        rules: [
          'Tek çekirdekli RISC-V işlemcidir.',
          'GPIO 8 pini genellikle yerleşik LED ile paylaşılır.'
        ]
      },
      {
        id: 'esp32_cam',
        name: 'ESP32-CAM (AI-Thinker)',
        fqbnMatch: ['esp32cam'],
        architecture: '32-bit Xtensa Dual-Core LX6 @ 240MHz',
        voltage: '3.3V / 5V Giriş',
        clockSpeed: '240 MHz',
        flashRam: '4MB Flash / 4MB Harici PSRAM',
        features: [
          'OV2640 2MP Kamera Modülü',
          'MicroSD Kart Yuvası',
          'Güçlü Flaş LED (GPIO 4)',
          'Dahili Kırmızı Durum LEDi (GPIO 33 - ters mantık)'
        ],
        pins: [
          'GPIO 0 (Boot/Programlama)', 'GPIO 1 (TX)', 'GPIO 3 (RX)',
          'GPIO 4 (Flaş LED)', 'GPIO 33 (Durum LED)',
          'GPIO 12-16 (SD/Kamera Ortak Pinleri)'
        ],
        rules: [
          'Program yüklerken GPIO 0 pini GND hattına bağlanmalı, yükleme bitince çıkarılmalıdır.',
          'Kamera aktifken boştaki GPIO pinleri sınırlıdır (GPIO 12, 13, 14, 15, 16, 2, 4).'
        ]
      }
    ]
  },
  {
    family: 'avr',
    name: 'Arduino AVR (Uno, Nano, Mega)',
    architecture: '8-bit ATmega328P / ATmega2560',
    voltage: '5V Standart TTL',
    clockSpeed: '16 MHz',
    flashRam: '32KB Flash / 2KB SRAM (Mega: 256KB Flash / 8KB SRAM)',
    features: ['10-bit Analog ADC (0 - 1023)', 'Dahili PWM Zamanlayıcıları', 'Donanımsal UART Seri Port'],
    pins: ['D0 - D13', 'A0 - A5', 'PWM: 3, 5, 6, 9, 10, 11 (Uno)', 'Dahili LED: Pin 13 / LED_BUILTIN'],
    libraries: ['Arduino.h', 'Wire.h', 'SPI.h', 'EEPROM.h', 'Servo.h'],
    rules: [
      "2KB SRAM taşmasını önlemek için sabit metinlerde F() makrosunu kullan (örn. Serial.println(F('...'))).",
      'Büyük dinamik String ve malloc kullanımından kaçın.',
      'Uno/Nano harici donanım kesmeleri (interrupts) yalnızca Pin 2 ve Pin 3 üzerindedir.'
    ],
    models: [
      {
        id: 'avr_uno',
        name: 'Arduino Uno R3',
        fqbnMatch: ['arduino:avr:uno'],
        architecture: '8-bit ATmega328P @ 16MHz',
        voltage: '5V Standart TTL',
        clockSpeed: '16 MHz',
        flashRam: '32KB Flash / 2KB SRAM / 1KB EEPROM',
        features: [
          '10-bit Analog ADC (0 - 1023)',
          'Dahili PWM Zamanlayıcıları',
          'Donanımsal UART Seri Port',
          'Dahili LED (Pin 13)'
        ],
        pins: [
          'D0 (RX)', 'D1 (TX)', 'D2', 'D3 (PWM)', 'D4', 'D5 (PWM)', 'D6 (PWM)',
          'D7', 'D8', 'D9 (PWM)', 'D10 (PWM)', 'D11 (PWM/MOSI)', 'D12 (MISO)', 'D13 (SCK/LED)',
          'A0', 'A1', 'A2', 'A3', 'A4 (SDA)', 'A5 (SCL)'
        ],
        rules: [
          "2KB SRAM kısıtı için sabit metinlerde F() makrosunu kullan (örn. Serial.println(F('...'))).",
          'Dış kesmeler (Interrupts) yalnızca Pin 2 ve Pin 3 üzerindedir.'
        ]
      },
      {
        id: 'avr_nano',
        name: 'Arduino Nano',
        fqbnMatch: ['arduino:avr:nano'],
        architecture: '8-bit ATmega328P @ 16MHz',
        voltage: '5V Standart TTL',
        clockSpeed: '16 MHz',
        flashRam: '32KB Flash / 2KB SRAM',
        features: [
          'Kompakt Breadboard Uyumlu Form',
          '8 Kanallı 10-bit Analog Giriş (A0 - A7)',
          'Dahili PWM'
        ],
        pins: [
          'D0 - D13',
          'A0 - A7 (A6 ve A7 YALNIZCA Analog Giriştir, dijital G/Ç yapılamaz)',
          'PWM: 3, 5, 6, 9, 10, 11',
          'LED_BUILTIN (Pin 13)'
        ],
        rules: [
          'A6 ve A7 pinleri dijital pinMode/digitalWrite ile KULLANILAMAZ, sadece analogRead destekler.'
        ]
      },
      {
        id: 'avr_mega',
        name: 'Arduino Mega 2560',
        fqbnMatch: ['arduino:avr:mega'],
        architecture: '8-bit ATmega2560 @ 16MHz',
        voltage: '5V Standart TTL',
        clockSpeed: '16 MHz',
        flashRam: '256KB Flash / 8KB SRAM / 4KB EEPROM',
        features: [
          '54 Dijital G/Ç Pini',
          '16 Analog Giriş Pini',
          '4 Donanımsal Seri Port (Serial, Serial1, Serial2, Serial3)',
          '15 PWM Çıkışı'
        ],
        pins: [
          'D0 - D53 (Dijital G/Ç)',
          'PWM: 2 - 13, 44 - 46',
          'A0 - A15 (Analog Giriş)',
          'Serial1 (18, 19)', 'Serial2 (16, 17)', 'Serial3 (14, 15)',
          'I2C: SDA (20), SCL (21)',
          'SPI: 50 (MISO), 51 (MOSI), 52 (SCK), 53 (SS)'
        ],
        rules: [
          'Uno ile karşılaştırıldığında I2C pinleri A4/A5 değil Pin 20/21 üzerindedir.',
          'SPI pinleri 11/12/13 değil Pin 50/51/52 üzerindedir.'
        ]
      }
    ]
  },
  {
    family: 'rp2040',
    name: 'Raspberry Pi RP2040 (Pico, Nano RP2040)',
    architecture: 'Dual-Core ARM Cortex-M0+',
    voltage: '3.3V',
    clockSpeed: '133 MHz',
    flashRam: '2MB - 16MB QSPI Flash / 264KB SRAM',
    features: [
      'Çift Çekirdek (setup1 / loop1 doğrudan destek)',
      'PIO (Programlanabilir G/Ç Durum Makineleri)',
      'LittleFS Dosya Sistemi Desteği'
    ],
    pins: ['GP0 - GP28', 'ADC0 - ADC2 (GP26 - GP28)', 'Dahili LED: GP25 / LED_BUILTIN'],
    libraries: ['LittleFS.h', 'hardware/pio.h', 'pico/stdlib.h'],
    rules: [
      'İkinci çekirdeği kullanmak için doğrudan setup1() ve loop1() fonksiyonlarını tanımlayabilirsin.',
      'PIO blokları ile ultra yüksek hızlı özel seri protokoller oluşturulabilir.'
    ],
    models: [
      {
        id: 'rp2040_pico',
        name: 'Raspberry Pi Pico',
        fqbnMatch: ['rp2040:rp2040:rpipico'],
        architecture: 'Dual-Core ARM Cortex-M0+ @ 133MHz',
        voltage: '3.3V',
        clockSpeed: '133 MHz',
        flashRam: '2MB QSPI Flash / 264KB SRAM',
        features: [
          'Çift Çekirdek (setup1 / loop1 bağımsız çalıştırılabilir)',
          'PIO (8 adet Programlanabilir G/Ç Durum Makinesi)',
          'Dahili Sıcaklık Sensörü (ADC4)'
        ],
        pins: [
          'GP0 - GP28',
          'ADC0 (GP26)', 'ADC1 (GP27)', 'ADC2 (GP28)',
          'LED_BUILTIN (GP25)',
          'I2C0, I2C1, SPI0, SPI1, UART0, UART1'
        ],
        rules: [
          'setup1() ve loop1() fonksiyonları doğrudan 2. çekirdeği aktive eder.',
          'PIO blokları özel sinyaller ve protokoller için kullanılabilir.'
        ]
      },
      {
        id: 'rp2040_pico_w',
        name: 'Raspberry Pi Pico W',
        fqbnMatch: ['rp2040:rp2040:rpipicow'],
        architecture: 'Dual-Core ARM Cortex-M0+ @ 133MHz',
        voltage: '3.3V',
        clockSpeed: '133 MHz',
        flashRam: '2MB QSPI Flash / 264KB SRAM',
        features: [
          'Infineon CYW43439 Wi-Fi (802.11 b/g/n) ve Bluetooth 5.2 BLE',
          'Çift Çekirdek Desteği',
          'Dahili LED Wi-Fi Çipi Üzerindedir (WL_GPIO0)'
        ],
        pins: [
          'GP0 - GP28',
          'ADC0 (GP26)', 'ADC1 (GP27)', 'ADC2 (GP28)',
          'CYW43439 WL_GPIO0 (LED_BUILTIN)'
        ],
        rules: [
          'Dahili LED GP25 üzerinde DEĞİLDİR; Wi-Fi çipine bağlıdır (LED_BUILTIN kullanılmalıdır).',
          'Wi-Fi için #include <WiFi.h> kullanılır.'
        ]
      }
    ]
  },
  {
    family: 'stm32',
    name: 'STM32 (BluePill, Nucleo)',
    architecture: '32-bit ARM Cortex-M',
    voltage: '3.3V (Bazı pinler 5V toleranslı)',
    clockSpeed: '72 - 168 MHz',
    flashRam: '64KB - 512KB Flash / 20KB - 128KB SRAM',
    features: ['Donanımsal Zamanlayıcılar (HardwareTimer)', 'Çoklu Donanımsal USART, I2C, SPI', '12-bit Hızlı ADC'],
    pins: ['PA0 - PA15', 'PB0 - PB15', 'PC13 (Dahili LED - ters mantık)'],
    libraries: ['HardwareTimer.h', 'Wire.h', 'SPI.h'],
    rules: [
      'Pin tanımlamalarında PA0, PB1 gibi port isimlerini kullan.',
      'Dahili LED çoğu BluePill kartında PC13 üzerindedir ve ters mantıkla (LOW ile yanar) çalışır.'
    ],
    models: [
      {
        id: 'stm32_bluepill',
        name: 'STM32F103C8 (BluePill)',
        fqbnMatch: ['stm32:stm32:GenF1:pnum=BLUEPILL_F103C8'],
        architecture: '32-bit ARM Cortex-M3 @ 72MHz',
        voltage: '3.3V (Bazı pinler 5V toleranslı)',
        clockSpeed: '72 MHz',
        flashRam: '64KB Flash / 20KB SRAM',
        features: [
          'Donanımsal Zamanlayıcılar (HardwareTimer)',
          '2x 12-bit ADC',
          'Dahili LED (PC13 - Ters Mantık/LOW ile yanar)'
        ],
        pins: [
          'PA0 - PA15', 'PB0 - PB15',
          'PC13 (LED_BUILTIN - LOW Aktif)',
          'USART1 (PA9/PA10)', 'I2C1 (PB6/PB7)', 'SPI1 (PA5/PA6/PA7)'
        ],
        rules: [
          'Pin isimlerinde PA0, PB1 gibi port tanımları kullanılır.',
          'PC13 üzerindeki LED ters mantıkla (LOW ile yanar, HIGH ile söner) çalışır.'
        ]
      },
      {
        id: 'stm32_blackpill',
        name: 'STM32F401 / F411 (BlackPill)',
        fqbnMatch: ['stm32:stm32:GenF4:pnum=BLACKPILL_F401CC', 'stm32:stm32:GenF4:pnum=BLACKPILL_F411CE'],
        architecture: '32-bit ARM Cortex-M4 @ 84-100MHz (Donanımsal FPU)',
        voltage: '3.3V',
        clockSpeed: '84 - 100 MHz',
        flashRam: '256KB - 512KB Flash / 64KB - 128KB SRAM',
        features: [
          'Donanımsal Kayan Nokta Birimi (FPU)',
          'Type-C USB Arayüzü',
          'Dahili Kullanıcı Butonu (PA0)'
        ],
        pins: [
          'PA0 - PA15', 'PB0 - PB15',
          'PC13 (LED)', 'KEY Butonu (PA0)',
          'USB D- (PA11), USB D+ (PA12)'
        ],
        rules: [
          'FPU sayesinde karmaşık matematiksel hesaplamalar ultra hızlı çalışır.',
          '3.3V lojik referans alınmalıdır.'
        ]
      }
    ]
  },
  {
    family: 'general',
    name: 'Genel Arduino & C++ Gömülü Sistem',
    architecture: 'Standart Taşınabilir Arduino Mimarisi',
    voltage: 'Standart Lojik Seviye',
    clockSpeed: 'Standart Frekans',
    flashRam: 'Standart Bellek',
    features: ['pinMode', 'digitalWrite', 'analogRead', 'millis', 'delay', 'Serial'],
    pins: ['Standart Arduino Pinleri (D0 - D13, A0 - A5, LED_BUILTIN)'],
    libraries: ['Arduino.h'],
    rules: ['Donanıma özgü register yerine taşınabilir Arduino C++ API standartlarını tercih et.'],
    models: [
      {
        id: 'general_standard',
        name: 'Standart Arduino / Gömülü Sistem',
        architecture: 'Standart Taşınabilir Arduino Mimarisi',
        voltage: 'Standart Lojik Seviye',
        clockSpeed: 'Standart Frekans',
        flashRam: 'Standart Bellek',
        features: ['pinMode', 'digitalWrite', 'analogRead', 'millis', 'delay', 'Serial'],
        pins: ['D0 - D13', 'A0 - A5', 'LED_BUILTIN'],
        rules: ['Donanıma özgü register yerine taşınabilir Arduino C++ API standartlarını tercih et.']
      }
    ]
  }
]

/**
 * Gömülü Sistemler ve Kart Donanım Becerileri (Skills) Motoru.
 *
 * IDE'de seçili olan kartın (FQBN / Kart Adı) mimarisini, pin kısıtlarını,
 * lojik voltaj seviyesini (3.3V vs 5V), bellek limitlerini ve resmi kütüphanelerini
 * tespit ederek yapay zekâya doğrudan donanım bağlamı ve resmi örnek kodlar sağlar.
 *
 * Kullanıcıların pin adlarına müdahale etmesine, yeni kart modelleri eklemesine
 * ve donanım özelliklerini değiştirmesine olanak tanır.
 */
export class BoardSkillEngine {
  private customProfilesFile: string | null = null
  private customData: Record<string, { models: BoardModelVariant[]; selectedModelId?: string; isCustom?: boolean }> = {}

  constructor(
    private arduinoCliService?: ArduinoCliService,
    private ragService?: RagService,
    private customSkillService?: CustomSkillService,
    private userDataPath?: string
  ) {
    if (this.userDataPath) {
      this.customProfilesFile = join(this.userDataPath, 'custom_board_profiles.json')
      this.loadCustomDataSync()
    }
  }

  private loadCustomDataSync(): void {
    if (!this.customProfilesFile) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fsSync = require('fs')
      if (fsSync.existsSync(this.customProfilesFile)) {
        const raw = fsSync.readFileSync(this.customProfilesFile, 'utf-8')
        this.customData = JSON.parse(raw)
      }
    } catch (err) {
      console.warn('[BoardSkillEngine] Özel kart profilleri yüklenemedi:', err)
    }
  }

  private async saveCustomData(): Promise<void> {
    if (!this.customProfilesFile) return
    try {
      await fs.writeFile(this.customProfilesFile, JSON.stringify(this.customData, null, 2), 'utf-8')
    } catch (err) {
      console.error('[BoardSkillEngine] Özel kart profilleri kaydedilemedi:', err)
    }
  }

  /**
   * Tüm tanımlı kart profillerini döner (varsayılanlar + kullanıcı özelleştirmeleri birleştirilir).
   */
  getAllBoardProfiles(): BoardProfileInfo[] {
    const profiles: BoardProfileInfo[] = JSON.parse(JSON.stringify(SABIT_KART_PROFILLERI))

    for (const p of profiles) {
      const custom = this.customData[p.family]
      if (custom && Array.isArray(custom.models) && custom.models.length > 0) {
        p.models = custom.models
        p.selectedModelId = custom.selectedModelId || custom.models[0].id
        p.isCustom = true

        const activeModel = p.models.find((m) => m.id === p.selectedModelId) || p.models[0]
        if (activeModel) {
          if (activeModel.voltage) p.voltage = activeModel.voltage
          if (activeModel.clockSpeed) p.clockSpeed = activeModel.clockSpeed
          if (activeModel.architecture) p.architecture = activeModel.architecture
          if (activeModel.flashRam) p.flashRam = activeModel.flashRam
          if (activeModel.features) p.features = activeModel.features
          if (activeModel.pins) p.pins = activeModel.pins
          if (activeModel.rules) p.rules = activeModel.rules
        }
      } else {
        p.selectedModelId = p.models[0]?.id
      }
    }

    return profiles
  }

  /**
   * Bir kart ailesine ait modeli günceller veya kaydeder.
   */
  async saveBoardModel(family: string, model: BoardModelVariant): Promise<boolean> {
    const profiles = this.getAllBoardProfiles()
    const p = profiles.find((x) => x.family.toLowerCase() === family.toLowerCase())
    if (!p) return false

    if (!this.customData[family]) {
      this.customData[family] = {
        models: JSON.parse(JSON.stringify(p.models)),
        selectedModelId: model.id,
        isCustom: true
      }
    }

    const idx = this.customData[family].models.findIndex((m) => m.id === model.id)
    model.isCustom = true
    if (idx >= 0) {
      this.customData[family].models[idx] = model
    } else {
      this.customData[family].models.push(model)
    }
    this.customData[family].selectedModelId = model.id
    this.customData[family].isCustom = true

    await this.saveCustomData()
    return true
  }

  /**
   * Yeni bir kart modeli ekler.
   */
  async addBoardModel(family: string, model: BoardModelVariant): Promise<boolean> {
    return await this.saveBoardModel(family, model)
  }

  /**
   * Kullanıcının eklediği modeli siler.
   */
  async deleteBoardModel(family: string, modelId: string): Promise<boolean> {
    if (!this.customData[family]) return false
    this.customData[family].models = this.customData[family].models.filter((m) => m.id !== modelId)
    if (this.customData[family].selectedModelId === modelId) {
      this.customData[family].selectedModelId = this.customData[family].models[0]?.id
    }
    await this.saveCustomData()
    return true
  }

  /**
   * Bir modeli veya tüm aileyi varsayılan fabrika ayarlarına sıfırlar.
   */
  async resetBoardModel(family: string, modelId?: string): Promise<boolean> {
    if (!this.customData[family]) return true

    if (modelId) {
      const defaultFamily = SABIT_KART_PROFILLERI.find((p) => p.family.toLowerCase() === family.toLowerCase())
      const defaultModel = defaultFamily?.models.find((m) => m.id === modelId)
      if (defaultModel) {
        const idx = this.customData[family].models.findIndex((m) => m.id === modelId)
        if (idx >= 0) {
          this.customData[family].models[idx] = JSON.parse(JSON.stringify(defaultModel))
        }
      } else {
        this.customData[family].models = this.customData[family].models.filter((m) => m.id !== modelId)
      }
    } else {
      delete this.customData[family]
    }

    await this.saveCustomData()
    return true
  }

  /**
   * Seçili kartın ait olduğu kart ailesini tespit eder.
   */
  detectBoardFamily(boardContext?: BoardContext): string {
    if (!boardContext || (!boardContext.name && !boardContext.fqbn)) {
      return 'general'
    }
    const fqbn = (boardContext.fqbn || '').toLowerCase()
    const name = (boardContext.name || '').toLowerCase()
    const platform = (boardContext.platformName || boardContext.platformId || '').toLowerCase()

    if (fqbn.includes('deneyap') || name.includes('deneyap') || platform.includes('deneyap')) return 'deneyap'
    if (fqbn.includes('esp32') || name.includes('esp32') || platform.includes('esp32')) return 'esp32'
    if (fqbn.includes('avr') || name.includes('uno') || name.includes('nano') || name.includes('mega')) return 'avr'
    if (fqbn.includes('rp2040') || name.includes('pico') || name.includes('rp2040')) return 'rp2040'
    if (fqbn.includes('stm32') || name.includes('stm32') || name.includes('bluepill')) return 'stm32'

    return 'general'
  }

  /**
   * Seçili karta ait mimari ve donanım becerilerini sistem promptuna enjekte edilecek metin olarak üretir.
   * Kullanıcının değiştirdiği pin haritası ve özel kuralları doğrudan dahil eder.
   */
  async getBoardSkillProfile(boardContext?: BoardContext): Promise<string> {
    const profiles = this.getAllBoardProfiles()
    const family = this.detectBoardFamily(boardContext)
    const profile =
      profiles.find((p) => p.family.toLowerCase() === family.toLowerCase()) ||
      profiles.find((p) => p.family === 'general') ||
      profiles[0]

    // Kart modelini tespit et
    let matchedModel: BoardModelVariant = profile.models[0]
    if (boardContext) {
      const fqbn = (boardContext.fqbn || '').toLowerCase()
      const name = (boardContext.name || '').toLowerCase()

      // 1. FQBN eşleşmesi
      const fqbnMatch = profile.models.find((m) => m.fqbnMatch?.some((f) => fqbn.includes(f.toLowerCase())))
      if (fqbnMatch) {
        matchedModel = fqbnMatch
      } else {
        // 2. Model isim parçaları eşleşmesi
        const nameMatch = profile.models.find((m) => {
          const parts = m.name.toLowerCase().split(/[\s()_/-]+/).filter((x) => x.length > 1)
          return parts.some((p) => name.includes(p) || fqbn.includes(p))
        })
        if (nameMatch) {
          matchedModel = nameMatch
        } else if (profile.selectedModelId) {
          const selected = profile.models.find((m) => m.id === profile.selectedModelId)
          if (selected) matchedModel = selected
        }
      }
    }

    let baseProfile = `[HEDEF KART DONANIM VE MİMARİ BİLGİSİ: ${profile.name} -> ${matchedModel.name}]
- Model / Çekirdek: ${matchedModel.architecture || profile.architecture}
- Mantık Voltajı: ${matchedModel.voltage || profile.voltage} (DİKKAT: 3.3V kartlara 5V bağlamayınız!)
- Saat Hızı: ${matchedModel.clockSpeed || profile.clockSpeed}
- Bellek Kapasitesi: ${matchedModel.flashRam || profile.flashRam}
- Kullanılabilir Pin Haritası (Kullanıcının Tanımladığı Pinler):
  ${matchedModel.pins.join(', ')}
- Öne Çıkan Donanım Özellikleri:
${(matchedModel.features || profile.features).map((f) => '  * ' + f).join('\n')}
- Mimari ve Kodlama Kuralları:
${(matchedModel.rules || profile.rules || []).map((r) => '  * ' + r).join('\n')}`

    if (matchedModel.isCustom) {
      baseProfile += `\n- [ÖZEL KULLANICI MODELİ / PİN YAPISI]: Bu kart modeli ve pinleri kullanıcı tarafından özel olarak yapılandırılmıştır. Yukarıdaki pin isimlerini ve donanım kısıtlarını kod üretirken kesinlikle baz alınız.`
    }

    // Kullanıcının eklediği özel mimari kuralları varsa bağlama ekle
    if (this.customSkillService) {
      const customRules = await this.customSkillService.getCustomRules(family)
      if (customRules.length > 0) {
        baseProfile += `\n\n════════════════════════════════════════════════════════\n[KULLANICIYA ÖZEL PROJE VE MİMARİ KURALLARI]:\n` + customRules.join('\n\n')
      }
    }

    return baseProfile
  }

  /**
   * Kullanıcının sorusuna veya promptuna göre, önce yerel RAG (multilingual-e5-small) üzerinden
   * semantik kod arar; bulunamazsa kurulu kütüphanelerin örneklerini kural tabanlı tarar.
   */
  async getRelevantExamplesContext(query: string, boardContext?: BoardContext): Promise<string> {
    if (!query || query.trim().length < 2) return ''

    // 1. ÖNCELİK: Yerel Çok Dilli RAG Motoru (multilingual-e5-small)
    if (this.ragService) {
      try {
        const ragSonuclari = await this.ragService.search(query, boardContext, 2)
        if (ragSonuclari.length > 0) {
          let ragMetni = ''
          for (const s of ragSonuclari) {
            ragMetni += `\n--- [RAG Referansı: ${s.chunk.title} (${s.chunk.sourceOwner})] ---\n\`\`\`cpp\n${s.chunk.content}\n\`\`\`\n`
          }

          return `\n════════════════════════════════════════════════════════
[RAG: DOĞRULANMIŞ RESMİ KÜTÜPHANE VE KOD REFERANSLARI (multilingual-e5-small)]
Aşağıdaki kod ve API referansları kullanıcının seçili kartına (${boardContext?.name || 'Gömülü Kart'}) özel taranmış resmi kaynaklardan getirilmiştir.
Yazacağın kodda bu gerçek fonksiyon adlarını, include başlıklarını ve kullanım kalıplarını referans al:
${ragMetni}════════════════════════════════════════════════════════\n`
        }
      } catch (err) {
        console.warn('[BoardSkillEngine] RAG araması sırasında hata, fallbacke geçiliyor:', err)
      }
    }

    // 2. YEDEK (FALLBACK): Kural ve Anahtar Kelime Tabanlı Örnek Kod Arama
    if (!this.arduinoCliService) return ''

    const q = query.toLowerCase()
    const anahtarlar: string[] = []
    if (q.includes('wifi') || q.includes('web') || q.includes('http') || q.includes('server')) anahtarlar.push('wifi', 'webserver', 'http')
    if (q.includes('blink') || q.includes('led')) anahtarlar.push('blink', 'led')
    if (q.includes('buton') || q.includes('button')) anahtarlar.push('button')
    if (q.includes('servo')) anahtarlar.push('servo')
    if (q.includes('imu') || q.includes('jiroskop') || q.includes('ivme') || q.includes('mpu')) anahtarlar.push('imu', 'mpu', 'gyro', 'accel')
    if (q.includes('oled') || q.includes('ekran') || q.includes('display')) anahtarlar.push('oled', 'display')
    if (q.includes('ble') || q.includes('bluetooth')) anahtarlar.push('ble', 'bluetooth')
    if (q.includes('serial') || q.includes('seri')) anahtarlar.push('serial')
    if (q.includes('analog') || q.includes('pot')) anahtarlar.push('analog')
    if (q.includes('i2c') || q.includes('wire')) anahtarlar.push('wire', 'i2c')

    if (anahtarlar.length === 0) return ''

    try {
      const gruplar = await this.arduinoCliService.listExamples()
      const eslesenler: Array<{ ownerName: string; name: string; folderPath: string; score: number }> = []

      const fqbn = (boardContext?.fqbn || '').toLowerCase()
      const boardIsDeneyap = fqbn.includes('deneyap')
      const boardIsEsp32 = fqbn.includes('esp32')

      for (const grup of gruplar) {
        const grupAdi = grup.ownerName.toLowerCase()
        const isCore = grup.source === 'core'

        for (const ornek of grup.examples) {
          const ornekAdi = ornek.name.toLowerCase()
          let score = 0

          for (const anahtar of anahtarlar) {
            if (ornekAdi.includes(anahtar)) score += 3
            if (grupAdi.includes(anahtar)) score += 2
          }

          if (boardIsDeneyap && (grupAdi.includes('deneyap') || isCore)) score += 2
          if (boardIsEsp32 && (grupAdi.includes('esp32') || isCore)) score += 1

          if (score > 0) {
            eslesenler.push({
              ownerName: grup.ownerName,
              name: ornek.name,
              folderPath: ornek.folderPath,
              score
            })
          }
        }
      }

      if (eslesenler.length === 0) return ''

      eslesenler.sort((a, b) => b.score - a.score)
      const secilenler = eslesenler.slice(0, 2)

      let ornekMetinleri = ''
      for (const secilen of secilenler) {
        try {
          const dosyalar = await fs.readdir(secilen.folderPath)
          const inoDosyasi = dosyalar.find((d) => d.endsWith('.ino'))
          if (inoDosyasi) {
            const tamYol = join(secilen.folderPath, inoDosyasi)
            const icerik = await fs.readFile(tamYol, 'utf-8')
            const kisaltilmis = icerik.split('\n').slice(0, 120).join('\n').slice(0, 3000)
            ornekMetinleri += `\n--- [Resmi Örnek: ${secilen.ownerName} / ${secilen.name}] ---\n\`\`\`cpp\n${kisaltilmis}\n\`\`\`\n`
          }
        } catch {
          // Dosya okuma hatası yok sayılır
        }
      }

      if (ornekMetinleri) {
        return `\n════════════════════════════════════════════════════════
KURULU KART VE KÜTÜPHANELERDEN İLGİLİ RESMİ ÖRNEK KODLAR:
Aşağıdaki örnek kodlar kullanıcının seçili kartına ve kurulu kütüphanelerine aittir.
Yazacağın kodda bu resmi kütüphane fonksiyonlarını, include başlıklarını ve kullanım kalıplarını referans al:
${ornekMetinleri}
════════════════════════════════════════════════════════\n`
      }
    } catch (err) {
      console.warn('[BoardSkillEngine] Örnek kodlar taranırken hata:', err)
    }

    return ''
  }
}
