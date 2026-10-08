/**
 * NextChapter capture popup.
 *
 * Reads the page you are ALREADY looking at, in your own signed-in tab, at
 * your explicit instruction. That is what the server cannot do: LinkedIn
 * returns a login wall to anything that is not a signed-in browser, and the
 * admin's own data export only covers people they are already connected to —
 * so the person most worth saving, the one they just found, is exactly the one
 * quick add cannot help with.
 */

// Mirrors src/lib/crm/labels.ts's PERSON_ROLE_LABELS — this extension has no
// build step and can't import from the Next.js app, so the list is
// duplicated here. Keep the two in sync by hand when roles change.
const PERSON_ROLE_OPTIONS = [
  ['BD_PARTNER', 'BD: Partner'], ['COACH_PROSPECT', 'BD: Coach'], ['RECRUITER_PROSPECT', 'BD: Recruiter'],
  ['HIRING_MANAGER', 'BD: Hiring Manager'], ['OUTPLACEMENT_BUYER', 'BD: Outplacement'], ['ALUMNI_OFFICE', 'BD: Alumni'],
  ['INVESTOR_VC', 'F: Investor (VC)'], ['INVESTOR_ANGEL', 'F: Investor (Angel)'], ['INCUBATOR', 'F: Incubator'],
  ['GRANTS', 'F: Grants'], ['STRATEGIC', 'F: Strategic'],
  ['PRESS', 'GTM: Press/Media'], ['GTM_PARTNER', 'GTM: Partner'],
  ['ADVISOR', 'NC: Advisor'], ['EMPLOYEE_CANDIDATE', 'NC: Employee'], ['CONNECTOR', 'NC: Connector'],
  ['POLICY_ANALYST', 'NC: Policy/Academic'], ['JOB_SEEKER', 'NC: Candidate'], ['OTHER', 'NC: Other'],
].sort((a, b) => a[1].localeCompare(b[1]))

const PRIORITY_OPTIONS = [['', 'Default (P2)'], ['P0', 'P0'], ['P1', 'P1'], ['P2', 'P2']]

const PERSON_PAGE_FACTS = ['location', 'email', 'phone']

const KINDS = {
  person: [
    { id: 'name', label: 'Name', type: 'text' },
    { id: 'company', label: 'Company', type: 'text' },
    { id: 'jobTitle', label: 'Title', type: 'text' },
    // Location, email and phone have no fields: they're read off the page,
    // shown on the info line at the top, and sent as read — rarely worth
    // editing, and three rows of mostly-empty inputs cost the space.
    { id: 'roles', label: 'Contact type(s)', type: 'checkboxes', options: PERSON_ROLE_OPTIONS },
    { id: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS },
    // LinkedIn can never log itself — this is the only way a DM you just sent
    // counts as contact. Logged as a LinkedIn message dated now.
    { id: 'messagedToday', label: 'I messaged them on LinkedIn today', type: 'toggle' },
    // Flags them so that when someone with a similar name or the same email
    // signs up, the admin is asked to confirm it's them — and the candidate's
    // lead source becomes this referral.
    { id: 'invitedAsCandidate', label: 'I invited them to join NextChapter as a candidate', type: 'toggle' },
    // No LinkedIn field here — it costs a whole row for something that's
    // already sent every time as `payload.url` (see the save handler below)
    // and rarely needs a second look once you're already on the profile.
  ],
  layoff: [
    { id: 'company', label: 'Company', type: 'text' },
    { id: 'headcount', label: 'Roles affected', type: 'number' },
    { id: 'announcedAt', label: 'Announced', type: 'date' },
  ],
  research: [
    { id: 'title', label: 'Title', type: 'text' },
    { id: 'company', label: 'Publisher', type: 'text' },
  ],
  product: [
    { id: 'categories', label: 'Category', type: 'checkboxes', options: [['Product', 'Product'], ['Features', 'Features'], ['Design', 'Design']] },
  ],
}

let kind = 'person'
let page = { title: '', url: '', selection: '', scraped: {} }

const $ = (id) => document.getElementById(id)

/**
 * Runs in the page. Pulls what is visibly there; guesses nothing.
 *
 * LinkedIn is a client-rendered SPA: the popup can open before the profile's
 * name/headline have painted, especially right after a tab switch or a fresh
 * navigation. `wait` polls briefly instead of taking a single snapshot, so a
 * still-loading page doesn't come back looking like an empty one.
 */
