import type { ReactElement } from 'react'
import { useT } from '../../i18n'
import { KABLO_RENK_HEX, type BaglantiHatti, type BaglantiKilavuzu } from '@shared/baglantiKilavuzu'

interface KartSemasiSvgProps {
  kilavuz: BaglantiKilavuzu
  vurguluBilesen: string | null
  vurguluHatId: string | null
  tamamlananlar: Set<string>
  onHatHover: (id: string | null) => void
  onHatToggle: (id: string) => void
}

function gucHattiMi(hat: BaglantiHatti): boolean {
  const k = `${hat.kartPini} ${hat.bilesenPini}`.toLowerCase()
  return /\b(5v|3\.3v|3v3|vcc|gnd|vin|toprak)\b/.test(k)
}

function hatlariTarafaBol(baglantilar: BaglantiHatti[]): { sol: BaglantiHatti[]; sag: BaglantiHatti[] } {
  const bilesenSayisi = new Set(baglantilar.map((b) => b.bilesen)).size
  if (bilesenSayisi <= 1) {
    const sol: BaglantiHatti[] = []
    const sag: BaglantiHatti[] = []
    for (const h of baglantilar) {
      if (gucHattiMi(h)) sol.push(h)
      else sag.push(h)
    }
    if (sol.length === 0 && sag.length > 1) {
      const yari = Math.ceil(sag.length / 2)
      return { sol: sag.slice(0, yari), sag: sag.slice(yari) }
    }
    if (sag.length === 0 && sol.length > 1) {
      const yari = Math.ceil(sol.length / 2)
      return { sol: sol.slice(0, yari), sag: sol.slice(yari) }
    }
    return { sol, sag }
  }

  const tarafHaritasi = new Map<string, 'sol' | 'sag'>()
  let solSayi = 0
  let sagSayi = 0
  const sol: BaglantiHatti[] = []
  const sag: BaglantiHatti[] = []

  const gruplar = new Map<string, BaglantiHatti[]>()
  for (const h of baglantilar) {
    const mevcut = gruplar.get(h.bilesen)
    if (mevcut) mevcut.push(h)
    else gruplar.set(h.bilesen, [h])
  }

  for (const [bilesen, liste] of gruplar) {
    const hedef: 'sol' | 'sag' = sagSayi <= solSayi ? 'sag' : 'sol'
    tarafHaritasi.set(bilesen, hedef)
    if (hedef === 'sag') sagSayi += liste.length
    else solSayi += liste.length
  }

  for (const h of baglantilar) {
    if (tarafHaritasi.get(h.bilesen) === 'sol') sol.push(h)
    else sag.push(h)
  }
  return { sol, sag }
}

function kisalt(metin: string, max: number): string {
  return metin.length <= max ? metin : `${metin.slice(0, max - 1)}…`
}

/**
 * Koddan veya Cloud AI verisinden üretilen devre bağlantılarını etkileşimli SVG kart şeması olarak çizer.
 * Hatların üzerine gelmek kabloyu vurgular; tıklamak "Bağladım ✓" durumunu değiştirir.
 */
