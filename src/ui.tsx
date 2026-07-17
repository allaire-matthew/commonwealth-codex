import { useEffect, useState, type ReactNode } from 'react'
import type { PhoneTier } from './geo'
import { TIER_COLOR, TIER_INK, TIER_LABEL, TIER_SHORT } from './colors'
import { faviconUrl, type OrgInfo } from './orgs'

/** Count-up on first paint — the "this site is alive" cue every good
 *  civic tracker uses. Skipped for non-numeric values and for visitors
 *  who prefer reduced motion. */
const REDUCE_MOTION =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function useCountUp(value: string): string {
  const target = /^\d+$/.test(value) ? Number(value) : null
  const animate = target != null && !REDUCE_MOTION
  const [shown, setShown] = useState(animate ? 0 : target ?? NaN)
  useEffect(() => {
    if (!animate) return
    const t0 = performance.now()
    const dur = 650
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      setShown(Math.round(target * (1 - (1 - p) ** 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate, target])
  return target == null ? value : String(shown)
}

/** KPI stat tile — value in proportional figures (DESIGN.md C1/E2). */
export function StatTile({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  const shown = useCountUp(value)
  return (
    <div className="min-w-0">
      <div className="text-[11.5px] leading-tight uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
        {label}
      </div>
      <div className="font-display text-[30px] font-bold leading-9 tnum" style={{ color: 'var(--navy)' }}>
        {shown}
      </div>
      {sub && (
        <div className="text-[12px] leading-tight truncate" style={{ color: 'var(--ink-3)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

/** Tier chip — number + word always present (DESIGN.md D2). */
export function TierChip({ tier, full }: { tier: PhoneTier; full?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-semibold whitespace-nowrap"
      style={{ background: `${TIER_COLOR[tier]}${tier === 1 ? '' : '2b'}`, color: TIER_INK[tier] }}
      title={TIER_LABEL[tier]}
    >
      <span
        aria-hidden
        className="w-2 h-2 rounded-[2px]"
        style={{ background: tier === 1 ? '#b5b2a8' : TIER_COLOR[tier] }}
      />
      {full ? TIER_LABEL[tier] : TIER_SHORT[tier]}
    </span>
  )
}

/** Org affiliation chip — favicon with monogram fallback. */
export function OrgChip({ org, showName }: { org: OrgInfo; showName?: boolean }) {
  const [imgFailed, setImgFailed] = useState(false)
  const logo =
    org.domain && !imgFailed ? (
      <img
        src={faviconUrl(org.domain)}
        alt=""
        width={16}
        height={16}
        className="rounded-[3px] shrink-0"
        loading="lazy"
        onError={() => setImgFailed(true)}
      />
    ) : (
      <span
        aria-hidden
        className="w-4 h-4 rounded-[3px] flex items-center justify-center text-[7.5px] font-semibold shrink-0"
        style={{ background: 'var(--navy)', color: '#fff', letterSpacing: '0.02em' }}
      >
        {org.short}
      </span>
    )
  const body = (
    <span
      className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full border text-[12px] whitespace-nowrap max-w-full"
      style={{ borderColor: 'var(--hairline)', background: '#fff', color: 'var(--ink-2)' }}
      title={org.name}
    >
      {logo}
      {showName && <span className="truncate">{org.name}</span>}
    </span>
  )
  return org.url ? (
    <a href={org.url} target="_blank" rel="noreferrer" className="max-w-full hover:opacity-80">
      {body}
    </a>
  ) : (
    body
  )
}

/** Active-filter chip with remove ✕ (DESIGN.md G1). */
export function FilterChip({
  children,
  onRemove,
}: {
  children: ReactNode
  onRemove: () => void
}) {
  return (
    <span
      className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-[12px] font-semibold"
      style={{ background: 'var(--navy)', color: '#fff' }}
    >
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove filter"
        className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20"
      >
        ×
      </button>
    </span>
  )
}

/** Muted single-line label · value row for detail panels (DESIGN.md A3). */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="text-[12px] w-24 shrink-0" style={{ color: 'var(--ink-3)' }}>
        {label}
      </span>
      <span className="text-[13px] min-w-0" style={{ color: 'var(--ink)' }}>
        {children}
      </span>
    </div>
  )
}