async function readPage() {
  const pick = (sel) => document.querySelector(sel)?.textContent?.trim() || ''
  const meta = (name) =>
    document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.content?.trim() || ''
  const wait = async (test, tries = 10, everyMs = 150) => {
    for (let i = 0; i < tries; i++) {
      const v = test()
      if (v) return v
      await new Promise((r) => setTimeout(r, everyMs))
    }
    return ''
  }

  const isLinkedIn = location.hostname.endsWith('linkedin.com') && location.pathname.startsWith('/in/')
  const out = { selection: String(window.getSelection() ?? '').trim().slice(0, 1000) }

  if (isLinkedIn) {
    // Scoped to <main> so a class LinkedIn reuses all over the page (nav,
    // sidebar, "People you may know") doesn't win over the actual profile
    // headline just because it happens to appear earlier in the DOM.
    const scope = document.querySelector('main') || document.body

    // LinkedIn's top card has no <h1> at all on some layouts (the name sits
    // in an <h2>, same as every section header below it) and its classes are
    // build-hashed and change often, so no selector against them is durable.
    // What IS structurally stable: the name is the first heading in <main>,
    // and the headline/company sit as plain <p> text in sibling containers
    // just below it — walking up from the name and scanning each level's
    // next siblings survives a hash-name reshuffle that would break a class
    // selector outright.
    const collectSiblingLines = (startEl, maxUp = 8, maxLines = 2) => {
      const lines = []
      let node = startEl
      for (let i = 0; i < maxUp && node && lines.length < maxLines; i++) {
        let sib = node.nextElementSibling
        while (sib && lines.length < maxLines) {
          // Hidden text is not a profile line. A profile with a video in its
          // header carries the player's screen-reader boilerplate ("This is a
          // modal window.") in a <p> right below the name; read as a line, it
          // took the headline's slot and shifted every field after it by one —
          // the title became that sentence, the company became the headline.
          const p = sib.matches('p') ? sib : sib.querySelector('p')
          const hidden = !p || p.closest(
            '.video-js, [class*="vjs-"], .visually-hidden, .sr-only, [aria-hidden="true"], [hidden]'
          ) || (typeof p.checkVisibility === 'function' && !p.checkVisibility())
          const t = hidden ? '' : (p.textContent || '').trim()
          // "· 1st" / "· 2nd" connection-degree badges sit in the same spot;
          // skip them rather than mistaking one for the headline. Some
          // profiles also show a pronoun badge ("He/Him", "She/Her",
          // "They/Them", ...) right next to the name — same problem: left
          // unfiltered, it eats the headline's slot and shifts every field
          // after it by one (title becomes "He/Him", company becomes the
          // real headline, location becomes the company line). Matched
          // generically as bare "word/word" rather than a hardcoded list,
          // since real headline/company/location text always has spaces or
          // punctuation this exact shape doesn't.
          const isPronounBadge = /^[a-z]{1,12}\/[a-z]{1,12}(\/[a-z]{1,12})?$/i.test(t)
          if (t && !t.startsWith('·') && !isPronounBadge && !lines.includes(t)) lines.push(t)
          sib = sib.nextElementSibling
        }
        node = node.parentElement
      }
      return lines
    }

    const nameEl = await wait(() => scope.querySelector('h1') || scope.querySelector('h2'))
    out.name = nameEl?.textContent?.trim() || ''
    // 3 lines: headline, company/school line, then the city/region line that
    // sits right below it in the same sibling run.
    const lines = nameEl ? collectSiblingLines(nameEl, 8, 3) : []
    out.jobTitle = lines[0] || scope.querySelector('.text-body-medium')?.textContent?.trim() || ''
    // A headline shaped "Role, Org | extra credential | extra tag" packs the
    // org (and often unrelated fellowships/tags) into the same line as the
    // title — e.g. "Executive Director, Harvard Project on Workforce | Aspen
    // Ascend Fellow | Education & Economic Mobility" saved verbatim as a
    // Title once and nobody trimmed it before saving. Requiring BOTH a comma
    // AND a later "|" keeps this narrow: it only fires on this specific
    // multi-clause shape, not on an ordinary single-clause title that happens
    // to contain a comma.
    if (out.jobTitle.includes(',') && out.jobTitle.includes('|')) {
      out.jobTitle = out.jobTitle.split(',')[0].trim()
    }
    // Layouts disagree on the order below the headline: some put the
    // company/school line next, others go straight to the location line
    // ("Greater Madison Area · Contact info"), with the company shown as a
    // badge off to the side. Assuming company-first filed a location as the
    // company. A line that reads as a place is treated as the location, and
    // the company then comes from the badge links below. "Greater Boston" (no
    // trailing "Area") slipped through the original version of this check —
    // LinkedIn's short metro nicknames always lead with "Greater ", so that
    // prefix is checked on its own, not only as part of a longer phrase.
    const looksLikePlace = (t) =>
      /contact info/i.test(t) ||
      /^greater\s+/i.test(t) ||
      /\b(area|region|metropolitan|metro|county|united states|united kingdom|canada)\b/i.test(t)
    let companyLine = lines[1] || ''
    let locationLine = lines[2] || ''
    if (companyLine && looksLikePlace(companyLine)) {
      locationLine = companyLine
      companyLine = ''
    }
    // Where the current employer can come from, most reliable first. Every
    // source is confined to the profile's top card or its Experience
    // section: the old last resort — "any /company/ link in <main>" — read
    // Jeremy Hall's employer off the United Nations card in his Interests
    // section ("United NationsInternational Affairs6,888,866 followers").
    // The top card: the smallest block around the name that also holds the
    // "Contact info" link. <section> alone isn't reliable — on some layouts
    // the name's nearest <section> excludes the company badges beside it.
    const topCard = (() => {
      let el = nameEl
      for (let i = 0; el && i < 14; i++, el = el.parentElement) {
        if (el.querySelector('a[href*="contact-info"]') || /contact info/i.test(el.innerText || '')) return el
      }
      return nameEl?.closest('section') || null
    })()
    const expSection =
      document.getElementById('experience')?.closest('section') ||
      Array.from(scope.querySelectorAll('section')).find((sec) =>
        /^\s*experience/i.test(sec.querySelector('h2')?.textContent || ''))
    // The first Experience entry, only if it's current ("… – Present").
    // Grouped entries (several roles at one company) lead with the company;
    // single roles lead with the title, then "Company · Full-time".
    const entryLines = (li) => {
      const spans = Array.from(li.querySelectorAll('span[aria-hidden="true"], p'))
        .map((el) => (el.textContent || '').trim()).filter(Boolean)
      const lines = spans.filter((t, i) => spans.indexOf(t) === i)
      return lines.length > 0
        ? lines
        : (li.innerText || '').split('\n').map((t) => t.trim()).filter((t, i, a) => t && a.indexOf(t) === i)
    }
    const logoName = (li) => li.querySelector('img[alt$=" logo" i]')?.getAttribute('alt')?.replace(/\s+logo$/i, '').trim() || ''
    const experienceCompanyOf = (li) => {
      const logo = logoName(li)
      if (logo) return logo
      const lines = entryLines(li)
      const grouped = !!li.querySelector('ul li')
      return ((grouped ? lines[0] : lines[1]) || '').split('·')[0].trim()
    }
    const currentExperienceCompany = () => {
      const li = expSection?.querySelector('li')
      if (!li || !/\bpresent\b/i.test(li.textContent || '')) return ''
      return experienceCompanyOf(li)
    }
    // The badges beside the name (current company, school). LinkedIn
    // renders them as links or buttons depending on the layout, with
    // build-hashed classes — so every short link/button in the top card is a
    // candidate, minus the name, the headline, location and UI controls.
    const firstLine = (el) => ((el.innerText || el.textContent || '').split('\n').map((t) => t.trim()).find(Boolean) || '')
    const UI_TEXT = /^(contact info|message|more|connect|follow|following|pending|open to|share profile|add profile section|enhance profile|resources|view in sales navigator)$|connections?$|followers?$|^\d/i
    const topCardBadges = () => {
      if (!topCard) return []
      const skip = new Set([out.name, out.jobTitle, lines[0], locationLine].map((t) => (t || '').trim().toLowerCase()).filter(Boolean))
      const seen = new Set()
      const badges = []
      for (const el of topCard.querySelectorAll('a, button')) {
        const text = firstLine(el).replace(/\s+/g, ' ')
        const key = text.toLowerCase()
        if (text.length < 2 || text.length > 70 || skip.has(key) || seen.has(key) || UI_TEXT.test(text)) continue
        if (el.closest('h1, h2') || text.includes('·')) continue
        seen.add(key)
        const href = el.getAttribute('href') || ''
        const label = el.getAttribute('aria-label') || ''
        badges.push({
          text,
          // Strict: only LinkedIn's own school link or label. The looser
          // name test below is fine for steering the employer pick, but
          // "Khan Academy" on someone's card is usually where they work.
          schoolLink: /\/school\//.test(href) || /education/i.test(label),
          school: /\/school\//.test(href) || /education/i.test(label) ||
            /\b(university|college|school|academy|institute of technology|polytechnic)\b/i.test(text),
        })
      }
      return badges
    }
    // "Current company: NextLadder Ventures. Click to skip to experience card"
    const currentCompanyLabel = () => {
      const el = document.querySelector('[aria-label*="Current company" i]')
      const m = (el?.getAttribute('aria-label') || '').match(/current company:?\s*(.+?)(?:\.\s*click\b.*)?$/i)
      return m ? m[1].trim() : ''
    }
    const headline = (lines[0] || out.jobTitle || '').toLowerCase()
    // A badge the headline also names ("Co-founder, NextLadder Ventures")
    // is the employer beyond doubt — school or not (Harvard staff).
    // Matched on the badge's distinctive words, so "Harvard University" is
    // found in "Executive Director, Harvard Project on Workforce".
    const GENERIC_ORG_WORDS = new Set(['the', 'of', 'and', 'at', 'for', 'university', 'college', 'school', 'inc', 'llc', 'ltd', 'co', 'corp', 'corporation', 'company', 'group', 'plc', 'lp', 'llp'])
    const headlineWords = new Set(headline.split(/[^a-z0-9&'-]+/).filter(Boolean))
    const badgeInHeadline = () => topCardBadges().find((b) => {
      const core = b.text.toLowerCase().split(/[^a-z0-9&'-]+/).filter((w) => w && !GENERIC_ORG_WORDS.has(w))
      return core.length > 0 && core.some((w) => w.length >= 3) && core.every((w) => headlineWords.has(w))
    })?.text || ''
    const firstCompanyBadge = () => topCardBadges().find((b) => !b.school)?.text || ''

    // A status typed into the company field ("looking for new opportunity",
    // "open to work") means no employer — stop there rather than falling
    // through to a worse source. Card text ("6,888,866 followers") is never
    // a company name.
    const JOB_SEEKING = /^(actively\s+)?(looking|seeking|searching)\s+(for|a|an|my|new|next|opportunit\w*|roles?|positions?|employment|work)\b|\bopen to (work|new|opportunit)|\b(new|next) (opportunit|role|challenge)|\bin transition\b|\bbetween (roles|jobs|opportunities)\b|\bcareer (break|transition)\b/i
    const CARD_TEXT = /\bfollowers?\b|\d{1,3}(,\d{3})+/i
    out.company = ''
    for (const source of [
      currentCompanyLabel,
      badgeInHeadline,
      () => (companyLine ? companyLine.split('·')[0].trim() : ''),
      () => pick('[aria-label^="Current company"]'),
      firstCompanyBadge,
      currentExperienceCompany,
    ]) {
      const t = (source() || '').replace(/\s+/g, ' ').trim()
      if (!t || CARD_TEXT.test(t)) continue
      // Saved under the "- Unemployed" placeholder, so their headline is
      // kept (a title needs an organization to hang on).
      if (JOB_SEEKING.test(t)) { out.company = '- Unemployed'; break }
      out.company = t
      break
    }
    // Structure-free fallback: the headline's org segment ("Co-Founder &
    // Managing Partner, Magnify Ventures" → "Magnify Ventures") that also
    // shows up as its own line of text on the page — the company badge,
    // whatever elements LinkedIn wraps it in this week. Where LinkedIn puts
    // the badges relative to the name changes between layouts; the text
    // doesn't.
    if (!out.company) {
      const clean = (t) => (t || '').replace(/\s+/g, ' ').trim().toLowerCase()
      const pageLines = new Set([
        ...(scope.innerText || '').split('\n').map(clean),
        ...Array.from(scope.querySelectorAll('span, p, a, button, div, h3, h4'))
          .filter((el) => el.children.length === 0 || [...el.children].every((c) => c.tagName === 'SPAN' && !c.children.length))
          .map((el) => clean(el.textContent)),
      ].filter(Boolean))
      const segs = (lines[0] || out.jobTitle || '')
        .split(/\s*(?:,|\||·|\bat\b|@|\s[-–—]\s)\s*/i)
        .slice(1).map((t) => t.trim()).filter((t) => t.length >= 2)
      const ORG_WORD = /\b(ventures|capital|partners|group|inc|llc|ltd|labs|fund|funds|foundation|institute|university|college|bank|holdings|technologies|systems|solutions|consulting|advisors|associates|company|corp|corporation|health|network|alliance|collective|studio|agency)\b/i
      const hit = segs.find((t) => pageLines.has(t.toLowerCase()) && !JOB_SEEKING.test(t) && !CARD_TEXT.test(t))
        // Not on the page as a line, but reads as an organization name.
        ?? segs.find((t) => ORG_WORD.test(t) && !JOB_SEEKING.test(t) && t.split(' ').length <= 6)
      if (hit) out.company = hit
    }
    // "Senior Technical Writer at Oracle": the headline names the employer
    // when nothing else on the card does.
    const atMatch = !out.company && out.jobTitle.match(/^(.{3,80}?)\s+(?:at|@)\s+([^|,·]{2,60})$/i)
    if (atMatch && !JOB_SEEKING.test(atMatch[2])) {
      out.jobTitle = atMatch[1].trim()
      out.company = atMatch[2].trim()
    }
    // The title is the role, not "role + employer": "Co-founder, NextLadder
    // Ventures" / "VP at Acme" / "CFO | Acme" → "Co-founder" / "VP" / "CFO".
    if (out.company && out.company !== '- Unemployed') {
      const esc = out.company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const stripped = out.jobTitle.replace(new RegExp(`\\s*(?:,|\\bat\\b|@|\\||-|–|—)\\s*${esc}\\s*$`, 'i'), '').trim()
      if (stripped && stripped !== out.jobTitle) out.jobTitle = stripped
    }
    out.location = locationLine.split('·')[0].trim()

    // Schools and, once they've left it, the last employer — for the
    // university alumni lists and company former-employee lists in the CRM.
    // Both come from the Education/Experience sections, which LinkedIn only
    // renders once they scroll into view, so they're scrolled through once
    // (and the page put back where it was) when they aren't there yet.
    const sectionTitled = (re) => {
      for (const h of scope.querySelectorAll('h2, h3')) {
        if (re.test((h.textContent || '').trim())) return h.closest('section') || h.parentElement?.parentElement || null
      }
      return null
    }
    let eduSection = document.getElementById('education')?.closest('section') || sectionTitled(/^education$/i)
    let laterExpSection = expSection || sectionTitled(/^experience$/i)
    if (!eduSection || !laterExpSection) {
      const scroller = document.getElementById('workspace') || document.scrollingElement
      const start = scroller.scrollTop
      for (let i = 0; i < 10 && !(eduSection && laterExpSection); i++) {
        scroller.scrollTop += Math.max(400, scroller.clientHeight)
        await new Promise((r) => setTimeout(r, 250))
        eduSection = eduSection || sectionTitled(/^education$/i)
        laterExpSection = laterExpSection || sectionTitled(/^experience$/i)
      }
      scroller.scrollTop = start
    }
    // Both sections are read as their visible lines of text, in order.
    // LinkedIn's markup here keeps shifting (2026: no <li> per entry, logos
    // only for organizations with a LinkedIn page, the "Education" heading
    // and every entry inside one shared block), but what's displayed has
    // been stable: an entry is a name, then its degree or title, then a
    // date line. A logo's alt text confirms a name; nothing depends on it.
    const visibleLines = (sec) => {
      if (!sec) return []
      const out2 = []
      for (const el of sec.querySelectorAll('p, span[aria-hidden="true"]')) {
        if (el.querySelector('p') || el.closest('h2, h3')) continue
        if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) continue
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
        if (!t || /^(show all|see more|… ?more)\b/i.test(t) || t === out2[out2.length - 1]) continue
        out2.push(t)
      }
      return out2
    }
    const logoNames = (sec) => new Set(Array.from(sec?.querySelectorAll('img[alt$=" logo" i]') || [])
      .map((img) => img.getAttribute('alt').replace(/\s+logo$/i, '').trim()))
    // "2004 – 2008", "Sep 2010 - May 2012 · 1 yr 8 mos", "2019 - Present"
    const MON = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\\w*\\.?\\s+'
    const DATE_LINE = new RegExp(`^(${MON})?\\d{4}(\\s*[-–]\\s*((${MON})?\\d{4}|present))?(\\s*·.*)?$`, 'i')
    const DURATION = /^(\d+\s+yrs?)?\s*(\d+\s+mos?)?$/i

    out.schools = []
    const eduLogos = logoNames(eduSection)
    let current = null
    let dated = false
    for (const t of visibleLines(eduSection)) {
      if (DATE_LINE.test(t)) { if (current) dated = true; continue }
      if (/^(activities and societies|grade)\b/i.test(t) || t.length > 160) continue
      if (!current || dated || eduLogos.has(t)) {
        current = { name: t, detail: '' }
        out.schools.push(current)
        dated = false
      } else if (!current.detail) {
        current.detail = t
      }
    }
    out.schools = out.schools.filter((sc, i, a) => !CARD_TEXT.test(sc.name) && a.findIndex((x) => x.name === sc.name) === i).slice(0, 6)
    if (out.schools.length === 0) {
      for (const b of topCardBadges()) if (b.schoolLink) out.schools.push({ name: b.text, detail: '' })
    }

    // The last employer, only for someone with no current role at all —
    // any "Present" in Experience means they're working, and their current
    // employer is already their organization. The first entry is either a
    // single role (title, "Company · Full-time", dates) or a company with
    // several (company, "12 yrs 2 mos", then each role).
    const expLines = visibleLines(laterExpSection)
    if (expLines.length > 1 && !expLines.some((t) => /\bpresent\b/i.test(t))) {
      const grouped = DURATION.test(expLines[1]) && /\d/.test(expLines[1])
      const company = (grouped ? expLines[0] : expLines[1]).split('·')[0].trim()
      const title = grouped ? (expLines[2] || '') : expLines[0]
      if (company && !DATE_LINE.test(company) && !CARD_TEXT.test(company) && !JOB_SEEKING.test(company)) {
        out.formerEmployer = { name: company, title: title === company || DATE_LINE.test(title) ? '' : title }
      }
    }

    // The connection-degree badge ("· 1st" / "· 2nd" / "· 3rd") sits right
    // next to the name — deliberately excluded from collectSiblingLines
    // above since it isn't a headline/company/location line, but it's the
    // one reliable signal for how warm this contact actually is. Matched as
    // a full-string pattern (not a substring) so a job title that happens to
    // contain an ordinal, e.g. "1st Lieutenant", can't be mistaken for it.
    //
    // Read from the top card only. Searched across all of <main>, the first
    // "· 1st" was often someone else's — a mutual connection under "People
    // who can introduce you", or a poster in Activity — and a 2nd-degree
    // stranger was saved as a HOT 1st.
    out.connectionDegree =
      // Visible only: the header also carries a hidden, zero-width "· 1st"
      // ahead of the real badge, and that's what made a 2nd read as 1st.
      Array.from((topCard || nameEl?.parentElement || scope).querySelectorAll('p, span'))
        .filter((el) => typeof el.checkVisibility !== 'function' || el.checkVisibility())
        .map((p) => p.textContent.trim())
        .find((t) => /^·\s*(1st|2nd|3rd\+?)$/i.test(t))
        ?.replace('·', '')
        .trim() || ''
    // <title> rarely changes format even when the page markup does, but the
    // format itself varies — sometimes "Name - Headline | LinkedIn", often
    // just "Name | LinkedIn" with no headline at all — so try the richer
    // pattern first and fall back to a name-only match.
    if (!out.name || !out.jobTitle) {
      const m = document.title.match(/^\(?\d*\)?\s*([^|]+?)\s*-\s*([^|]+?)\s*\|\s*LinkedIn/i)
      if (m) {
        if (!out.name) out.name = m[1].trim()
        if (!out.jobTitle) out.jobTitle = m[2].trim()
      } else if (!out.name) {
        const m2 = document.title.match(/^\(?\d*\)?\s*([^|]+?)\s*\|\s*LinkedIn/i)
        if (m2) out.name = m2[1].trim()
      }
    }
  } else {
    out.title = meta('og:title') || document.title || ''
    out.company = meta('og:site_name') || ''
    // "cuts 3,000 jobs" / "lays off 450 employees"
    const text = document.body.innerText.slice(0, 20000)
    const m = text.match(/\b(?:cut|cuts|cutting|lay(?:s|ing)? off|laid off|eliminat\w+|reduc\w+)\D{0,24}([\d,]{3,})\b/i)
    if (m) out.headcount = Number(m[1].replace(/,/g, ''))

    // Anything that isn't a LinkedIn profile can still be a person: a staff
    // directory, a faculty bio, a "leadership" page. None of them share
    // markup, so this leans on what pages of that kind reliably have — one
    // <h1> that is the name, a "Name | Organization" <title>, a mailto: and a
    // tel: link, and a short line naming the role somewhere after the name.
    const clean = (t) => (t || '').replace(/\s+/g, ' ').trim()
    const titleCase = (t) => (t && t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (m2, a, b) => a + b.toUpperCase()) : t)
    const looksLikeName = (t) => {
      const words = t.split(' ')
      return words.length >= 2 && words.length <= 5 && !/\d/.test(t) && words.every((w) => /^[A-Z][\p{L}'’.-]*$/u.test(w))
    }
    const scope = document.querySelector('main') || document.body
    const h1 = scope.querySelector('h1') || document.querySelector('h1')
    const titleParts = clean(document.title).split(/\s+[|\-–—]\s+/).filter(Boolean)
    const nameCandidates = [clean(h1?.textContent), titleParts[0]].filter(Boolean).map(titleCase)
    const person = { name: nameCandidates.find(looksLikeName) || '' }

    // "Daniel J. Elsener | Marian University": the segment that isn't the name.
    person.company =
      titleParts.slice(1).find((p2) => p2.toLowerCase() !== person.name.toLowerCase() && !/^(home|directory|about|profile|people|staff|faculty)$/i.test(p2)) ||
      meta('og:site_name') || ''

    const mail = document.querySelector('a[href^="mailto:" i]')
    person.email = mail
      ? decodeURIComponent(mail.getAttribute('href').replace(/^mailto:/i, '').split('?')[0]).trim()
      : (document.body.innerText.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/) || [''])[0]
    const tel = document.querySelector('a[href^="tel:" i]')
    const phoneText = tel ? clean(tel.textContent) : ''
    person.phone = /\d{3}\D*\d{3}\D*\d{4}/.test(phoneText)
      ? phoneText
      : tel ? decodeURIComponent(tel.getAttribute('href').replace(/^tel:/i, '')).trim()
      : (document.body.innerText.match(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/) || [''])[0]

    // The role: the first short line after the name that reads as a job title.
    // Text nodes rather than elements, so it works whether the title sits in
    // its own <strong> or is a bare line before a <br>. Menus and footers are
    // skipped — "Vice President for Admissions" in a nav is a link, not a role.
    const ROLE = /\b(president|vice president|vp|chief|ceo|cfo|coo|cto|cio|chair(?:man|woman|person)?|director|dean|provost|chancellor|professor|lecturer|principal|partner|founder|co-?founder|managing|head of|manager|officer|executive|superintendent|commissioner|secretary|treasurer|trustee|fellow|counsel|advisor|adviser)\b/i
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const t = clean(node.textContent)
      if (t.length < 3 || t.length > 90 || !ROLE.test(t)) continue
      if (h1 && !(h1.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) continue
      if (node.parentElement?.closest('nav, header, footer, aside, script, style, [role="navigation"]')) continue
      // A sentence that happens to contain "president", not a role line.
      if (t.split(' ').length > 10 || /[a-z]\.\s+[A-Z]/.test(t)) continue
      person.jobTitle = t
      break
    }

    // Structured data beats guessing from layout, when a page publishes it.
    // Sites (universities, firms, publishers) add schema.org JSON-LD for search
    // engines: a Person carries name, jobTitle, email, telephone, employer and
    // address as named fields, so none of the above is inference.
    const nodes = []
    const walk = (v) => {
      if (Array.isArray(v)) return v.forEach(walk)
      if (v && typeof v === 'object') { nodes.push(v); walk(v['@graph']); walk(v.mainEntity) }
    }
    for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { walk(JSON.parse(el.textContent)) } catch { /* malformed block — ignore */ }
    }
    const typeOf = (n) => [].concat(n['@type'] || []).map(String)
    const str = (v) => (typeof v === 'string' ? clean(v) : v && typeof v === 'object' ? clean(v.name || v['@value'] || '') : '')
    const ld = nodes.find((n) => typeOf(n).includes('Person'))
    if (ld) {
      const org = ld.worksFor || ld.affiliation
      const addr = ld.address && typeof ld.address === 'object' ? [ld.address.addressLocality, ld.address.addressRegion].filter(Boolean).join(', ') : str(ld.address)
      const ldEmail = str(ld.email).replace(/^mailto:/i, '')
      const merged = {
        name: str(ld.name) || [str(ld.givenName), str(ld.familyName)].filter(Boolean).join(' '),
        jobTitle: str(ld.jobTitle),
        company: str(Array.isArray(org) ? org[0] : org),
        email: ldEmail,
        phone: str(ld.telephone),
        location: addr,
      }
      for (const [k, v] of Object.entries(merged)) if (v) person[k] = v
      out.hasPersonSchema = true
    }
    out.isArticle = nodes.some((n) => typeOf(n).some((t) => /^(News|Blog|Scholarly|Tech)?Article$|^Report$|^ScholarlyArticle$/.test(t))) ||
      meta('og:type') === 'article'
    out.person = person
  }
  return out
}

// A value read off the page. A non-LinkedIn page has its own person read
// (see readPage) that takes over for the shared field ids.
function scrapedValue(id) {
  const v = (kind === 'person' && page.scraped.person ? page.scraped.person[id] : undefined) ?? page.scraped[id]
  return typeof v === 'string' ? v.trim() : v
}

function renderFields() {
  // No note on a person — never used, and it pushed Save below the fold.
  // Layoff, research and product still use it (product's note is the idea).
  $('note').hidden = kind === 'person'
  document.querySelector('label[for="note"]').hidden = kind === 'person'
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.kind === kind)))
  const host = $('fields')
  host.innerHTML = ''
  for (const f of KINDS[kind]) {
    if (f.type === 'toggle') {
      const item = document.createElement('label')
      item.className = 'checkbox-item toggle'
      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.id = `f-${f.id}`
      item.append(cb, document.createTextNode(f.label))
      host.append(item)
      continue
    }

    const label = document.createElement('label')
    label.htmlFor = `f-${f.id}`
    label.textContent = f.label
    host.append(label)

    if (f.type === 'checkboxes') {
      const wrap = document.createElement('div')
      wrap.id = `f-${f.id}`
      wrap.className = 'checkboxes'
      for (const [value, optLabel] of f.options) {
        const item = document.createElement('label')
        item.className = 'checkbox-item'
        const cb = document.createElement('input')
        cb.type = 'checkbox'
        cb.value = value
        item.append(cb, document.createTextNode(optLabel))
        wrap.append(item)
      }
      host.append(wrap)
      continue
    }

    if (f.type === 'select') {
      const select = document.createElement('select')
      select.id = `f-${f.id}`
      for (const [value, optLabel] of f.options) {
        const opt = document.createElement('option')
        opt.value = value
        opt.textContent = optLabel
        select.append(opt)
      }
      host.append(select)
      continue
    }

    const input = document.createElement('input')
    input.id = `f-${f.id}`
    input.type = f.type
    // A non-LinkedIn page has its own person read (see readPage) that takes
    // over for the shared field ids, so research's Publisher isn't overwritten.
    const guess = (kind === 'person' && page.scraped.person ? page.scraped.person[f.id] : undefined) ?? page.scraped[f.id]
    if (guess !== undefined && guess !== '') input.value = guess
    else if (f.id === 'title') input.value = page.title
    host.append(input)
  }

  // What the page told us that has no field of its own — shown so a wrong
  // read is visible before it's saved, not discovered on the record later.
  // At the top: below the checkboxes it sat out of sight, under the fold.
  if (kind === 'person') {
    const facts = [
      page.scraped.connectionDegree && `LinkedIn: ${page.scraped.connectionDegree}`,
      ...PERSON_PAGE_FACTS.map(scrapedValue),
      page.scraped.schools?.length && `Schools: ${page.scraped.schools.map((s) => s.name).join(', ')}`,
      page.scraped.formerEmployer && `Last employer: ${page.scraped.formerEmployer.name}`,
    ].filter(Boolean)
    if (facts.length > 0) {
      const p = document.createElement('p')
      p.className = 'muted facts'
      p.textContent = facts.join(' · ')
      host.prepend(p)
    }
  }
}

