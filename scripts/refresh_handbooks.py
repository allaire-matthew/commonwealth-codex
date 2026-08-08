#!/usr/bin/env python3
"""Handbook pipeline v6 — Playwright-rendered discovery.

v5 had a 0% hit rate for weeks. Root causes found 2026-08-08:
1. The DuckDuckGo search fallback was outright bot-blocked (an
   anomaly.js?...cc=botnet challenge page, not just empty results) —
   permanently dead, kept only as a harmless last resort.
2. Plain urllib+regex HTML fetching can't see most real handbooks:
   some districts render their document/handbook page client-side via JS
   (confirmed on a ParentSquare/SmartSites site), and some publish the
   handbook as a web page with content in accordion sections rather than
   a PDF at all (confirmed on another district — the entire cell phone
   policy was rendered HTML text, invisible to a static fetch).
   Separately, small-district homepages often don't link the handbook
   directly — it's one hop deeper, behind a generic "Schools" or
   "Student Services" hub page that itself doesn't score as a handbook
   candidate (confirmed on a CivicPlus site).

v6 renders every candidate page with headless Chromium: it (a) can read
JS-populated navigation and document widgets a static fetch can't, (b)
classifies phone-policy text found directly in a rendered page (no PDF
required), and (c) crawls one level into generic hub pages (Schools,
Student Services, Departments, Community/Families...) when no handbook
link scores highly enough on the homepage itself.

Also fixes: classify() returning a confident "tier 1, no policy" result
whenever a document has zero phone-policy keyword matches — that doesn't
mean no policy, it usually means the wrong document was found (a before/
after-care handbook, an athletics handbook, a directory PDF). Those no
longer get merged into phone-policies.json as verified findings.
"""
from __future__ import annotations
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request

from playwright.sync_api import sync_playwright

REPO = pathlib.Path(__file__).resolve().parent.parent
POL = REPO / "public" / "data" / "phone-policies.json"
LINKS = REPO / "public" / "data" / "school-committee-links.json"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
TIMEOUT = 25
MIN_TEXT_LEN = 500
MAX_OCR_PAGES = 40  # cap to keep runtime bounded

# Re-use the classifier patterns from v4
PHONE_CONTEXT = re.compile(r"\b(cell\s*phones?|smart\s*phones?|smartphones?|cellphones?|personal\s+(?:electronic\s+)?devices?|mobile\s+(?:phones?|devices?)|electronic\s+devices?)\b", re.I)
HARDWARE_PATTERNS = [
    re.compile(r"\byondr\b", re.I),
    re.compile(r"\bmagnetic(ally)?\s+lock", re.I),
    re.compile(r"\block(ed|ing)\s+(pouch|bag|box|caddy|caddies|case)", re.I),
    re.compile(r"\bphone\s+(caddy|caddies|hotel|holder|holders|pouch)", re.I),
]
OFF_AWAY_PATTERNS = [
    re.compile(r"\b(cell\s*phones?|cellphones?|smart\s*phones?|smartphones?|personal\s+(?:electronic\s+)?devices?|electronic\s+devices?)\s+(?:may\s+not|cannot|are\s+not|will\s+not|shall\s+not|must\s+not)\s+be\s+(used|seen|visible|on)", re.I),
    re.compile(r"\b(cell\s*phones?|cellphones?|smart\s*phones?|personal\s+(?:electronic\s+)?devices?|electronic\s+devices?)[^.]{0,80}\b(turned?\s+off|silenced?|stored\s+(in\s+)?(backpack|locker|bag|pocket))", re.I),
    re.compile(r"\bphones?[^.]{0,40}(in\s+(?:the\s+)?(backpack|locker|bag))", re.I),
    re.compile(r"\b(off\s+and\s+away|away\s+for\s+the\s+day|put\s+away|stowed)\b", re.I),
    re.compile(r"\b(no\s+cell\s+phones?|no\s+smartphones?)", re.I),
    re.compile(r"\bcell\s*phones?[^.]{0,40}\bnot\s+allowed", re.I),
    re.compile(r"\b(devices?|phones?)\s+(must|will|shall)\s+(be\s+)?(turned\s+off|silenced|stored|placed)", re.I),
    re.compile(r"\bbell[-\s]to[-\s]bell\b", re.I),
]
BAD_DOMAINS = [re.compile(p, re.I) for p in [
    r"sau41",                  # NH SAU 41 = Brookline NH (same name as MA Brookline)
    r"apsva\.us",              # VA Arlington Public Schools
    r"\.wpsd\.org", r"wpsdiowa",
    r"warwicksd\.org",         # RI Warwick
    r"\.in\.us\b",
    r"\.k12\.(ny|ri|ct|nj|pa|in|wi|ia|tx|ga|fl|sc|nc|va|md|ky|mo|oh|ar|me|nh|vt|ks|al|tn|mn|ms|la|or|wa|ca|az|nv|co|mt|id|nm|ut|wy|ak|hi|sd|nd)\b",
]]

