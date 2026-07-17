import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtDate, loadWorld, type World } from './model'
import type { Lens, TierFilter } from './MapLayers'
import { MapView } from './views/MapView'
import { EdTechView } from './views/EdTechView'
import { MethodologyView } from './views/MethodologyView'
import { DetailPanel } from './DetailPanel'
import { GuidePanel } from './GuidePanel'
import { StatTile } from './ui'

type View = 'map' | 'edtech' | 'methodology'

// EdTech is map-first: it lives as a map lens, with the table reachable
// through a Map/Table toggle — so it gets no header tab of its own.
const VIEWS: { key: View; label: string }[] = [
  { key: 'map', label: 'Map' },
  { key: 'methodology', label: 'Methodology' },
]

// Shareable state lives in the URL hash so any view of the site is a
// link someone can send: #town=natick&lens=edtech&view=groups&tier=4
function readHash(): {
  town?: string
  lens?: Lens
  view?: View
  tier?: TierFilter
} {
  const p = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const lens = p.get('lens')
  const view = p.get('view')
  const tier = p.get('tier')
  return {
    town: p.get('town') ?? undefined,
    lens: lens === 'policy' || lens === 'organizing' || lens === 'edtech' ? lens : undefined,
    view: view === 'map' || view === 'edtech' || view === 'methodology' ? view : undefined,
    tier: tier && ['1', '2', '3', '4'].includes(tier) ? (Number(tier) as TierFilter) : undefined,
  }
}

// Parsed once at load — the hash a visitor arrived with.
const INITIAL = typeof window !== 'undefined' ? readHash() : {}

