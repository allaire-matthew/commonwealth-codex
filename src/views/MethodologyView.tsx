import type { ReactNode } from 'react'
import { EDTECH_TIER_COLOR, TIER_COLOR } from '../colors'

/**
 * Full written methodology for both grading systems. The Guide gives the
 * one-glance version; this page is the complete, citable definition a
 * school-committee member or reporter can hold us to.
 */
export function MethodologyView() {
  return (
    <div className="absolute inset-0 overflow-y-auto thin-scroll">
      <div className="max-w-[720px] mx-auto px-5 py-8">
        <h2 className="font-display m-0 text-[26px] font-semibold leading-tight" style={{ color: 'var(--navy)' }}>
          Methodology
        </h2>
        <p className="mt-2 mb-0 text-[14px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          Every grade on this site is a claim about a specific school district,
          so every grade follows written rules. This page is the complete
          definition of both grading systems — what each tier means, what
          evidence counts, and what the grades deliberately leave out. If you
          believe a district is graded wrong, the underlying sources are linked
          on its card; corrections based on primary documents are always
          welcome.
        </p>

        {/* ------------------------------------------------------------- */}
        <SectionRule />
        <h3 className="font-display m-0 text-[20px] font-semibold" style={{ color: 'var(--navy)' }}>
          Phone-policy tiers
        </h3>
        <p className="mt-2 mb-0 text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          <strong>What it measures:</strong> the strength of each district's
          student cell-phone policy, graded against the national gold standard
          set by the{' '}
          <Ext href="https://www.distractionfreeschools.com/">
            Distraction-Free Schools Policy Project
          </Ext>
          's Phone-Free Schools model bill — the same standard behind the
          national{' '}
          <Ext href="https://www.phonefreeschoolsreport.org/">
            Phone-Free Schools State Report Card
          </Ext>
          : phones away <em>bell to bell</em> (the entire school day, including
          lunch and passing time), in <em>inaccessible storage</em> (locking
          pouches or cabinets — not pockets, backpacks, or lockers), for{' '}
          <em>every grade the district serves</em>, covering <em>all personal
          electronic devices</em>, with only narrow documented exceptions
          (IEP/504 and medical). The Codex applies that state-level rubric
          district by district.
        </p>

        <TierDef color={TIER_COLOR[4]} name="Tier 4 — Bell-to-bell, inaccessible storage, K-12">
          Meets the full standard: phones stored in inaccessible storage from
          first bell to dismissal, district-wide across every grade band the
          district serves, all personal electronic devices covered, exceptions
          limited to documented IEP/504 and medical needs. Superintendent or
          principal discretion clauses do not disqualify a district.
        </TierDef>
        <TierDef color={TIER_COLOR[3]} name="Tier 3 — Inaccessible storage, scope-limited">
          Real hardware-level separation (pouches, locked caddies) is in force,
          but for less than the full K-12 span — a bell-to-bell high school
          inside a district whose elementary schools are looser is the classic
          case — or the policy carries significant weakening loopholes.
        </TierDef>
        <TierDef color={TIER_COLOR[2]} name="Tier 2 — Partial / accessible storage">
          A district-level policy exists but restricts phones only during class
          time, or relies on storage students can reach (pockets, backpacks,
          "off and away" honor systems). Most Massachusetts districts with any
          policy are here.
        </TierDef>
        <TierDef color={TIER_COLOR[1]} name="Tier 1 — No district policy" outline>
          No district-wide policy located. Individual schools or teachers may
          have rules; nothing binds the district.
        </TierDef>

        <SubHead>Evidence rules</SubHead>
        <Bullets
          items={[
            'Primary sources outrank everything: district handbooks and school-committee-adopted policy text first, committee minutes second, district-specific local news third. Statewide roundups (Globe, Axios, WBUR) corroborate but never carry a claim alone.',
            'Hardware claims (Tier 3 and above) require two independent sources, at least one primary.',
            'Only enacted, in-force policies count — "considering," "piloting," and subcommittee votes are tracked in the notes but never graded.',
            'Mixed districts grade at the weakest link: if the middle school is bell-to-bell but the high school allows phones at lunch, the district is not Tier 4. Per-school detail is preserved in the policy summary.',
            'Once a tier is confirmed against news or primary documents, automated handbook re-parses cannot silently downgrade or upgrade it — every tier change goes through review.',
            'Every entry carries its sources and a last-verified date on the district card.',
          ]}
        />
        <p className="mt-3 mb-0 text-[13px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
          The tiers are directional, not a pass/fail audit: enforcement quality
          on the ground varies in ways paper policy cannot capture, and the
          notes flag known gaps (emergency-use exceptions, educational-use
          carve-outs, enforcement drift) that don't move a district between
          tiers on their own.
        </p>

        {/* ------------------------------------------------------------- */}
        <SectionRule />
        <h3 className="font-display m-0 text-[20px] font-semibold" style={{ color: 'var(--navy)' }}>
          EdTech scorecard
        </h3>
        <p className="mt-2 mb-0 text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          <strong>What it measures:</strong> how far each district's device
          program sits from a low-tech-elementary standard with three planks:{' '}
          <strong>end 1:1 device programs in grades K-8</strong>;{' '}
          <strong>no screen use in K-2</strong>, with approved instructional
          uses only in grades 3-5; and <strong>shared computer carts</strong>{' '}
          rather than personally-assigned devices in grades 5-8. Under this
          standard a 1:1 program belongs in high school, if anywhere — so the
          grade turns on two documented facts: <em>the earliest grade where a
          district's 1:1 program starts</em>, and <em>whether those devices go
          home</em>.
        </p>

        <TierDef color={EDTECH_TIER_COLOR[4]} name="Tier 4 — No 1:1 below high school">
          The district either runs no 1:1 program at all (confirmed, not merely
          undocumented) or limits personally-assigned devices to grades 9-12.
          Elementary and middle grades work from shared devices or none.
        </TierDef>
        <TierDef color={EDTECH_TIER_COLOR[3]} name="Tier 3 — 1:1 starts in middle school">
          Personally-assigned devices begin somewhere in grades 5-8, but the
          elementary grades are 1:1-free.
        </TierDef>
        <TierDef color={EDTECH_TIER_COLOR[2]} name="Tier 2 — 1:1 reaches elementary, in school">
          The 1:1 program reaches grades K-4, but devices stay at school. Also
          the floor when a district confirms a 1:1 program without documenting
          which grades it covers — we grade the program we can see, not the one
          we can't.
        </TierDef>
        <TierDef color={EDTECH_TIER_COLOR[1]} name="Tier 1 — 1:1 reaches elementary, devices go home" outline>
          Personally-assigned devices in the elementary grades that travel
          home — the furthest position from the standard, and currently the
          most common one in Massachusetts.
        </TierDef>

        <SubHead>Evidence rules</SubHead>
        <Bullets
          items={[
            'Grades come from district documents: technology-department pages, 1:1 program handbooks and FAQs, school-committee minutes, budget documents, and district-specific local press. Every claim on a district card carries a source URL.',
            'The 1:1 start grade is read from the district’s own program language ("grades 6-12," "K-12," "district-wide"). Where documents give prose instead of grade bands, we classify conservatively and keep the original language visible on the card.',
            'Take-home status uses the district’s own words — devices that "go home," "stay in classrooms," or are "issued for the year" — never inference from device type.',
            'A district researched but whose 1:1 status could not be confirmed is shown as "not yet graded," never given Tier 4 credit for a program we simply failed to find.',
            'Districts not yet researched are blank. Blank is a coverage fact, not a grade.',
          ]}
        />

        <SubHead>What the scorecard does not grade</SubHead>
        <p className="mt-1 mb-0 text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          The district card also reports monitoring and filtering software,
          AI posture (formal guidelines vs. tools in use without policy), and
          data-privacy transparency via the district's page in the{' '}
          <Ext href="https://sdpc.a4l.org/view_alliance.php?state=MA">
            MA Student Privacy Alliance registry
          </Ext>
          . These are documented facts for parents to weigh — they are not
          folded into the tier, because mixing dimensions into one number hides
          more than it shows. Two planks of the standard — screen-time limits
          in K-2/3-5 and cart programs specifically — are not yet directly
          measurable from public documents at scale; where a district publishes
          them, they appear in its profile, and the grade binds on the 1:1
          facts.
        </p>

        <SectionRule />
        <SubHead>Coverage and updates</SubHead>
        <p className="mt-1 mb-0 text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          Phone policies cover all 306 mappable districts. EdTech profiles are
          researched in expanding passes — the map shows exactly how far
          coverage extends, and ungraded districts are visibly blank rather
          than silently filled. Data refreshes daily from public sources via
          automated checks, with human review before any tier changes.
        </p>

        <SubHead>Standards &amp; further reading</SubHead>
        <p className="mt-1 mb-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          The Codex is one state's district-level entry in a national
          movement. The standards it grades against, and the national trackers
          alongside it:
        </p>
        <ul className="mt-0 mb-8 pl-5 flex flex-col gap-1.5">
          <li className="text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            <Ext href="https://www.distractionfreeschools.com/">
              Distraction-Free Schools Policy Project
            </Ext>{' '}
            — the Phone-Free Schools, Safe School Tech, and Social Media-Free
            Schools model bills.
          </li>
          <li className="text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            <Ext href="https://www.phonefreeschoolsreport.org/">
              Phone-Free Schools State Report Card
            </Ext>{' '}
            — how all fifty states grade on the same standard the Codex
            applies to Massachusetts districts.
          </li>
          <li className="text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            <Ext href="https://www.fournorms.com/edtech-tracker">
              National EdTech Collective Action Tracker
            </Ext>{' '}
            — live map of parent campaigns petitioning school boards on
            classroom screen time nationwide.
          </li>
          <li className="text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            <Ext href="https://sdpc.a4l.org/view_alliance.php?state=MA">
              Massachusetts Student Privacy Alliance registry
            </Ext>{' '}
            — the public database of district-vendor data-privacy agreements
            behind the transparency facts on each district card.
          </li>
        </ul>
      </div>
    </div>
  )
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-semibold hover:underline underline-offset-2"
      style={{ color: 'var(--navy)' }}
    >
      {children}
    </a>
  )
}

function SectionRule() {
  return <div className="h-px my-6" style={{ background: 'var(--hairline)' }} />
}

function SubHead({ children }: { children: ReactNode }) {
  return (
    <h4 className="mt-5 mb-1 text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-ink)' }}>
      {children}
    </h4>
  )
}

function TierDef({
  color,
  name,
  outline,
  children,
}: {
  color: string
  name: string
  outline?: boolean
  children: ReactNode
}) {
  return (
    <div className="mt-4 flex gap-3">
      <span
        aria-hidden
        className="mt-1 w-4 h-4 rounded-[3px] shrink-0"
        style={{ background: color, border: outline ? '1px solid #c9c6bd' : undefined }}
      />
      <div>
        <div className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
          {name}
        </div>
        <p className="mt-0.5 mb-0 text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          {children}
        </p>
      </div>
    </div>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-1 mb-0 pl-5 flex flex-col gap-1.5">
      {items.map((s) => (
        <li key={s.slice(0, 40)} className="text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          {s}
        </li>
      ))}
    </ul>
  )
}