function KartSemasiSvg({
  kilavuz,
  vurguluBilesen,
  vurguluHatId,
  tamamlananlar,
  onHatHover,
  onHatToggle
}: KartSemasiSvgProps): ReactElement {
  const t = useT()
  if (kilavuz.baglantilar.length === 0) {
    return (
      <div className="flex h-full min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-panel-border bg-panel/60 px-4 py-6 text-center">
        <p className="text-xs font-medium text-gray-300">{t('Çizilecek pin veya kablo bağlantısı bulunamadı')}</p>
        <p className="mt-1 max-w-xs text-[11px] text-gray-500">
          {t('Kodunuza pin veya sensör ekleyin ya da sağ üstten')} <span className="font-medium text-gray-300">{t('AI ile Oluştur')}</span> {t('düğmesiyle tam bağlantı şeması hazırlayın.')}
        </p>
      </div>
    )
  }

  const { sol, sag } = hatlariTarafaBol(kilavuz.baglantilar)
  const satirSayisi = Math.max(sol.length, sag.length, 2)
  const ROW_H = 38
  const TOP_Y = 78
  const svgH = Math.max(196, TOP_Y + satirSayisi * ROW_H + 26)
  const pcbX = 274
  const pcbW = 192
  const pcbY = 24
  const pcbH = svgH - 36
  const vurguluVar = Boolean(vurguluHatId || vurguluBilesen)

  const hatCiz = (hat: BaglantiHatti, idx: number, taraf: 'sol' | 'sag'): ReactElement => {
    const y = TOP_Y + idx * ROW_H
    const renk = KABLO_RENK_HEX[hat.renk]?.hex ?? '#38bdf8'
    const aktifMi = vurguluHatId === hat.id || (vurguluBilesen !== null && hat.bilesen === vurguluBilesen)
    const tamamMi = tamamlananlar.has(hat.id)
    const saydamlik = vurguluVar ? (aktifMi ? 1 : 0.2) : tamamMi ? 0.68 : 0.94

    const disX = taraf === 'sol' ? 174 : 566
    const pedX = taraf === 'sol' ? pcbX : pcbX + pcbW
    const kontrolSapma = (idx % 2 === 0 ? -1 : 1) * 5
    const cx1 = disX + (pedX - disX) * 0.45
    const cx2 = disX + (pedX - disX) * 0.55
    const kabloYolu = `M ${disX} ${y} C ${cx1} ${y + kontrolSapma}, ${cx2} ${y - kontrolSapma}, ${pedX} ${y}`

    const pillX = taraf === 'sol' ? 10 : 566
    const pillW = 164
    const pedKutuX = taraf === 'sol' ? pcbX + 6 : pcbX + pcbW - 84
    const pedYaziX = taraf === 'sol' ? pcbX + 12 : pcbX + pcbW - 12

    return (
      <g
        key={hat.id}
        style={{ opacity: saydamlik, transition: 'opacity 150ms ease' }}
        className="cursor-pointer"
        onMouseEnter={() => onHatHover(hat.id)}
        onMouseLeave={() => onHatHover(null)}
        onClick={() => onHatToggle(hat.id)}
      >
        <title>
          {hat.bilesen} ({hat.bilesenPini}) → {hat.kartPini} · {KABLO_RENK_HEX[hat.renk]?.ad ?? hat.renk} kablo
          {hat.not ? `\n${hat.not}` : ''}
        </title>

        {/* Tıklama kolaylığı için görünmez kalın kablo yolu */}
        <path d={kabloYolu} fill="none" stroke="transparent" strokeWidth={12} />

        {/* Aktif vurgu parıltısı */}
        {aktifMi && (
          <path d={kabloYolu} fill="none" stroke={renk} strokeWidth={6} strokeOpacity={0.25} strokeLinecap="round" />
        )}

        {/* Asıl jumper kablo çizgisi */}
        <path
          d={kabloYolu}
          fill="none"
          stroke={renk}
          strokeWidth={aktifMi ? 3 : 2.2}
          strokeLinecap="round"
          strokeDasharray={tamamMi && !aktifMi ? '5 3' : undefined}
        />

        {/* Dış bileşen etiketi */}
        <rect
          x={pillX}
          y={y - 14}
          width={pillW}
          height={28}
          rx={6}
          fill={aktifMi ? '#1c2b3a' : '#181d25'}
          stroke={tamamMi ? '#34d399' : aktifMi ? '#7cc4f0' : '#334155'}
          strokeWidth={aktifMi || tamamMi ? 1.25 : 0.9}
        />
        <circle cx={taraf === 'sol' ? pillX + pillW - 9 : pillX + 9} cy={y} r={3.5} fill={renk} />
        {tamamMi && (
          <circle
            cx={taraf === 'sol' ? pillX + 9 : pillX + pillW - 9}
            cy={y}
            r={4.5}
            fill="#10b981"
          />
        )}
        <text
          x={taraf === 'sol' ? (tamamMi ? pillX + 18 : pillX + 9) : pillX + 18}
          y={y - 2}
          fill="#e2e8f0"
          fontSize="10"
          fontWeight="600"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {kisalt(hat.bilesen, 18)}
        </text>
        <text
          x={taraf === 'sol' ? (tamamMi ? pillX + 18 : pillX + 9) : pillX + 18}
          y={y + 9}
          fill="#94a3b8"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
          {kisalt(hat.bilesenPini, 20)}
        </text>

        {/* PCB kenar lehim pedi ve pin etiketi */}
        <circle cx={pedX} cy={y} r={4.2} fill="#141920" stroke={renk} strokeWidth={2} />
        <rect
          x={pedKutuX}
          y={y - 10}
          width={78}
          height={20}
          rx={4}
          fill={aktifMi ? 'rgba(14,127,196,0.22)' : 'rgba(255,255,255,0.04)'}
          stroke={aktifMi ? '#38bdf8' : 'rgba(255,255,255,0.08)'}
          strokeWidth={0.8}
        />
        <text
          x={pedYaziX}
          y={y + 3.5}
          textAnchor={taraf === 'sol' ? 'start' : 'end'}
          fill={aktifMi ? '#e0f2fe' : '#cbd5e1'}
          fontSize="9.5"
          fontWeight="500"
          fontFamily="ui-monospace, monospace"
        >
          {kisalt(hat.kartPini, 12)}
        </text>
      </g>
    )
  }

  return (
    <svg
      viewBox={`0 0 740 ${svgH}`}
      className="h-auto w-full select-none"
      role="img"
      aria-label={`${kilavuz.kartAdi} ${t('etkileşimli bağlantı şeması')}`}
    >
      {/* Arka plan hafif mühendislik ızgarası */}
      <defs>
        <pattern id="baglanti-izgara" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(124,196,240,0.045)" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={740} height={svgH} rx={10} fill="#13171d" />
      <rect x={0} y={0} width={740} height={svgH} rx={10} fill="url(#baglanti-izgara)" />

      {/* Merkez PCB gövdesi */}
      <rect x={pcbX} y={pcbY} width={pcbW} height={pcbH} rx={14} fill="#17202b" stroke="#28425c" strokeWidth={1.4} />
      <rect
        x={pcbX + 6}
        y={pcbY + 6}
        width={pcbW - 12}
        height={pcbH - 12}
        rx={10}
        fill="none"
        stroke="rgba(124,196,240,0.12)"
        strokeWidth={0.8}
        strokeDasharray="3 3"
      />

      {/* USB soketi */}
      <rect x={342} y={pcbY - 10} width={56} height={18} rx={4} fill="#334155" stroke="#64748b" strokeWidth={1} />
      <rect x={352} y={pcbY - 6} width={36} height={6} rx={2} fill="#0f172a" />

      {/* Kart adı ve mantık voltajı */}
      <text
        x={370}
        y={pcbY + 26}
        textAnchor="middle"
        fill="#f1f5f9"
        fontSize="11.5"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {kisalt(kilavuz.kartAdi, 22)}
      </text>
      <rect
        x={338}
        y={pcbY + 32}
        width={64}
        height={16}
        rx={8}
        fill={kilavuz.mantikVoltaj === '3.3V' ? 'rgba(56,189,248,0.14)' : 'rgba(245,158,11,0.14)'}
        stroke={kilavuz.mantikVoltaj === '3.3V' ? 'rgba(56,189,248,0.45)' : 'rgba(245,158,11,0.45)'}
        strokeWidth={0.8}
      />
      <text
        x={370}
        y={pcbY + 43}
        textAnchor="middle"
        fill={kilavuz.mantikVoltaj === '3.3V' ? '#7cc4f0' : '#fbbf24'}
        fontSize="8.5"
        fontWeight="600"
        fontFamily="ui-monospace, monospace"
      >
        {kilavuz.mantikVoltaj} {t('LOJİK')}
      </text>

      {/* Sol ve sağ kablo hatları */}
      {sol.map((h, i) => hatCiz(h, i, 'sol'))}
      {sag.map((h, i) => hatCiz(h, i, 'sag'))}
    </svg>
  )
}

export default KartSemasiSvg