export default function App() {
  const [world, setWorld] = useState<World | null>(null)
  const [view, setView] = useState<View>(INITIAL.view ?? 'map')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // First-time visitors land on the tier map — the one lens whose legend
  // explains itself without any prior context.
  const [lens, setLens] = useState<Lens>(INITIAL.lens ?? 'policy')
  const [tierFilter, setTierFilter] = useState<TierFilter>(INITIAL.tier ?? 'all')
  const [guideOpen, setGuideOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const flyTo = useRef<((c: [number, number], k?: number) => void) | null>(null)
  const pendingTown = useRef(INITIAL.town)

  useEffect(() => {
    void loadWorld().then(setWorld)
  }, [])

  // Restore a deep-linked town once the world (and the map's flyTo) exist.
  useEffect(() => {
    if (!world || !pendingTown.current) return
    const rec = world.byKey.get(pendingTown.current.toLowerCase())
    if (rec) {
      setSelectedId(rec.id)
      const t = world.towns.find((f) => f.id === rec.id)
      // flyTo mounts a frame after the map view does.
      if (t) setTimeout(() => flyTo.current?.(t.centroid, 3), 150)
    }
    pendingTown.current = undefined
  }, [world])

  // Reflect shareable state back into the URL (replace, never push — the
  // back button should leave the site, not unwind every click).
  const selected = selectedId && world ? world.records.get(selectedId) ?? null : null
  useEffect(() => {
    const p = new URLSearchParams()
    if (selected) p.set('town', selected.key)
    if (lens !== 'policy') p.set('lens', lens)
    if (view !== 'map') p.set('view', view)
    if (tierFilter !== 'all') p.set('tier', String(tierFilter))
    const h = p.toString()
    history.replaceState(null, '', h ? `#${h}` : window.location.pathname + window.location.search)
  }, [selected, lens, view, tierFilter])

  // The tab title follows the selection — link previews and browser
  // history read like a website, not an app shell.
  useEffect(() => {
    document.title = selected
      ? `${selected.districtName ?? selected.name} — The Commonwealth Codex`
      : 'The Commonwealth Codex — screens in Massachusetts schools'
  }, [selected])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (guideOpen) setGuideOpen(false)
        else setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [guideOpen])

  const latestUpdate = useMemo(() => {
    const dates = (world?.freshness ?? []).map((f) => f.date).filter((d): d is string => !!d)
    if (dates.length === 0) return null
    return dates.reduce((a, b) => (a > b ? a : b))
  }, [world])

  const searchMatches = useMemo(() => {
    if (!world) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    const prefix: typeof world.towns = []
    const substr: typeof world.towns = []
    for (const t of world.towns) {
      const n = t.name.toLowerCase()
      if (n.startsWith(q)) prefix.push(t)
      else if (n.includes(q)) substr.push(t)
    }
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
    return [...prefix.sort(byName), ...substr.sort(byName)].slice(0, 8)
  }, [searchQuery, world])

  const setQuery = (q: string) => {
    setSearchQuery(q)
    setActiveIndex(0) // highlight resets with the result set
  }

  const pickTown = (id: string) => {
    setSelectedId(id)
    setSearchQuery('')
    const t = world?.towns.find((f) => f.id === id)
    if (t && view === 'map') flyTo.current?.(t.centroid, 3)
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Header — identity, views, search, guide (DESIGN.md F2). */}
      <header
        className="shrink-0 flex items-center gap-5 px-5 h-13"
        style={{
          background: 'var(--paper)',
          borderBottom: '1px solid var(--accent)',
          height: 56,
        }}
      >
        <h1
          className="m-0 whitespace-nowrap font-wordmark text-[16px] font-bold uppercase"
          style={{ letterSpacing: '0.07em' }}
          title="The Commonwealth Codex"
        >
          <span style={{ color: 'var(--navy)' }}>The Commonwealth</span>{' '}
          <span style={{ color: 'var(--accent)' }}>Codex</span>
        </h1>

        <nav className="flex items-center gap-1" aria-label="Views">
          {VIEWS.map((v) => {
            // The EdTech table is a sub-view of the map, so Map stays lit.
            const active = view === v.key || (v.key === 'map' && view === 'edtech')
            return (
              <button
                key={v.key}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setView(v.key)}
                className="px-3 h-9 rounded-md text-[13px] font-semibold hover:bg-black/[.05] active:bg-black/[.1]"
                style={{
                  color: active ? 'var(--navy)' : 'var(--ink-2)',
                  boxShadow: active ? 'inset 0 -2px var(--navy)' : undefined,
                  borderRadius: active ? '6px 6px 0 0' : 6,
                }}
              >
                {v.label}
              </button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {latestUpdate && (
            <div
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px]"
              style={{ background: 'var(--paper)', color: 'var(--ink-2)' }}
              title="Most recent data refresh across every feed"
            >
              <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
              Updated <span className="tnum">{fmtDate(latestUpdate)}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="h-9 px-3 rounded-md border text-[13px] font-semibold hover:bg-black/[.04]"
            style={{ borderColor: 'var(--hairline)', color: 'var(--ink-2)', background: 'var(--card)' }}
          >
            Guide
          </button>
        </div>
      </header>

      {/* Hero — the landing state IS the intro. A first-time visitor's
          question is "what's happening in MY town," so the town search is
          the primary call to action; three fixed statewide numbers carry
          the narrative. No gated intro page, no per-lens KPI churn. */}
      <section
        className="shrink-0 px-5 pt-4 pb-4 flex flex-wrap items-center gap-x-10 gap-y-3"
        style={{ background: 'var(--paper)', boxShadow: 'inset 0 -1px var(--hairline)' }}
      >
        <div className="min-w-0 max-w-[520px]">
          <h2 className="font-display m-0 text-[22px] font-semibold leading-tight" style={{ color: 'var(--navy)' }}>
            Where Massachusetts stands on screens in schools
          </h2>
          <p className="mt-1 mb-0 text-[13.5px] leading-snug" style={{ color: 'var(--ink-2)' }}>
            District phone policies, classroom technology, and parent organizing —
            town by town, from public sources.
          </p>
        </div>

        <div className="relative grow max-w-[360px] min-w-[240px]">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find your town…"
            role="combobox"
            aria-expanded={searchMatches.length > 0}
            aria-controls="town-search-listbox"
            aria-activedescendant={
              searchMatches.length > 0 ? `town-opt-${searchMatches[activeIndex]?.id}` : undefined
            }
            autoComplete="off"
            className="h-11 w-full px-3.5 text-[15px] rounded-lg border shadow-sm"
            style={{ borderColor: 'var(--hairline)', background: 'var(--card)', color: 'var(--ink)' }}
            onKeyDown={(e) => {
              if (searchMatches.length === 0) {
                if (e.key === 'Escape') setSearchQuery('')
                return
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveIndex((i) => (i + 1) % searchMatches.length)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveIndex((i) => (i - 1 + searchMatches.length) % searchMatches.length)
              } else if (e.key === 'Enter') {
                e.preventDefault()
                const m = searchMatches[activeIndex] ?? searchMatches[0]
                if (m) pickTown(m.id)
              } else if (e.key === 'Escape') {
                setSearchQuery('')
              }
            }}
          />
          {searchMatches.length > 0 && (
            <ul
              id="town-search-listbox"
              role="listbox"
              className="absolute left-0 right-0 top-12 max-h-72 overflow-auto rounded-lg border shadow-lg z-40 py-1"
              style={{ borderColor: 'var(--hairline)', background: 'var(--card)' }}
            >
              {searchMatches.map((t, i) => {
                const active = i === activeIndex
                return (
                  <li key={t.id} id={`town-opt-${t.id}`} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onClick={() => pickTown(t.id)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className="flex items-baseline justify-between w-full text-left px-3 py-2 text-[14px]"
                      style={{ background: active ? '#0f213710' : undefined, color: 'var(--ink)' }}
                    >
                      <span className="truncate">{t.name}</span>
                      {t.population != null && (
                        <span className="ml-2 shrink-0 tnum text-[12px]" style={{ color: 'var(--ink-3)' }}>
                          {t.population.toLocaleString()}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {world && (
          <div className="hidden lg:flex items-center gap-8 ml-auto">
            {/* Each number is a door, not a decoration — it jumps to the
                view that backs it. */}
            <button
              type="button"
              className="text-left hover:opacity-75"
              onClick={() => {
                setView('map')
                setLens('policy')
                setTierFilter('all')
              }}
            >
              <StatTile label="Districts tracked" value={String(world.kpis.districtsTotal)} />
            </button>
            <button
              type="button"
              className="text-left hover:opacity-75"
              onClick={() => {
                setView('map')
                setLens('organizing')
              }}
            >
              <StatTile label="Parent groups" value={String(world.kpis.localGroups)} />
            </button>
            <button
              type="button"
              className="text-left hover:opacity-75"
              onClick={() => {
                setView('map')
                setLens('policy')
                setTierFilter(4)
              }}
            >
              <StatTile label="Bell-to-bell districts" value={String(world.kpis.tier4)} />
            </button>
          </div>
        )}
      </section>

      {/* Content + detail panel (list-detail, DESIGN.md F1). */}
      <main className="flex-1 min-h-0 flex">
        <div className="flex-1 relative min-w-0">
          {!world ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
                Loading Massachusetts…
              </div>
            </div>
          ) : view === 'map' ? (
            <MapView
              world={world}
              selectedId={selectedId}
              onSelect={setSelectedId}
              focusRef={flyTo}
              lens={lens}
              onLensChange={setLens}
              tierFilter={tierFilter}
              onTierFilterChange={setTierFilter}
              onOpenEdTechTable={() => setView('edtech')}
            />
          ) : view === 'edtech' ? (
            <EdTechView onBackToMap={() => setView('map')} />
          ) : (
            <MethodologyView />
          )}
        </div>
        {selected && (
          <div className="hidden md:block h-full shrink-0">
            <DetailPanel rec={selected} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </main>

      {/* Mobile detail panel — slides over (DESIGN.md F1 compact). */}
      {selected && (
        <div className="md:hidden fixed inset-0 z-40 flex justify-end" onClick={() => setSelectedId(null)}>
          <div className="absolute inset-0" style={{ background: 'rgba(15,33,55,0.28)' }} />
          <div className="relative h-full" onClick={(e) => e.stopPropagation()}>
            <DetailPanel rec={selected} onClose={() => setSelectedId(null)} />
          </div>
        </div>
      )}

      {guideOpen && (
        <GuidePanel
          world={world}
          onClose={() => setGuideOpen(false)}
          onOpenMethodology={() => setView('methodology')}
        />
      )}
    </div>
  )
}