async function init() {
  // Shown so a stale copy (extension not reloaded after an update) is obvious.
  if ($('version')) $('version').textContent = `v${chrome.runtime.getManifest().version}`
  const { base, token } = await chrome.storage.local.get(['base', 'token'])
  if (!base || !token) {
    $('setup').hidden = false
    return
  }
  $('capture').hidden = false

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  page.title = tab?.title ?? ''
  page.url = tab?.url ?? ''
  $('page-title').textContent = page.title || 'This page'
  $('page-url').textContent = page.url

  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readPage })
    page.scraped = result ?? {}
    page.selection = result?.selection ?? ''
    if (page.url.includes('linkedin.com/in/')) kind = 'person'
    else if (page.scraped.headcount) kind = 'layoff'
    else if (page.scraped.hasPersonSchema && page.scraped.person?.name) kind = 'person'
    else if (page.scraped.isArticle && !page.scraped.person?.email) kind = 'research'
    else if (page.scraped.person?.name && (page.scraped.person.email || page.scraped.person.phone || /\/(directory|people|profile|faculty|staff|team|leadership|bio)s?\b/i.test(new URL(page.url).pathname))) kind = 'person'
    else kind = 'research'
  } catch {
    // Chrome refuses to inject into its own pages and the Web Store; the popup
    // still works, just without prefill.
    page.scraped = {}
  }
  renderFields()

  if (kind === 'person' && page.url.includes('linkedin.com/in/')) checkExisting(base, token)
}

