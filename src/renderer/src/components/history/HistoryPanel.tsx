import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { fqbnSecenekleriyle, temelFqbn } from '@shared/boardFqbn'
import { useAppState } from '../../state/AppStateContext'
import { useToast } from '../../state/ToastContext'
import { Tus } from '../common/Tus'
import { useI18n, type TFonksiyonu } from '../../i18n'
import ConfirmModal from '../common/ConfirmModal'
import HistoryDiffModal from './HistoryDiffModal'
import type { BuildMeta, HistoryCommit, HistoryDiffFile, HistoryListResult, HistoryStatus } from '@shared/types'

const TUR_ETIKETI: Record<HistoryCommit['tur'], string> = {
  elle: '',
  otomatik: 'otomatik',
  'agent-oncesi': 'yapay zekâ öncesi',
  'geri-yukleme-oncesi': 'geri yükleme öncesi',
  derleme: 'derleme'
}

function kb(bayt: number, yerel: string): string {
  return `${(bayt / 1024).toLocaleString(yerel, { maximumFractionDigits: 1 })} KB`
}

/** Bellek kullanımı özeti: "Flash %12 · RAM %8" ve bir önceki derlemeye göre flash farkı */
function boyutOzeti(derleme: BuildMeta, yerel: string, onceki?: BuildMeta): string {
  const parcalar: string[] = []
  const f = derleme.boyut?.flash
  const ram = derleme.boyut?.ram
  if (f) {
    let metin = `Flash %${Math.round((f.kullanilan / f.azami) * 100)}`
    const of = onceki?.boyut?.flash
    if (of && of.kullanilan !== f.kullanilan) {
      const fark = f.kullanilan - of.kullanilan
      metin += ` (${fark > 0 ? '+' : '−'}${kb(Math.abs(fark), yerel)})`
    }
    parcalar.push(metin)
  }
  if (ram) parcalar.push(`RAM %${Math.round((ram.kullanilan / ram.azami) * 100)}`)
  return parcalar.join(' · ')
}

/** Geri yüklenecek sürümün derlendiği ortam, şu anki ortamla uyuşmuyorsa uyarı metinleri üretir. */
function ortamUyarilari(derleme: BuildMeta, simdikiFqbn: string | null, kurulu: Record<string, string> | null, t: TFonksiyonu): string[] {
  const uyarilar: string[] = []
  if (simdikiFqbn && derleme.fqbn !== simdikiFqbn) uyarilar.push(t('Kart farklı: sürüm {a} için derlenmiş, şu an {b} seçili.', { a: derleme.fqbn, b: simdikiFqbn }))
  if (kurulu) {
    for (const [ad, surum] of Object.entries(derleme.kutuphaneler)) {
      const simdiki = kurulu[ad]
      if (simdiki === undefined) uyarilar.push(t('“{ad}” {surum} kurulu değil.', { ad, surum }))
      else if (simdiki !== surum) uyarilar.push(t('“{ad}” sürümü farklı: {surum} → şu an {simdiki}.', { ad, surum, simdiki }))
    }
  }
  return uyarilar
}

function gorelZaman(ms: number, t: TFonksiyonu, yerel: string): string {
  const sn = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (sn < 60) return t('şimdi')
  if (sn < 3600) return t('{n} dk önce', { n: Math.floor(sn / 60) })
  if (sn < 86400) return t('{n} sa önce', { n: Math.floor(sn / 3600) })
  if (sn < 86400 * 30) return t('{n} gün önce', { n: Math.floor(sn / 86400) })
  return new Date(ms).toLocaleDateString(yerel)
}

function klasorAdi(yol: string): string {
  return yol.split(/[\\/]/).filter(Boolean).pop() ?? yol
}

type Girdi = { tur: 'etiket' | 'dal'; id: string } | null
type Onay = { tur: 'geri-yukle'; surum: HistoryCommit } | { tur: 'dal-sil'; ad: string } | null

