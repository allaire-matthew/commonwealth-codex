import {
  getTownToDistrict,
  getTownToLayer,
  loadAiPilotDistricts,
  loadEdTechActions,
  loadEdTechServices,
  loadLayer,
  loadLegislators,
  loadNextMeetings,
  loadPhonePolicies,
  loadSchoolCommitteeLinks,
  loadTownOrgs,
  normalizeDistrictKey,
  type AiPosture,
  type DevicePosture,
  type EdTechAction,
  type EdTechProfile,
  type EdTechTier,
  type LegislatorsData,
  type MonitoringPosture,
  type PrivacyPosture,
  type NextMeetingEntry,
  type PhonePolicy,
  type ProjectedFeature,
  type SchoolCommitteeLink,
  type StateLegislator,
  type TownOrgChapter,
  type USHouseRep,
} from './geo'

// ---------------------------------------------------------------------------
// World model — every feed joined once, consumed everywhere.

export type TownRecord = {
  id: string // GEOID
  key: string // normalized lowercase name
  name: string
  population: number | null
  countyName: string | null
  districtId: string | null
  districtName: string | null
  policy: PhonePolicy | null
  edtech: EdTechProfile | null
  edtechTier: EdTechTier | null // null = district not yet researched
  edtechPosture: DevicePosture | null
  edtechMonitoring: MonitoringPosture | null
  edtechAi: AiPosture | null
  edtechPrivacy: PrivacyPosture | null
  aiPilot: boolean // district is in the statewide AI-curriculum pilot
  edtechActions: EdTechAction[] // resistance ledger — actions/bodies/officials
  schoolLink: SchoolCommitteeLink | null
  nextMeeting: NextMeetingEntry | null
  orgs: TownOrgChapter[]
  usHouse: USHouseRep | null
  maSenate: StateLegislator | null
  maHouse: StateLegislator | null
}

export type World = {
  towns: ProjectedFeature[] // all town features (map + search)
  records: Map<string, TownRecord> // by town GEOID
  byKey: Map<string, TownRecord> // by normalized name
  tracked: TownRecord[] // towns with local groups, sorted
  legislators: LegislatorsData | null
  kpis: {
    localGroupTowns: number
    localGroups: number
    towns2plus: number
    tier4: number
    tier3: number
    tier2: number
    tier1: number
    districtsTotal: number
    meetingsNext14d: number
    edtechProfiled: number
    edtechTakeHome: number
    aiPilotDistricts: number
    edtechActionTowns: number
    edtechBodies: number
    edtechOfficials: number
  }
  freshness: { label: string; date: string | null }[]
}

let worldPromise: Promise<World> | null = null

export function loadWorld(): Promise<World> {
  if (worldPromise) return worldPromise
  worldPromise = buildWorld()
  return worldPromise
}

// Classify a district's 1:1 posture from its free-text takeHome field
// (research prose, not an enum). Take-home when the text opens with
// "yes"/"grades …" or affirmatively mentions devices going home once
// negated clauses ("no longer go home", "no public evidence of
// take-home", "not found/confirmed") are scrubbed; explicit
// "no"/"in-classroom"/"in-school" openers mean in-school; a documented
// 1:1 with no affirmative take-home signal defaults to in-school.
// Total: any oneToOne shape (missing, exists false/null) → 'none'.
export function classifyDevicePosture(one: EdTechProfile['oneToOne'] | null | undefined): DevicePosture {
  if (!one || one.exists !== true) return 'none'
  const t = (one.takeHome ?? '').trim().toLowerCase()
  if (!t) return 'none'
  if (/^(yes|grades?\b)/.test(t)) return 'takeHome'
  if (/^(no\b|in[- ]?(classroom|school))/.test(t)) return 'inSchool'
  const scrubbed = t
    .replace(/no longer[^;.,)]*/g, '')
    .replace(/no (public )?evidence[^;.,)]*/g, '')
    .replace(/[^;.,()]*not (found|confirmed)[^;.,)]*/g, '')
  if (/\b(yes|take[- ]home|take[^;.,]{0,24}home|go(es)? home|at home|travel)\b/.test(scrubbed)) {
    return 'takeHome'
  }
  return 'inSchool'
}

// Monitoring & filtering — any documented student-monitoring, web-filtering,
// or safety-surveillance product in the district's service list.
const MONITORING_RE = /monitor|filter|surveillan|safety|gaggle|goguardian|securly|lightspeed|bark\b|linewize|impero|blocksi|deledao|hapara/i

export function classifyMonitoring(p: EdTechProfile): MonitoringPosture {
  const hit = (p.notableServices ?? []).some(
    (s) => MONITORING_RE.test(s.category ?? '') || MONITORING_RE.test(s.name),
  )
  return hit ? 'documented' : 'none'
}