# Reject URLs whose filename indicates a NON-student-policy document.
WRONG_TYPE_URL = [re.compile(p, re.I) for p in [
    r"employee.?handbook",
    r"faculty.?(handbook|manual)",
    r"athletic.?handbook",
    r"student.?athlete.?handbook",
    r"substitute.?(handbook|manual)",
    r"curriculum.?guide",
    r"course.?catalog",
]]

# Generic nav categories worth one extra hop even when they don't score as
# a handbook candidate themselves — this is how most small-district sites
# actually reach the handbook (Schools -> Avon Middle High School -> ...).
HUB_KEYWORDS = (
    "school", "student", "famil", "communit", "department", "resource",
    "academic", "policy", "policies", "district-info", "district-office",
)

NEWS_PUBLISHER_HINTS = (
    "news", "lens", "globe", "wbur", "gbh", "boston.com", "nbcboston",
    "wcvb", "necn", "cbs", "wgbh", "patch", "wickedlocal", "telegram",
    "berkshireeagle", "cape cod times", "sentinel", "gazette", "enterprise",
)


def is_bad_domain(url: str) -> bool:
    return any(p.search(url) for p in BAD_DOMAINS)


def is_wrong_type_url(url: str) -> bool:
    return any(p.search(url) for p in WRONG_TYPE_URL)


def is_news_source(source: dict) -> bool:
    """Heuristic: publisher contains a news org hint, or URL is on a news domain."""
    pub = (source.get("publisher", "") or "").lower()
    url = (source.get("url", "") or "").lower()
    title = (source.get("title", "") or "").lower()
    if any(h in pub or h in url for h in NEWS_PUBLISHER_HINTS):
        return True
    if "press release" in title:
        return False  # press releases come from the district itself
    return False


def parse_date(s: str | None) -> str:
    """Coerce various date forms to YYYY-MM-DD for comparison.

    Accepts: '2024-10-08', '2025-26', '24-25', 'FY25', '2024'.
    Returns '0000-00-00' if unparseable.
    """
    if not s:
        return "0000-00-00"
    s = str(s).strip()
    # Already ISO
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", s)
    if m:
        return s
    # School year YYYY-YY or YYYY-YYYY → start at Sept 1 of first year
    m = re.match(r"^(\d{4})-\d{2,4}$", s)
    if m:
        return f"{m.group(1)}-09-01"
    # YY-YY → assume 20YY-09-01
    m = re.match(r"^(\d{2})-\d{2}$", s)
    if m:
        return f"20{m.group(1)}-09-01"
    # FY25 → 2024-09-01 (FY25 = academic year 2024-25)
    m = re.match(r"^FY(\d{2})$", s, re.I)
    if m:
        yr = int(m.group(1))
        return f"20{yr-1:02d}-09-01"
    # Single year
    m = re.match(r"^(\d{4})$", s)
    if m:
        return f"{s}-01-01"
    return "0000-00-00"


