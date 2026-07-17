import type {
  AiPosture,
  DevicePosture,
  EdTechTier,
  MonitoringPosture,
  PhoneTier,
  PrivacyPosture,
} from './geo'

// Single source of truth for every data encoding (DESIGN.md D1).
// All ramps validated with the dataviz palette validator on 2026-07-03
// against the map surface #f7f6f3 (ordinal mode) — see DESIGN.md D3.

// Phone-policy tier — ordinal single-hue green ramp, darker = stronger
// policy. Tier 1 is "no district policy": semantically nothing, so it
// reads as near-surface neutral rather than a ramp step. Replaces the
// old red→green traffic light (deuteranopia-unsafe); every tier is
// always labeled wherever the color appears (DESIGN.md D2).
export const TIER_COLOR: Record<PhoneTier, string> = {
  1: '#e7e5df',
  2: '#6cbc7d',
  3: '#2f9e4f',
  4: '#0b6e33',
}

// Chip-friendly ink for each tier (dark enough to read as text).
export const TIER_INK: Record<PhoneTier, string> = {
  1: '#8a877f',
  2: '#2e7c42',
  3: '#20713a',
  4: '#0b6e33',
}

export const TIER_LABEL: Record<PhoneTier, string> = {
  1: 'Tier 1 — No district policy',
  2: 'Tier 2 — Partial / accessible storage',
  3: 'Tier 3 — Inaccessible storage, scope-limited',
  4: 'Tier 4 — Bell-to-bell, inaccessible storage, K-12',
}

export const TIER_SHORT: Record<PhoneTier, string> = {
  1: 'Tier 1 · no policy',
  2: 'Tier 2 · partial',
  3: 'Tier 3 · stored',
  4: 'Tier 4 · bell-to-bell',
}

// Brand accent — old gold against the navy chrome anchor and cream paper.
// Identity only, never a data encoding (DESIGN.md D1 governs those).
export const ACCENT = '#d4a843'

// Parent-organizing presence — violet, one channel, everywhere.
export const PRESENCE = '#7c3aed'

// EdTech 1:1 device posture — ordinal single-hue blue ramp, darker =
// devices travel further (take-home > in-school > none documented).
// Towns in not-yet-researched districts get the map's base fill, not a
// ramp step. Validated with the dataviz validator on 2026-07-14 against
// the map surface #f7f6f3 (ordinal mode); blue keeps CVD separation
// from the green tier ramp and the violet presence channel (all-pairs
// ΔE well above target).
export const POSTURE_COLOR: Record<DevicePosture, string> = {
  none: '#6aaed6',
  inSchool: '#2f7fb8',
  takeHome: '#0b4f7e',
}

export const POSTURE_LABEL: Record<DevicePosture, string> = {
  none: 'No 1:1 documented',
  inSchool: '1:1 · in school only',
  takeHome: '1:1 · take-home',
}

// EdTech lens accent (KPI strip chip) — the ramp's middle step.
export const EDTECH = '#2f7fb8'

// EdTech scorecard — single-hue blue ordinal ramp, same convention as the
// phone tiers: darker = closer to the low-tech-elementary standard; tier 1
// (furthest from it) reads near-neutral like phone tier 1.
export const EDTECH_TIER_COLOR: Record<EdTechTier, string> = {
  1: '#e7e5df',
  2: '#8bbbdd',
  3: '#2f7fb8',
  4: '#0b4f7e',
}

export const EDTECH_TIER_LABEL: Record<EdTechTier, string> = {
  1: 'Tier 1 — 1:1 reaches elementary, devices go home',
  2: 'Tier 2 — 1:1 reaches elementary, in school (or scope undocumented)',
  3: 'Tier 3 — 1:1 starts in middle school; elementary is 1:1-free',
  4: 'Tier 4 — No 1:1 below high school',
}

export const EDTECH_TIER_SHORT: Record<EdTechTier, string> = {
  1: 'Tier 1 · elementary take-home',
  2: 'Tier 2 · elementary in-school',
  3: 'Tier 3 · middle-school start',
  4: 'Tier 4 · no 1:1 below HS',
}

// Descriptive labels for the district card (not map encodings).
export const MONITORING_LABEL: Record<MonitoringPosture, string> = {
  documented: 'Monitoring software documented',
  none: 'None documented',
}
export const AI_LABEL: Record<AiPosture, string> = {
  policy: 'AI policy adopted',
  toolsOnly: 'AI tools in use, no policy',
  none: 'No AI activity documented',
}
export const PRIVACY_LABEL: Record<PrivacyPosture, string> = {
  registryCounted: 'Public vendor list, tool count visible',
  registryListed: 'Listed in the registry, tools not enumerable',
  notFound: 'No public vendor registry found',
}

// Statewide AI-curriculum-pilot marker — amber diamond, warm against the
// blue posture fills and CVD-distinct from the violet presence dots.
export const AI_PILOT = '#b45309'

// Boundary strokes (recessive; DESIGN.md B2).
export const BOUNDARY = {
  town: { stroke: '#c9c6bd', width: 0.55 },
  county: { stroke: '#57544e', width: 1.3 },
  school: { stroke: '#a08a3c', width: 0.9, dash: '5 2 1 2' },
  congressional: { stroke: '#7c3aed', width: 1.2, dash: '4 3' },
  stateSenate: { stroke: '#b0483f', width: 1.0, dash: '6 3' },
  stateHouse: { stroke: '#3a7ca5', width: 0.7, dash: '2 2' },
}
