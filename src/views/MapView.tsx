import { useMemo, useRef, useState } from 'react'
import type { PhoneTier } from '../geo'
import type { World } from '../model'
import { MapCanvas } from '../MapCanvas'
import {
  MapLayers,
  type BoundaryKey,
  type Lens,
  type TierFilter,
} from '../MapLayers'
import {
  AI_PILOT,
  EDTECH_TIER_COLOR,
  EDTECH_TIER_SHORT,
  PRESENCE,
  TIER_COLOR,
  TIER_SHORT,
} from '../colors'
import type { EdTechTier } from '../geo'

const LENSES: { key: Lens; label: string; hint: string }[] = [
  { key: 'policy', label: 'Phone policy', hint: 'District phone-policy strength, Tier 1–4' },
  { key: 'organizing', label: 'Organizing', hint: 'Where local groups are active' },
  { key: 'edtech', label: 'EdTech', hint: 'District 1:1 device programs and AI pilots' },
]

const BOUNDARY_OPTIONS: { key: BoundaryKey; label: string }[] = [
  { key: 'counties', label: 'Counties' },
  { key: 'school', label: 'School districts' },
  { key: 'congressional', label: 'US House' },
  { key: 'stateSenate', label: 'MA Senate' },
  { key: 'stateHouse', label: 'MA House' },
]

