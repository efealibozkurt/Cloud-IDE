/**
 * Linux'ta seri portlar (/dev/ttyUSB*, /dev/ttyACM*) varsayılan olarak yalnızca `dialout` grubuna açıktır
 * (Arch tabanlı dağıtımlarda `uucp`). Kullanıcı bu grupta değilse port açma ve karta yükleme "izin yok"
 * hatasıyla başarısız olur. Bu yardımcı, hata metninden bu durumu tanıyıp çözümü anlatan bir ipucu döner.
 */
const IZIN_HATASI = /permission denied|EACCES|Errno 13|access denied/i

export const LINUX_SERI_IZIN_IPUCU =
  'Linux’ta seri porta erişim izniniz yok. Kullanıcınızı dialout grubuna ekleyin: ' +
  '`sudo usermod -aG dialout $USER` (Arch tabanlı dağıtımlarda grup adı uucp), ardından oturumu kapatıp yeniden açın.'

export function seriIzinIpucu(hataMetni: string | undefined | null, platform: string = process.platform): string | null {
  if (platform !== 'linux' || !hataMetni) return null
  return IZIN_HATASI.test(hataMetni) ? LINUX_SERI_IZIN_IPUCU : null
}

/** Hata metnine (gerekiyorsa) Linux izin ipucunu ekler */
export function izinIpucuylaBirlestir(hataMetni: string, platform: string = process.platform): string {
  const ipucu = seriIzinIpucu(hataMetni, platform)
  return ipucu ? `${hataMetni}\n${ipucu}` : hataMetni
}