/** Proje sürüm geçmişi: sürüm kaydet, eski hallere bak, karşılaştır, geri yükle, etiket ve dal. */
function HistoryPanel(): ReactElement {
  const { dil, t } = useI18n()
  const yerel = dil === 'en' ? 'en-US' : 'tr-TR'
  const { state, saveAllTabs, reloadSketchFolders, addSketchToWorkspace } = useAppState()
  const { toastGoster } = useToast()
  const proje = state.sketch.activeSketchPath || state.sketch.info?.folderPath || null
  const [liste, setListe] = useState<HistoryListResult | null>(null)
  const [durum, setDurum] = useState<HistoryStatus | null>(null)
  const [mesaj, setMesaj] = useState('')
  const [mesgul, setMesgul] = useState(false)
  const [girdi, setGirdi] = useState<Girdi>(null)
  const [girdiDegeri, setGirdiDegeri] = useState('')
  const [onay, setOnay] = useState<Onay>(null)
  const [fark, setFark] = useState<{ baslik: string; dosyalar: HistoryDiffFile[] } | null>(null)
  const [kurulu, setKurulu] = useState<Record<string, string> | null>(null)

  const yenile = useCallback(async (): Promise<void> => {
    if (!proje) {
      setListe(null)
      setDurum(null)
      return
    }
    try {
      const [l, s] = await Promise.all([window.api.history.list(proje), window.api.history.status(proje)])
      setListe(l)
      setDurum(s)
    } catch {
      setListe(null)
      setDurum(null)
    }
  }, [proje])

  // Dosya kaydedildikçe değişiklik sayısı güncellenir
  const kaydedilmisImza = state.sketch.tabs.map((sekme) => `${sekme.path}:${sekme.savedContent.length}`).join('|')
  useEffect(() => {
    void yenile()
  }, [yenile, kaydedilmisImza])

  const calistir = async (is: () => Promise<void>, hataMetni: string): Promise<void> => {
    setMesgul(true)
    try {
      await is()
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : hataMetni, 'hata')
    } finally {
      setMesgul(false)
      await yenile()
    }
  }

  const surumKaydet = (): Promise<void> =>
    calistir(async () => {
      if (!proje) return
      await saveAllTabs()
      const sonuc = await window.api.history.commit(proje, mesaj)
      if (sonuc) {
        setMesaj('')
        toastGoster(t('Sürüm kaydedildi'), 'basari')
      } else {
        toastGoster(t('Son sürümden bu yana değişiklik yok'), 'bilgi')
      }
    }, t('Sürüm kaydedilemedi'))

  const karsilastir = (baslik: string, a: string, b: string): Promise<void> =>
    calistir(async () => {
      if (!proje) return
      if (b === 'calisma') await saveAllTabs()
      setFark({ baslik, dosyalar: await window.api.history.diff(proje, a, b) })
    }, t('Karşılaştırma yapılamadı'))

  const geriYukle = (s: HistoryCommit): Promise<void> =>
    calistir(async () => {
      if (!proje) return
      const degisen = await window.api.history.restore(proje, s.id)
      await reloadSketchFolders([proje])
      toastGoster(degisen.length ? t('{n} dosya geri yüklendi', { n: degisen.length }) : t('Dosyalar zaten bu sürümde'), degisen.length ? 'basari' : 'bilgi')
    }, t('Geri yüklenemedi'))

  const girdiyiUygula = (): Promise<void> =>
    calistir(async () => {
      if (!proje || !girdi) return
      const ad = girdiDegeri.trim()
      if (!ad) return
      if (girdi.tur === 'etiket') {
        await window.api.history.tag(proje, girdi.id, ad)
      } else {
        await saveAllTabs()
        await window.api.history.createBranch(proje, ad, girdi.id)
        await reloadSketchFolders([proje])
      }
      setGirdi(null)
      setGirdiDegeri('')
    }, t('İşlem tamamlanamadı'))

  const dalDegistir = (ad: string): Promise<void> =>
    calistir(async () => {
      if (!proje) return
      await saveAllTabs()
      await window.api.history.checkout(proje, ad)
      await reloadSketchFolders([proje])
    }, t('Dal değiştirilemedi'))

  const paketIceAktar = (): Promise<void> =>
    calistir(async () => {
      const klasor = await window.api.history.importPackage()
      if (!klasor) return
      await addSketchToWorkspace(await window.api.sketch.openPath(klasor))
      toastGoster(t('Proje içe aktarıldı, geçmişiyle birlikte çalışma alanına eklendi'), 'basari')
    }, t('Paket içe aktarılamadı'))

  const paketDisaAktar = (): Promise<void> =>
    calistir(async () => {
      if (!proje) return
      await saveAllTabs()
      const dosya = await window.api.history.exportPackage(proje)
      if (dosya) toastGoster(t('Proje paketi kaydedildi'), 'basari')
    }, t('Paket oluşturulamadı'))

  if (!proje) {
    return (
      <div className="px-3 py-4">
        <p className="text-xs text-gray-500">{t('Sürüm geçmişi için önce bir proje açın.')}</p>
        <div className="mt-3">
          <Tus onClick={() => void paketIceAktar()} disabled={mesgul}>
            {t('Paket içe aktar (.zip)')}
          </Tus>
        </div>
      </div>
    )
  }

  const degisiklikSayisi = durum?.degisenler.length ?? 0
  const sonSurum = liste?.surumler[0]
  const sonDerlenen = liste?.surumler.find((x) => x.derleme)

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-panel-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-gray-200" title={proje}>
            {klasorAdi(proje)}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-gray-500">
            <span className={`h-1.5 w-1.5 rounded-full ${degisiklikSayisi ? 'bg-amber-400' : 'bg-[#3ddc84]'}`} aria-hidden="true" />
            {degisiklikSayisi ? t('{n} değişiklik', { n: degisiklikSayisi }) : liste?.surumler.length ? t('güncel') : t('kayıt yok')}
          </span>
        </div>
        <input
          value={mesaj}
          onChange={(e) => setMesaj(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !mesgul) void surumKaydet()
          }}
          maxLength={200}
          placeholder={t('Sürüm notu (isteğe bağlı)')}
          className="h-7 w-full rounded-[5px] border border-panel-border bg-panel px-2 text-xs text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent"
        />
        <div className="flex gap-2">
          <Tus tur="birincil" onClick={() => void surumKaydet()} disabled={mesgul}>
            {t('Sürüm kaydet')}
          </Tus>
          <Tus
            onClick={() => sonSurum && void karsilastir(t('Son sürüm ↔ çalışma kopyası'), sonSurum.id, 'calisma')}
            disabled={mesgul || !sonSurum || degisiklikSayisi === 0}
          >
            {t('Değişiklikleri gör')}
          </Tus>
        </div>
        {sonDerlenen && degisiklikSayisi > 0 && (
          <button
            onClick={() => void karsilastir(t('Son derlenen sürüm ↔ çalışma kopyası'), sonDerlenen.id, 'calisma')}
            disabled={mesgul}
            className="text-left text-[11px] text-accent hover:underline disabled:opacity-50"
          >
            {t('Derleme hatası mı aldınız? Son derlenen sürümden bu yana ne değişti')} →
          </button>
        )}
        {liste && (
          <div className="flex items-center gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-gray-500">
              {t('Dal')}
              <select
                value={liste.aktifDal}
                disabled={mesgul}
                onChange={(e) => void dalDegistir(e.target.value)}
                className="h-6 min-w-0 flex-1 rounded-[4px] border border-panel-border bg-panel px-1 text-xs text-gray-200 outline-none focus:border-accent"
              >
                {liste.dallar.length === 0 && <option value={liste.aktifDal}>{liste.aktifDal}</option>}
                {liste.dallar.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            {liste.aktifDal !== 'ana' && (
              <Tus tur="tehlike" onClick={() => setOnay({ tur: 'dal-sil', ad: liste.aktifDal })} disabled={mesgul}>
                {t('Dalı sil')}
              </Tus>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!liste || liste.surumler.length === 0 ? (
          <p className="px-3 py-4 text-xs leading-relaxed text-gray-500">
            {t('Bu proje için henüz sürüm yok. “Sürüm kaydet” ile bugünkü halini saklayın; sonradan değişiklikleri karşılaştırıp istediğiniz sürüme dönebilirsiniz.')}
          </p>
        ) : (
          <ul className="py-1">
            {liste.surumler.map((s, i) => {
              const onceki = liste.surumler[i + 1]
              // En yeni sürümde (dal ucu) düğme, çalışma kopyası ondan farklıysa görünür: eski bir sürüme
              // dönüldükten sonra yeniye geri dönebilmek için gerekir
              const geriYuklenebilir = i > 0 || (durum !== null && durum.degisenler.length > 0)
              return (
                <li key={s.id} className="group border-b border-panel-border/50 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-gray-100" title={s.mesaj}>
                        {s.mesaj}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                        <span>{gorelZaman(s.zaman, t, yerel)}</span>
                        {TUR_ETIKETI[s.tur] && <span>· {t(TUR_ETIKETI[s.tur])}</span>}
                        {s.etiketler.map((e) => (
                          <span key={e} className="rounded-[3px] border border-accent/40 px-1 text-accent">
                            {e}
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                  {s.derleme && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-500" title={`${s.derleme.fqbn}${s.derleme.cekirdek ? ` · ${t('çekirdek')} ${s.derleme.cekirdek.ad} ${s.derleme.cekirdek.surum}` : ''}`}>
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#3ddc84]" aria-hidden="true" />
                        {s.derleme.yuklendi ? t('derlendi ve yüklendi') : t('derlendi')}
                      </span>
                      {boyutOzeti(s.derleme, yerel, liste.surumler.slice(i + 1).find((x) => x.derleme)?.derleme) && (
                        <span className="font-mono text-[10.5px]">{boyutOzeti(s.derleme, yerel, liste.surumler.slice(i + 1).find((x) => x.derleme)?.derleme)}</span>
                      )}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    {onceki && (
                      <Tus onClick={() => void karsilastir(`${onceki.mesaj} → ${s.mesaj}`, onceki.id, s.id)} disabled={mesgul}>
                        {t('Fark')}
                      </Tus>
                    )}
                    <Tus onClick={() => void karsilastir(`${s.mesaj} ↔ ${t('çalışma kopyası')}`, s.id, 'calisma')} disabled={mesgul}>
                      {t('Şimdikiyle')}
                    </Tus>
                    {geriYuklenebilir && (
                      <Tus
                      onClick={() => {
                        setOnay({ tur: 'geri-yukle', surum: s })
                        setKurulu(null)
                        if (s.derleme) {
                          void window.api.arduinoCli
                            .listLibraries()
                            .then((l) => setKurulu(Object.fromEntries(l.map((k) => [k.name, k.version]))))
                            .catch(() => undefined)
                        }
                      }}
                      disabled={mesgul}
                    >
                        {i === 0 ? t('Bu sürüme dön') : t('Geri yükle')}
                      </Tus>
                    )}
                    <Tus
                      onClick={() => {
                        setGirdi({ tur: 'etiket', id: s.id })
                        setGirdiDegeri('')
                      }}
                      disabled={mesgul}
                    >
                      {t('Etiket')}
                    </Tus>
                    <Tus
                      onClick={() => {
                        setGirdi({ tur: 'dal', id: s.id })
                        setGirdiDegeri('')
                      }}
                      disabled={mesgul}
                    >
                      {t('Dal aç')}
                    </Tus>
                  </div>
                  {girdi?.id === s.id && (
                    <form
                      className="mt-2 flex gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void girdiyiUygula()
                      }}
                    >
                      <input
                        autoFocus
                        value={girdiDegeri}
                        onChange={(e) => setGirdiDegeri(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setGirdi(null)
                        }}
                        maxLength={40}
                        placeholder={girdi.tur === 'etiket' ? t('Etiket adı (ör. v1.0)') : t('Yeni dal adı')}
                        className="h-[26px] min-w-0 flex-1 rounded-[5px] border border-panel-border bg-panel px-2 text-xs text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent"
                      />
                      <Tus type="submit" tur="birincil" disabled={mesgul || !girdiDegeri.trim()}>
                        {t('Ekle')}
                      </Tus>
                    </form>
                  )}
                  {s.etiketler.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {s.etiketler.map((e) => (
                        <button
                          key={e}
                          onClick={() => void calistir(() => window.api.history.untag(proje, e), t('Etiket kaldırılamadı'))}
                          className="text-[10.5px] text-gray-600 hover:text-rose-300"
                          title={t('Etiketi kaldır')}
                        >
                          {t('{e} etiketini kaldır', { e })}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-panel-border px-3 py-2">
        <Tus onClick={() => void paketDisaAktar()} disabled={mesgul} >
          {t('Paketle (.zip)')}
        </Tus>
        <Tus onClick={() => void paketIceAktar()} disabled={mesgul}>
          {t('İçe aktar')}
        </Tus>
      </div>

      {onay?.tur === 'geri-yukle' && (
        <ConfirmModal
          baslik={t('Bu sürüme dönülsün mü?')}
          onayMetni={t('Geri yükle')}
          onOnay={() => {
            const s = onay.surum
            setOnay(null)
            void geriYukle(s)
          }}
          onVazgec={() => setOnay(null)}
        >
          <p>{t('“{ad}” sürümündeki dosyalar çalışma kopyasına yazılacak. Kaydedilmemiş düzenlemeleriniz bu dosyalarda değişebilir.', { ad: onay.surum.mesaj })}</p>
          {onay.surum.derleme && (
            <div className="mt-2 rounded-[5px] border border-panel-border bg-panel px-2.5 py-2">
              <p className="text-gray-300">{t('Bu sürüm şu ortamla derlenmişti:')}</p>
              <p className="mt-1 font-mono text-[11px] text-gray-400">
                {onay.surum.derleme.fqbn}
                {onay.surum.derleme.cekirdek?.surum ? ` · ${onay.surum.derleme.cekirdek.ad} ${onay.surum.derleme.cekirdek.surum}` : ''}
              </p>
              {Object.keys(onay.surum.derleme.kutuphaneler).length > 0 && (
                <p className="mt-0.5 font-mono text-[11px] text-gray-500">
                  {Object.entries(onay.surum.derleme.kutuphaneler)
                    .map(([ad, v]) => `${ad} ${v}`)
                    .join(', ')}
                </p>
              )}
              {ortamUyarilari(onay.surum.derleme, state.arduinoCli.selectedFqbn ? fqbnSecenekleriyle(state.arduinoCli.selectedFqbn, state.settings?.boardOptions?.[temelFqbn(state.arduinoCli.selectedFqbn)]) : null, kurulu, t).map((u) => (
                <p key={u} className="mt-1 text-amber-300/90">
                  ⚠ {u}
                </p>
              ))}
            </div>
          )}
          <p className="mt-2">{t('Bugünkü hal otomatik olarak “geri yükleme öncesi” kaydıyla saklanır; istediğiniz zaman oradan geri dönebilirsiniz.')}</p>
        </ConfirmModal>
      )}
      {onay?.tur === 'dal-sil' && (
        <ConfirmModal
          baslik={t('“{ad}” dalı silinsin mi?', { ad: onay.ad })}
          onayMetni={t('Dalı sil')}
          tehlikeli
          onOnay={() => {
            const ad = onay.ad
            setOnay(null)
            void calistir(async () => {
              if (!proje) return
              await saveAllTabs()
              await window.api.history.checkout(proje, 'ana')
              await window.api.history.deleteBranch(proje, ad)
              await reloadSketchFolders([proje])
            }, t('Dal silinemedi'))
          }}
          onVazgec={() => setOnay(null)}
        >
          <p>{t('Önce “ana” dala geçilir, sonra bu dalın kaydı kaldırılır. Dalda yapılan sürümler listeden kaybolur.')}</p>
        </ConfirmModal>
      )}
      {fark && <HistoryDiffModal baslik={fark.baslik} dosyalar={fark.dosyalar} onKapat={() => setFark(null)} />}
    </div>
  )
}

export default HistoryPanel