def url_date(url: str) -> str:
    """Extract the most plausible date from a handbook URL or filename.

    Looks for school-year patterns ('2024-25', '24-25', '2025-2026', 'FY25')
    and Unix timestamps from finalsite-style URLs ('v1755001297').
    Returns YYYY-MM-DD or '0000-00-00'.
    """
    if not url:
        return "0000-00-00"
    # Finalsite-style Unix timestamp: vNNNNNNNNNN
    m = re.search(r"/v(\d{10})/", url)
    if m:
        import datetime
        try:
            return datetime.date.fromtimestamp(int(m.group(1))).isoformat()
        except Exception:
            pass
    # School year patterns in path/filename
    for pat in [
        r"(20\d{2})[-_](\d{4})",   # 2024-2025
        r"(20\d{2})[-_](\d{2})",   # 2024-25
        r"(\d{2})[-_](\d{2})(?!\d)",  # 24-25
        r"FY(\d{2})",
        r"(20\d{2})",  # bare year, last fallback
    ]:
        m = re.search(pat, url, re.I)
        if m:
            return parse_date(m.group(0))
    return "0000-00-00"


def latest_news_date(sources: list) -> str:
    """Return the YYYY-MM-DD of the most recent news source in `sources`, or '0000-00-00'."""
    news = [s for s in sources if is_news_source(s)]
    if not news:
        return "0000-00-00"
    return max(parse_date(s.get("date")) for s in news)


def fetch(url: str, max_bytes: int = 5_000_000) -> tuple[bytes, str]:
    if is_bad_domain(url):
        return b"", "cross_state"
    if is_wrong_type_url(url):
        return b"", "wrong_type_handbook"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            data = r.read(max_bytes)
            ct = r.headers.get("Content-Type", "")
        return data, ct
    except Exception:
        return b"", ""


def looks_like_pdf(data: bytes, ct: str) -> bool:
    return data[:8].startswith(b"%PDF") or "pdf" in ct.lower()


def extract_text_with_ocr_fallback(pdf_path: pathlib.Path, workdir: pathlib.Path) -> tuple[str, str]:
    """Returns (text, method_used)."""
    # Try pdftotext
    try:
        out = subprocess.run(["pdftotext", "-layout", str(pdf_path), "-"], capture_output=True, text=True, timeout=30)
        if len(out.stdout.strip()) >= MIN_TEXT_LEN:
            return out.stdout, "pdftotext"
    except Exception:
        pass
    # Try PyMuPDF
    try:
        import fitz
        doc = fitz.open(str(pdf_path))
        t = "\n".join(page.get_text() for page in doc)
        doc.close()
        if len(t.strip()) >= MIN_TEXT_LEN:
            return t, "pymupdf"
    except Exception:
        pass
    # OCR fallback — render pages and run tesseract
    try:
        # Rasterize first MAX_OCR_PAGES pages at 200 DPI
        prefix = workdir / "page"
        subprocess.run(
            ["pdftoppm", "-r", "200", "-l", str(MAX_OCR_PAGES), str(pdf_path), str(prefix)],
            capture_output=True, timeout=120,
        )
        text_parts = []
        for page_img in sorted(workdir.glob("page-*")):
            try:
                out = subprocess.run(
                    ["tesseract", str(page_img), "-", "-l", "eng", "--psm", "6"],
                    capture_output=True, text=True, timeout=30,
                )
                text_parts.append(out.stdout)
            except Exception:
                continue
        text = "\n".join(text_parts)
        if len(text.strip()) >= MIN_TEXT_LEN:
            return text, "ocr_tesseract"
    except Exception as e:
        print(f"  OCR failed: {e}", file=sys.stderr)
    return "", "none"