export function MapView({
  world,
  selectedId,
  onSelect,
  focusRef,
  lens,
  onLensChange,
  tierFilter,
  onTierFilterChange,
  onOpenEdTechTable,
}: {
  world: World
  selectedId: string | null
  onSelect: (id: string | null) => void
  focusRef: React.MutableRefObject<((c: [number, number], k?: number) => void) | null>
  lens: Lens
  onLensChange: (l: Lens) => void
  tierFilter: TierFilter
  onTierFilterChange: (t: TierFilter) => void
  onOpenEdTechTable: () => void
}) {
  const setTierFilter = onTierFilterChange
  const [boundaries, setBoundaries] = useState<Set<BoundaryKey>>(new Set())
  const [showBoundaries, setShowBoundaries] = useState(false)
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const hoverRec = hover ? world.records.get(hover.id) : null
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const toggleBoundary = (key: BoundaryKey) =>
    setBoundaries((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const hoverLine = useMemo(() => {
    if (!hoverRec) return null
    const bits: string[] = []
    if (lens === 'policy') bits.push(TIER_SHORT[hoverRec.policy?.tier ?? 1])
    else if (lens === 'edtech') {
      if (hoverRec.edtechTier == null) bits.push('Not yet graded')
      else {
        bits.push(EDTECH_TIER_SHORT[hoverRec.edtechTier])
        if (hoverRec.aiPilot) bits.push('AI pilot')
      }
    } else if (hoverRec.orgs.length > 0)
      bits.push(`${hoverRec.orgs.length} local group${hoverRec.orgs.length > 1 ? 's' : ''}`)
    return bits.join(' · ')
  }, [hoverRec, lens])

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <MapCanvas focusRef={focusRef} onBackgroundClick={() => onSelect(null)}>
        {(camera) => (
          <MapLayers
            world={world}
            k={camera.k}
            lens={lens}
            tierFilter={tierFilter}
            boundaries={boundaries}
            selectedId={selectedId}
            onSelect={onSelect}
            onHover={setHover}
          />
        )}
      </MapCanvas>

      {/* Map key — ONE panel that both switches what the map shows and
          explains it. The control and its explanation are the same mental
          object, so they live together (first-principles rework of the old
          floating lens switcher + separate legend + filter chips). */}
      <div
        data-map-ui
        className="absolute left-3 bottom-3 rounded-lg border shadow-sm px-3.5 py-3 w-[236px]"
        style={{ borderColor: 'var(--hairline)', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(6px)' }}
      >
        <div className="text-[11.5px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-3)' }}>
          Map shows
        </div>
        <div role="tablist" aria-label="Map layer" className="flex flex-col mb-1">
          {LENSES.map((l) => {
            const active = l.key === lens
            return (
              <button
                key={l.key}
                type="button"
                role="tab"
                aria-selected={active}
                title={l.hint}
                onClick={() => onLensChange(l.key)}
                className="flex items-center gap-2 px-1.5 h-8 -mx-1.5 rounded-md text-left text-[13px] hover:bg-black/[.04]"
                style={{
                  color: active ? 'var(--navy)' : 'var(--ink-2)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span
                  aria-hidden
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    border: active ? '4px solid var(--navy)' : '1.5px solid var(--ink-3)',
                    background: '#fff',
                  }}
                />
                {l.label}
              </button>
            )
          })}
        </div>

        <div className="h-px my-2" style={{ background: 'var(--hairline)' }} />

        {lens === 'policy' && (
          <>
            <div className="flex flex-col gap-0.5" role="group" aria-label="Filter by tier — click a tier to isolate it">
              {([4, 3, 2, 1] as PhoneTier[]).map((t) => {
                const active = tierFilter === t
                const dimmed = tierFilter !== 'all' && !active
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTierFilter(active ? 'all' : t)}
                    className="flex items-center gap-2 px-1.5 py-1 -mx-1.5 rounded-md text-left text-[12.5px] hover:bg-black/[.04]"
                    style={{
                      color: 'var(--ink-2)',
                      opacity: dimmed ? 0.45 : 1,
                      background: active ? '#0f213710' : undefined,
                    }}
                  >
                    <span
                      aria-hidden
                      className="w-3.5 h-3.5 rounded-[3px] shrink-0"
                      style={{ background: TIER_COLOR[t], border: t === 1 ? '1px solid #c9c6bd' : undefined }}
                    />
                    {TIER_SHORT[t]}
                  </button>
                )
              })}
            </div>
            {tierFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setTierFilter('all')}
                className="mt-1.5 text-[12px] font-semibold hover:underline underline-offset-2"
                style={{ color: 'var(--navy)' }}
              >
                ✕ Show all tiers
              </button>
            ) : (
              <div className="mt-1.5 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                Click a tier to isolate it
              </div>
            )}
          </>
        )}
        {lens === 'organizing' && (
          <LegendRows
            rows={[
              { swatch: PRESENCE, label: '2+ groups', alpha: 0.55 },
              { swatch: PRESENCE, label: '1 group', alpha: 0.3 },
            ]}
          />
        )}
        {lens === 'edtech' && (
          <>
            <LegendRows
              rows={[
                ...([4, 3, 2, 1] as EdTechTier[]).map((t) => ({
                  swatch: EDTECH_TIER_COLOR[t],
                  label: EDTECH_TIER_SHORT[t],
                  outline: t === 1,
                })),
                { swatch: '#ffffff', label: 'Not yet graded', outline: true },
              ]}
              extra={[{ swatch: AI_PILOT, label: 'State AI-curriculum pilot', diamond: true }]}
            />
            <button
              type="button"
              onClick={onOpenEdTechTable}
              className="mt-2 text-[12.5px] font-semibold hover:underline underline-offset-2"
              style={{ color: 'var(--navy)' }}
            >
              Open the full district table →
            </button>
          </>
        )}

        <div className="h-px my-2" style={{ background: 'var(--hairline)' }} />
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowBoundaries((v) => !v)}
            aria-expanded={showBoundaries}
            className="text-[12px] hover:underline underline-offset-2"
            style={{ color: boundaries.size ? 'var(--ink)' : 'var(--ink-3)' }}
          >
            Boundary overlays{boundaries.size > 0 ? ` (${boundaries.size})` : ''} ▾
          </button>
          {showBoundaries && (
            <div
              className="absolute bottom-full left-0 mb-2 rounded-lg border shadow-md px-3 py-2 flex flex-col gap-1.5 w-44"
              style={{ borderColor: 'var(--hairline)', background: 'rgba(255,255,255,0.97)' }}
            >
              {BOUNDARY_OPTIONS.map((b) => (
                <label key={b.key} className="flex items-center gap-2 text-[12.5px] cursor-pointer" style={{ color: 'var(--ink-2)' }}>
                  <input
                    type="checkbox"
                    checked={boundaries.has(b.key)}
                    onChange={() => toggleBoundary(b.key)}
                    style={{ accentColor: 'var(--navy)' }}
                  />
                  {b.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hover tooltip — enhances, never gates (DESIGN.md G3). */}
      {hover && hoverRec && (
        <div
          className="pointer-events-none fixed z-40 rounded-md border shadow-md px-2.5 py-1.5"
          style={{
            left: hover.x + 14,
            top: hover.y + 14,
            borderColor: 'var(--hairline)',
            background: 'rgba(255,255,255,0.97)',
          }}
        >
          <div className="text-[12.5px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
            {hoverRec.name}
          </div>
          {hoverLine && (
            <div className="text-[12px] leading-tight" style={{ color: 'var(--ink-2)' }}>
              {hoverLine}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LegendRows({
  rows,
  extra,
}: {
  rows: { swatch: string; label: string; alpha?: number; outline?: boolean }[]
  extra?: { swatch: string; label: string; alpha?: number; diamond?: boolean; ring?: boolean }[]
}) {
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r) => (
        <LegendRow key={r.label} {...r} />
      ))}
      {extra && <div className="h-px my-0.5" style={{ background: 'var(--hairline)' }} />}
      {extra?.map((r) => (
        <LegendRow key={r.label} {...r} />
      ))}
    </div>
  )
}

function LegendRow({
  swatch,
  label,
  alpha,
  outline,
  diamond,
  ring,
}: {
  swatch: string
  label: string
  alpha?: number
  outline?: boolean
  diamond?: boolean
  ring?: boolean
}) {
  return (
    <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-2)' }}>
      <span
        aria-hidden
        className={`shrink-0 ${diamond ? 'w-3 h-3 rounded-[2px]' : ring ? 'w-3.5 h-3.5 rounded-full' : 'w-3.5 h-3.5 rounded-[3px]'}`}
        style={{
          background: ring ? 'transparent' : swatch,
          opacity: alpha ?? 1,
          border: outline ? '1px solid #c9c6bd' : ring ? `1.6px solid ${swatch}` : undefined,
          transform: diamond ? 'rotate(45deg) scale(0.85)' : undefined,
        }}
      />
      {label}
    </div>
  )
}
