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

const KINDS = {
  person: [
    { id: 'name', label: 'Name', type: 'text' },
    { id: 'company', label: 'Company', type: 'text' },
    { id: 'jobTitle', label: 'Title', type: 'text' },
    { id: 'location', label: 'Location', type: 'text' },
    { id: 'roles', label: 'Contact type(s)', type: 'checkboxes', options: PERSON_ROLE_OPTIONS },
    { id: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS },
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
          const t = (sib.matches('p') ? sib.textContent : sib.querySelector('p')?.textContent || '').trim()
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
    out.company =
      (lines[1] ? lines[1].split('·')[0].trim() : '') ||
      pick('[aria-label^="Current company"]') ||
      pick('button[aria-label*="Current company"] span') ||
      // Newer top-card layout: the company/school badges under the name are
      // plain links with no "Current company" aria-label at all — the first
      // one is company far more often than school.
      pick('.pv-text-details__right-panel a[href*="/company/"]') ||
      pick('a[data-field="experience_company_logo"]') ||
      // Broadest fallback: any company-page link inside the profile's main
      // content. Hrefs are far more durable across LinkedIn redesigns than
      // the CSS class names wrapping them.
      scope.querySelector('a[href*="/company/"]')?.textContent?.trim() ||
      ''
    out.location = lines[2] || ''

    // The connection-degree badge ("· 1st" / "· 2nd" / "· 3rd") sits right
    // next to the name — deliberately excluded from collectSiblingLines
    // above since it isn't a headline/company/location line, but it's the
    // one reliable signal for how warm this contact actually is. Matched as
    // a full-string pattern (not a substring) so a job title that happens to
    // contain an ordinal, e.g. "1st Lieutenant", can't be mistaken for it.
    out.connectionDegree =
      Array.from(scope.querySelectorAll('p'))
        .map((p) => p.textContent.trim())
        .find((t) => /^·\s*(1st|2nd|3rd)$/i.test(t))
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
  }
  return out
}

function renderFields() {
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.kind === kind)))
  const host = $('fields')
  host.innerHTML = ''
  for (const f of KINDS[kind]) {
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
    const guess = page.scraped[f.id]
    if (guess !== undefined && guess !== '') input.value = guess
    else if (f.id === 'title') input.value = page.title
    host.append(input)
  }
}

async function init() {
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
  const payload = { kind, url: page.url, note: $('note').value.trim(), selection: page.selection }
  // Not a field you'd hand-edit — it's a fact read off the page, used
  // server-side to set warmth (1st → Hot, 2nd → Warm, 3rd/unknown → Cold).
  if (kind === 'person' && page.scraped.connectionDegree) payload.connectionDegree = page.scraped.connectionDegree
  for (const f of KINDS[kind]) {
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