def score_anchor(href: str, label: str) -> int:
    href_l = href.lower()
    label_l = label.lower()
    score = 0
    if "handbook" in href_l: score += 5
    if "handbook" in label_l: score += 5
    if "student" in href_l or "student" in label_l: score += 1
    if "family" in href_l or "family" in label_l: score += 1
    if "code of conduct" in label_l or "code-of-conduct" in href_l: score += 3
    if ".pdf" in href_l: score += 2
    return score


def is_same_domain(url: str, domain: str) -> bool:
    try:
        return urllib.parse.urlparse(url).netloc == urllib.parse.urlparse(domain).netloc
    except Exception:
        return False


def usable_anchors(anchors: list[dict], domain: str) -> list[dict]:
    out = []
    for a in anchors:
        href = a.get("href") or ""
        if not href or not is_same_domain(href, domain):
            continue
        if is_bad_domain(href) or is_wrong_type_url(href):
            continue
        out.append({"href": href, "text": (a.get("text") or "").strip()})
    return out


def render_anchors(page, url: str, timeout_ms: int = 12000) -> list[dict] | None:
    """Load `url` in the shared Playwright page and return its rendered <a> tags.

    Uses domcontentloaded (not networkidle) + a short settle wait: modern
    school sites often poll analytics/chat widgets forever, which makes
    networkidle unreliably slow. A few hundred ms after DOMContentLoaded is
    enough for the client-rendered nav/document widgets we care about.
    """
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        page.wait_for_timeout(700)
    except Exception:
        return None
    try:
        return page.eval_on_selector_all(
            "a", "els => els.map(e => ({href: e.href, text: (e.textContent||'').trim()}))"
        )
    except Exception:
        return None


def render_text(page) -> str:
    try:
        return page.eval_on_selector("body", "el => el.textContent") or ""
    except Exception:
        return ""


def ddg_search_pdf(domain: str) -> list[str]:
    netloc = urllib.parse.urlparse(domain).netloc
    q = f"site:{netloc} handbook filetype:pdf"
    url = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote(q)
    data, _ = fetch(url, max_bytes=500_000)
    if not data:
        return []
    text = data.decode("utf-8", errors="replace")
    urls = re.findall(r'href="(https?://[^"]+\.pdf[^"]*)"', text, re.I)
    out = []
    for u in urls:
        if "duckduckgo.com" in u:
            m = re.search(r"uddg=([^&]+)", u)
            if m:
                u = urllib.parse.unquote(m.group(1))
        if u not in out and "handbook" in u.lower():
            out.append(u)
        if len(out) >= 3:
            break
    return out


def try_pdf(url: str, geoid: str, tmpdir: pathlib.Path) -> dict | None:
    data, ct = fetch(url, max_bytes=15_000_000)
    if not data or not looks_like_pdf(data, ct) or len(data) <= 5000:
        return None
    tag = f"{geoid}_{abs(hash(url)) % 10**8}"
    pdf_path = tmpdir / f"{tag}.pdf"
    pdf_path.write_bytes(data)
    ocr_dir = tmpdir / f"{tag}_pages"
    ocr_dir.mkdir(exist_ok=True)
    text, method = extract_text_with_ocr_fallback(pdf_path, ocr_dir)
    if len(text.strip()) < MIN_TEXT_LEN:
        return None
    tier, summary, enforcement = classify(text)
    if tier == 1:
        # Every target here is ALREADY tier 1 — a "no restriction pattern
        # found" result is either the wrong document (an unrelated PDF that
        # happens to mention "electronic device" once) or genuinely
        # uninformative either way. Not worth citing; keep searching.
        return None
    return {
        "verified": True, "tier": tier, "policySummary": summary,
        "enforcement": enforcement, "confidence": "high",
        "handbook_url": url, "extraction_method": method,
    }