// AI engagement — formal policy beats tools-in-use beats nothing. The
// statewide curriculum pilot counts as activity even without local policy.
export function classifyAi(p: EdTechProfile): AiPosture {
  if (p.aiPolicy?.exists === true) return 'policy'
  if ((p.aiTools?.length ?? 0) > 0 || p.aiPilot) return 'toolsOnly'
  return 'none'
}

// Privacy transparency — can a parent see the district's vendor list?
export function classifyPrivacy(p: EdTechProfile): PrivacyPosture {
  if (p.dpaRegistry.found && p.dpaRegistry.approxApproved != null) return 'registryCounted'
  if (p.dpaRegistry.found) return 'registryListed'
  return 'notFound'
}

// EdTech scorecard — grades the district's device program against the
// low-tech-elementary standard: no 1:1 in K-8, minimal screens in the
// early grades, shared carts in the middle grades. The binding fact is
// where the 1:1 program STARTS, parsed from the research free text.
//   Tier 4 — no 1:1 below high school (none at all, or 9-12 only)
//   Tier 3 — 1:1 starts in the middle grades (5-8); elementary is 1:1-free
//   Tier 2 — 1:1 reaches elementary (K-4), devices stay in school
//            (also the honest floor when a 1:1 exists but scope is undocumented)
//   Tier 1 — 1:1 reaches elementary AND devices go home
export function classifyEdTechTier(p: EdTechProfile): EdTechTier | null {
  const one = p.oneToOne
  // Unknown ≠ absent: only a CONFIRMED no-1:1 earns tier 4; researched-but-
  // inconclusive districts stay ungraded (null → blank on the map).
  if (!one || one.exists == null) return null
  if (one.exists === false) return 4
  const t = `${one.grades ?? ''} ${one.device ?? ''}`.toLowerCase()
  const starts: number[] = []
  if (/\b(?:pre-?k|pk|jk|tk|k)\s*(?:-|–|to|through)\s*\d/.test(t)) starts.push(0)
  if (/\bdistrict-?wide\b|\ball grades\b|\ball students\b|\bp?re?k-?12\b|\bk-?12\b/.test(t)) starts.push(0)
  for (const m of t.matchAll(/\b(\d{1,2})\s*(?:-|–|to|through)\s*(\d{1,2})\b/g)) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (a <= b && b <= 12) starts.push(a)
  }
  for (const m of t.matchAll(/\bgrades?\s+(\d{1,2})\b(?!\s*(?:-|–|to|through))/g)) {
    const a = Number(m[1])
    if (a <= 12) starts.push(a)
  }
  // Keyword fallbacks for prose-only scopes ("Brockton has been 1:1 since
  // 2020", "at the middle and high schools", "High School runs a 1:1").
  if (starts.length === 0) {
    if (/\belementary\b/.test(t)) starts.push(0)
    else if (/\bmiddle\b/.test(t)) starts.push(6)
    else if (/\bhigh school\b|\bhs\b/.test(t)) starts.push(9)
  }
  if (starts.length === 0) return 2 // 1:1 exists, scope undocumented
  const start = Math.min(...starts)
  if (start >= 9) return 4
  if (start >= 5) return 3
  return classifyDevicePosture(one) === 'takeHome' ? 1 : 2
}