/**
 * "Is this person already in the CRM?" — checked as soon as the popup opens
 * on a profile, before you've typed anything. Silent on any failure (bad
 * token, offline, server hiccup): the save button's own error handling
 * already covers those, and this is a courtesy notice, not a gate.
 */
async function checkExisting(base, token) {
  try {
    const res = await fetch(`${base}/api/crm/lookup?url=${encodeURIComponent(page.url)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const data = await res.json()
    if (data.removed) {
      const when = new Date(data.removedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const banner = $('existing-banner')
      banner.textContent = `${data.fullName} was removed from the CRM on ${when}. `
      const link = document.createElement('a')
      link.href = '#'
      link.textContent = 'Restore them'
      link.addEventListener('click', (e) => {
        e.preventDefault()
        chrome.tabs.create({ url: `${base}/support/admin/crm/removed?q=${encodeURIComponent(data.fullName)}` })
      })
      banner.append(link)
      banner.hidden = false
      return
    }
    if (!data.exists) return

    const banner = $('existing-banner')
    banner.textContent = `Already in the CRM${data.priority ? ` (${data.priority})` : ''} — last contacted ${data.lastContacted}. `
    const link = document.createElement('a')
    link.href = '#'
    link.textContent = 'View record'
    link.addEventListener('click', (e) => {
      e.preventDefault()
      chrome.tabs.create({ url: `${base}/support/admin/crm/people/${data.personId}` })
    })
    banner.append(link)
    banner.hidden = false
  } catch {
    // See doc comment above.
  }
}

document.addEventListener('click', async (e) => {
  const tab = e.target.closest('.tab')
  if (tab) { kind = tab.dataset.kind; renderFields() }
})

$('save-token').addEventListener('click', async () => {
  let base = $('base').value.trim().replace(/\/+$/, '')
  // A bare "admin.launchyournextchapter.com" with no protocol isn't an
  // absolute URL — fetch() would resolve it relative to the extension's own
  // chrome-extension:// origin and the request would never leave the
  // extension, surfacing as a generic "could not reach the site" later with
  // no clue why. Assume https rather than fail silently on save.
  if (base && !/^https?:\/\//i.test(base)) base = `https://${base}`
  const token = $('token').value.trim()
  if (!base || !token) {
    $('setup-msg').textContent = 'Both fields are needed.'
    $('setup-msg').className = 'msg err'
    return
  }
  await chrome.storage.local.set({ base, token })
  $('setup').hidden = true
  $('capture').hidden = false
  init()
})

$('forget').addEventListener('click', async () => {
  await chrome.storage.local.remove(['base', 'token'])
  $('capture').hidden = true
  $('setup').hidden = false
})

$('save').addEventListener('click', async () => {
  const btn = $('save')
  const msg = $('msg')
  btn.disabled = true
  btn.textContent = 'Saving…'
  msg.textContent = ''
  msg.className = 'msg'

  const { base, token } = await chrome.storage.local.get(['base', 'token'])
  const payload = { kind, url: page.url, note: kind === 'person' ? '' : $('note').value.trim(), selection: page.selection }
  if (kind === 'person') {
    for (const id of PERSON_PAGE_FACTS) {
      const v = scrapedValue(id)
      if (v) payload[id] = v
    }
  }
  // Not a field you'd hand-edit — it's a fact read off the page, used
  // server-side to set warmth (1st → Hot, 2nd → Warm, 3rd/unknown → Cold).
  if (kind === 'person' && page.scraped.connectionDegree) payload.connectionDegree = page.scraped.connectionDegree
  // Same: read off the page, not typed — they put this person on their
  // schools' alumni lists and their last employer's former-employee list.
  if (kind === 'person' && page.scraped.schools?.length) payload.schools = page.scraped.schools
  if (kind === 'person' && page.scraped.formerEmployer) payload.formerEmployer = page.scraped.formerEmployer
  for (const f of KINDS[kind]) {
    if (f.type === 'toggle') {
      if ($(`f-${f.id}`)?.checked) payload[f.id] = true
      continue
    }
    if (f.type === 'checkboxes') {
      const checked = Array.from(document.querySelectorAll(`#f-${f.id} input:checked`)).map((cb) => cb.value)
      if (checked.length > 0) payload[f.id] = checked
      continue
    }
    const v = $(`f-${f.id}`)?.value?.trim()
    if (v) payload[f.id] = f.type === 'number' ? Number(v) : v
  }

  try {
    const res = await fetch(`${base}/api/crm/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (res.ok) {
      msg.textContent = data.message ?? 'Saved.'
      msg.className = 'msg ok'
      btn.textContent = 'Saved'
      setTimeout(() => window.close(), 1200)
      return
    }
    msg.textContent = res.status === 401
      ? 'That token was rejected. Reconnect with a fresh one.'
      : (data.error ?? 'Could not save that.')
    msg.className = 'msg err'
  } catch (err) {
    // Includes the actual base URL and error text rather than a generic
    // message — a bad saved address (typo, wrong protocol) looks identical
    // to a real network failure otherwise, and there's no console the user
    // will think to open.
    msg.textContent = `Could not reach ${base}/api/crm/capture — ${err instanceof Error ? err.message : 'check the address'}.`
    msg.className = 'msg err'
  }
  btn.disabled = false
  btn.textContent = 'Save to CRM'
})

init()