def try_html_text(page, url: str) -> dict | None:
    """Does the rendered page itself carry the phone policy as web text
    (no PDF), e.g. an accordion-style 'Handbook & Policies' page?"""
    if render_anchors(page, url) is None:  # navigates `page` to `url` and settles
        return None
    text = render_text(page)
    if len(text) < MIN_TEXT_LEN:
        return None
    tier, summary, enforcement = classify(text)
    if tier == 1:  # see comment in try_pdf — not informative, likely wrong page
        return None
    return {
        "verified": True, "tier": tier, "policySummary": summary,
        "enforcement": enforcement, "confidence": "medium",
        "handbook_url": url, "extraction_method": "playwright_dom",
    }


def discover_and_extract(page, domain: str, geoid: str, tmpdir: pathlib.Path) -> dict:
    """Crawl `domain` for a student handbook and return a results dict.

    Two-level crawl: (1) score every homepage link, try the ones that
    already look like a handbook; (2) if none pan out, hop one level into
    generic hub pages (Schools, Student Services, ...) — most small-district
    handbooks are one click past a hub page that doesn't itself score as a
    handbook candidate. Each candidate is tried as BOTH a possible PDF and
    a possible web-native (rendered HTML) handbook.
    """
    visited: set[str] = {domain}
    home_anchors = render_anchors(page, domain)
    if home_anchors is None:
        return {"verified": False, "reason": "homepage_unreachable", "domain_tried": domain}
    home = usable_anchors(home_anchors, domain)

    scored_home = sorted(
        {(score_anchor(a["href"], a["text"]), a["href"]) for a in home}, reverse=True
    )
    handbook_candidates = [u for s, u in scored_home if s >= 5][:5]
    # Rank hub candidates shallowest-path-first: a genuine top-nav category
    # ("/Schools", "/451/Schools") is usually 1-2 path segments, while a
    # substring match buried in an unrelated deep link ("/about/district/
    # leahy-school-building-project" matching on "school") is longer.
    # Shallow-first keeps real nav categories from being crowded out of the
    # capped candidate list on sites with large, keyword-heavy homepages.
    hub_raw = list(dict.fromkeys(
        a["href"] for a in home
        if any(k in a["href"].lower() or k in a["text"].lower() for k in HUB_KEYWORDS)
    ))
    hub_candidates = sorted(hub_raw, key=lambda u: len(urllib.parse.urlparse(u).path.strip("/").split("/")))[:8]

    def try_one(url: str) -> dict | None:
        # Don't trust the URL string to say whether it's a PDF: many CMSes
        # (confirmed on CivicPlus's DocumentCenter) serve PDFs from routes
        # with no ".pdf" in the path at all (e.g. .../Student-Handbook-PDF
        # with no dot). Content-sniff instead — try_pdf() fetches and checks
        # magic bytes/content-type itself, so this is cheap even when it
        # turns out not to be a PDF.
        r = try_pdf(url, geoid, tmpdir)
        if r:
            return r
        r = try_html_text(page, url)
        if r:
            r["handbook_url"] = url
            return r
        return None

    for u in handbook_candidates:
        if u in visited:
            continue
        visited.add(u)
        r = try_one(u)
        if r:
            return r

    for hub in hub_candidates:
        if hub in visited:
            continue
        visited.add(hub)
        hub_anchors = render_anchors(page, hub)
        if hub_anchors is None:
            continue
        hub_same = usable_anchors(hub_anchors, domain)
        scored_hub = sorted(
            {(score_anchor(a["href"], a["text"]), a["href"]) for a in hub_same}, reverse=True
        )
        for u in [u for s, u in scored_hub if s >= 5][:3]:
            if u in visited:
                continue
            visited.add(u)
            r = try_one(u)
            if r:
                return r

    for u in ddg_search_pdf(domain):  # dead more often than not, kept as a free last resort
        r = try_pdf(u, geoid, tmpdir)
        if r:
            return r

    return {"verified": False, "reason": "no_handbook_found_after_crawl", "domain_tried": domain,
            "pages_visited": len(visited)}