async function buildWorld(): Promise<World> {
  const [
    townsLayer,
    districtsLayer,
    countiesLayer,
    policies,
    tToD,
    tToCounty,
    tToCong,
    tToSen,
    tToHouse,
    scLinks,
    legislators,
    townOrgs,
    meetings,
    edtechByDistrict,
    aiPilot,
    edtechActions,
  ] = await Promise.all([
    loadLayer('towns'),
    loadLayer('schoolDistricts'),
    loadLayer('counties'),
    loadPhonePolicies(),
    getTownToDistrict(),
    getTownToLayer('counties'),
    getTownToLayer('congressional'),
    getTownToLayer('stateSenate'),
    getTownToLayer('stateHouse'),
    loadSchoolCommitteeLinks(),
    loadLegislators(),
    loadTownOrgs(),
    loadNextMeetings(),
    loadEdTechServices(),
    loadAiPilotDistricts(),
    loadEdTechActions(),
  ])

  const aiPilotIds = new Set((aiPilot?.districts ?? []).map((d) => d.districtId))

  // Data keys that don't match a map-town name (verified 2026-07-03).
  // "Martha's Vineyard" is an island-wide group — anchored to Tisbury
  // (Vineyard Haven).
  const ALIAS: Record<string, string> = {
    braintree: 'braintree town',
    manchester: 'manchester-by-the-sea',
    'marthas vineyard': 'tisbury',
  }
  const canon = (key: string) => ALIAS[key] ?? key
  const orgsByTown: Record<string, TownOrgChapter[]> = {}
  for (const [k, v] of Object.entries(townOrgs?.byTown ?? {})) {
    const key = canon(k)
    orgsByTown[key] = [...(orgsByTown[key] ?? []), ...v]
  }
  const edtechActionsByTown: Record<string, EdTechAction[]> = {}
  for (const [k, v] of Object.entries(edtechActions?.byTown ?? {})) {
    const key = canon(k)
    edtechActionsByTown[key] = [...(edtechActionsByTown[key] ?? []), ...v]
  }

  const records = new Map<string, TownRecord>()
  const byKey = new Map<string, TownRecord>()

  for (const f of townsLayer.features) {
    const key = (f.name || '').trim().toLowerCase()
    const dId = tToD[f.id] ?? null
    const district = dId ? districtsLayer.features.find((d) => d.id === dId) ?? null : null
    const policy = dId ? policies[dId] ?? null : null
    const dKey = district ? normalizeDistrictKey(district.name) : null
    const tKey = normalizeDistrictKey(f.name)
    const ctyId = tToCounty[f.id]
    const county = ctyId ? countiesLayer.features.find((c) => c.id === ctyId) ?? null : null
    const edtech = dId ? edtechByDistrict[dId] ?? null : null
    const rec: TownRecord = {
      id: f.id,
      key,
      name: f.name,
      population: f.population ?? null,
      countyName: county?.name ?? null,
      districtId: dId,
      districtName: district?.name ?? null,
      policy,
      edtech,
      edtechTier: edtech ? classifyEdTechTier(edtech) : null,
      edtechPosture: edtech ? classifyDevicePosture(edtech.oneToOne) : null,
      edtechMonitoring: edtech ? classifyMonitoring(edtech) : null,
      edtechAi: edtech ? classifyAi(edtech) : null,
      edtechPrivacy: edtech ? classifyPrivacy(edtech) : null,
      aiPilot: dId ? aiPilotIds.has(dId) : false,
      edtechActions: edtechActionsByTown[key] ?? [],
      schoolLink: (dKey && scLinks[dKey]) || scLinks[tKey] || null,
      nextMeeting: (dKey && meetings?.byKey[dKey]) || meetings?.byKey[tKey] || null,
      orgs: orgsByTown[key] ?? [],
      usHouse: legislators?.us_house[tToCong[f.id] ?? ''] ?? null,
      maSenate: legislators?.ma_senate[tToSen[f.id] ?? ''] ?? null,
      maHouse: legislators?.ma_house[tToHouse[f.id] ?? ''] ?? null,
    }
    records.set(f.id, rec)
    byKey.set(key, rec)
  }

  const tracked = [...records.values()]
    .filter((r) => r.orgs.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

  const allPolicies = Object.values(policies)
  const meetingsNext14d = Object.values(meetings?.byKey ?? {}).filter((m) => {
    if (!m.next_meeting) return false
    const d = daysSince(m.next_meeting)
    return d != null && d <= 0 && d >= -14
  }).length

  const isAdvocate = (t: string) => t.toLowerCase().includes('advocate')
  const allOrgEntries = tracked.flatMap((r) => r.orgs)
  const edtechProfiles = Object.values(edtechByDistrict)
  const allEdtechActionEntries = Object.values(edtechActionsByTown).flat()
  const kpis = {
    localGroupTowns: tracked.length,
    localGroups: allOrgEntries.filter((o) => (o.chapterName ?? '').trim() && !isAdvocate(o.type)).length,
    towns2plus: tracked.filter((r) => r.orgs.length >= 2).length,
    tier4: allPolicies.filter((p) => p.tier === 4).length,
    tier3: allPolicies.filter((p) => p.tier === 3).length,
    tier2: allPolicies.filter((p) => p.tier === 2).length,
    tier1: allPolicies.filter((p) => p.tier === 1).length,
    districtsTotal: allPolicies.length,
    meetingsNext14d,
    edtechProfiled: edtechProfiles.length,
    edtechTakeHome: edtechProfiles.filter(
      (p) => classifyDevicePosture(p.oneToOne) === 'takeHome',
    ).length,
    aiPilotDistricts: aiPilot?.districts.length ?? 0,
    edtechActionTowns: Object.keys(edtechActionsByTown).filter(
      (k) => edtechActionsByTown[k].some((a) => a.kind === 'action'),
    ).length,
    edtechBodies: allEdtechActionEntries.filter((a) => a.kind === 'body').length,
    edtechOfficials: allEdtechActionEntries.filter((a) => a.kind === 'official').length,
  }

  const freshness: World['freshness'] = [
    { label: 'Parent orgs', date: townOrgs?._lastUpdated ?? null },
    { label: 'Meetings', date: meetings?._lastUpdated ?? null },
    { label: 'EdTech pushback', date: edtechActions?._lastUpdated ?? null },
  ]

  return {
    towns: townsLayer.features,
    records,
    byKey,
    tracked,
    legislators,
    kpis,
    freshness,
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers (DESIGN.md E3 — one precision per metric).

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86_400_000)
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function fmtAgo(iso: string | null | undefined): string {
  const d = daysSince(iso)
  if (d == null) return '—'
  if (d <= 0) return 'today'
  if (d === 1) return '1d ago'
  return `${d}d ago`
}