def classify(text: str) -> tuple[int, str, str]:
    matches = list(PHONE_CONTEXT.finditer(text))
    if not matches:
        return 1, "Handbook (OCR or text): no phone-policy keywords matched.", "none"
    windows = []
    last_end = -1
    for m in matches:
        ws = max(0, m.start() - 300)
        we = min(len(text), m.end() + 1200)
        if ws <= last_end:
            windows[-1] = (windows[-1][0], we)
        else:
            windows.append((ws, we))
        last_end = we
    section = "\n---\n".join(text[ws:we] for ws, we in windows[:5])
    if any(p.search(section) for p in HARDWARE_PATTERNS):
        quote = re.sub(r"\s+", " ", section[:400]).strip()[:300]
        return 3, f"Handbook (hardware policy): {quote}", "hardware"
    if any(p.search(section) for p in OFF_AWAY_PATTERNS):
        quote = re.sub(r"\s+", " ", section[:400]).strip()[:300]
        return 2, f"Handbook (off-and-away): {quote}", "off-and-away"
    quote = re.sub(r"\s+", " ", section[:300]).strip()[:200]
    return 1, f"Handbook reviewed; no clear restriction pattern: {quote}", "none"


def derive_domain(url: str) -> str | None:
    if not url or url.startswith(("TODO", "see ")):
        return None
    try:
        p = urllib.parse.urlparse(url)
        return f"{p.scheme}://{p.netloc}"
    except Exception:
        return None


def main():
    policies = json.loads(POL.read_text())["policies"]
    links = json.loads(LINKS.read_text()).get("links", {})

    name_to_url = {}
    for k, v in links.items():
        if isinstance(v, dict) and v.get("name") and v.get("calendar_url"):
            name_to_url[v["name"].lower()] = v["calendar_url"]

    # Target: districts still tier-1 with no handbook_url
    targets = []
    for geoid, p in policies.items():
        if p.get("tier") != 1:
            continue
        if p.get("handbook_url"):
            continue
        if p.get("status") in ("intra_district_subset", "no_district_applicable"):
            continue
        name = p.get("districtName", "")
        cal_url = name_to_url.get(name.lower())
        if not cal_url:
            for key in (name.lower().replace("school district", "public schools").strip(), name.lower()):
                if key in name_to_url:
                    cal_url = name_to_url[key]
                    break
        if not cal_url:
            continue
        domain = derive_domain(cal_url)
        if not domain:
            continue
        targets.append((geoid, name, domain))

    print(f"Targets: {len(targets)}", file=sys.stderr)
    results = {}
    tmpdir = pathlib.Path(tempfile.mkdtemp(prefix="hb6_"))
    cap = min(80, len(targets))

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for i, (geoid, name, domain) in enumerate(targets[:cap], 1):
            print(f"[{i}/{cap}] {name[:45]} → {domain}", file=sys.stderr, flush=True)
            # Fresh page per district: a page reused across 60+ sequential
            # navigations accumulates JS/listener/memory state and started
            # silently failing to even load real, working homepages partway
            # through a full run (confirmed 2026-08-08 — same domains that
            # errored mid-run loaded fine in isolation). A new page per
            # district costs tens of ms and eliminates that class of failure.
            page = browser.new_page(user_agent=UA)
            page.set_default_timeout(12000)
            page.route(
                re.compile(r"\.(png|jpe?g|gif|svg|webp|woff2?|ttf|eot|mp4|webm)(\?|$)", re.I),
                lambda route: route.abort(),
            )
            try:
                r = discover_and_extract(page, domain, geoid, tmpdir)
            finally:
                page.close()
            results[geoid] = r
            if r.get("verified"):
                print(f"  ✓ tier {r['tier']} | {r['enforcement']} | {r['extraction_method']} | {r['handbook_url'][:70]}",
                      file=sys.stderr, flush=True)
            else:
                print(f"  ✗ {r.get('reason')} ({r.get('pages_visited', 0)} pages tried)", file=sys.stderr, flush=True)
        browser.close()

    # Persist raw results for audit (useful in CI logs / debugging)
    audit_path = REPO / "scripts" / ".handbook-run-latest.json"
    audit_path.write_text(json.dumps(results, indent=2))

    # Merge verified findings into phone-policies.json
    import datetime
    today = datetime.date.today().isoformat()
    upgrades = 0
    sources_added = 0
    rank = {"high": 3, "medium": 2, "low": 1}
    for geoid, r in results.items():
        if not r.get("verified"):
            continue
        old = policies.get(geoid, {})
        # NEVER overwrite a news-verified entry.
        if old.get("status") == "news_verified":
            print(f"  · {geoid} {old.get('districtName')}: news_verified — handbook will not override", file=sys.stderr)
            continue
        # If the existing entry has a news source MORE RECENT than this handbook,
        # the news source wins — leave the entry's tier alone, only add the
        # handbook as a confirming-source-only.
        news_date = latest_news_date(old.get("sources", []))
        hb_date = url_date(r["handbook_url"])
        if news_date > hb_date and news_date != "0000-00-00":
            print(f"  · {geoid} {old.get('districtName')}: news source ({news_date}) more recent than handbook ({hb_date}) — handbook attached as source-only, tier preserved", file=sys.stderr)
            sources = list(old.get("sources", []))
            if not any(s.get("url") == r["handbook_url"] for s in sources):
                sources.append({
                    "title": f"Student handbook ({r.get('extraction_method','?')}, dated {hb_date or 'unknown'}, older than news)",
                    "url": r["handbook_url"],
                    "publisher": "district",
                    "date": hb_date if hb_date != "0000-00-00" else "",
                })
            old["sources"] = sources
            old["handbook_url"] = r["handbook_url"]
            continue
        sources = list(old.get("sources", []))
        if not any(s.get("url") == r["handbook_url"] for s in sources):
            sources.append({
                "title": f"Student handbook ({r.get('extraction_method', '?')})",
                "url": r["handbook_url"],
                "publisher": "district",
                "date": today,
            })
        # Don't downgrade existing high-confidence entries
        if rank.get(old.get("confidence"), 1) > rank.get(r["confidence"], 1):
            old["sources"] = sources
            old["handbook_url"] = r["handbook_url"]
            sources_added += 1
            continue
        policies[geoid] = {
            **old,
            "districtId": geoid,
            "districtName": old.get("districtName", ""),
            "tier": r["tier"],
            "policySummary": r["policySummary"][:500],
            "enforcement": r["enforcement"],
            "sources": sources,
            "lastVerified": today,
            "confidence": r["confidence"],
            "status": "handbook_verified",
            "handbook_url": r["handbook_url"],
            "extraction_method": r.get("extraction_method", "unknown"),
        }
        upgrades += 1

    if upgrades or sources_added:
        pol_data = json.loads(POL.read_text())  # re-read to preserve _notes etc.
        pol_data["policies"] = policies
        pol_data["_lastUpdated"] = today
        POL.write_text(json.dumps(pol_data, indent=2) + "\n")
        print(f"\nMerged into phone-policies.json: {upgrades} upgrades, {sources_added} source-only updates", file=sys.stderr)
    else:
        print("\nNo phone-policies.json changes.", file=sys.stderr)

    from collections import Counter
    ver = sum(1 for r in results.values() if r.get("verified"))
    tiers = Counter(r.get("tier") for r in results.values() if r.get("verified"))
    methods = Counter(r.get("extraction_method") for r in results.values() if r.get("verified"))
    print(f"Verified: {ver}/{len(results)} ({100*ver//max(len(results),1)}%)", file=sys.stderr)
    print(f"Tier distribution: {dict(tiers)}", file=sys.stderr)
    print(f"Extraction methods: {dict(methods)}", file=sys.stderr)


if __name__ == "__main__":
    main()
