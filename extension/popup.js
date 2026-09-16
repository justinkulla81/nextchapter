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
    { id: 'linkedin', label: 'LinkedIn', type: 'readonly' },
    { id: 'roles', label: 'Contact type(s)', type: 'checkboxes', options: PERSON_ROLE_OPTIONS },
    { id: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS },
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
    out.name = await wait(() => pick('h1'))
    out.jobTitle = scope.querySelector('.text-body-medium')?.textContent?.trim() || ''
    out.company =
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
    // <title> rarely changes format even when the page markup does —
    // "Name - Headline | LinkedIn" — so it's a last-resort, selector-free
    // source when the DOM-based scrape above comes back empty.
    if (!out.name || !out.jobTitle) {
      const m = document.title.match(/^\(?\d*\)?\s*([^|]+?)\s*-\s*([^|]+?)\s*\|\s*LinkedIn/i)
      if (m) {
        if (!out.name) out.name = m[1].trim()
        if (!out.jobTitle) out.jobTitle = m[2].trim()
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
    input.type = f.type === 'readonly' ? 'text' : f.type
    if (f.type === 'readonly') input.readOnly = true
    const guess = page.scraped[f.id]
    if (guess !== undefined && guess !== '') input.value = guess
    else if (f.id === 'title') input.value = page.title
    // The LinkedIn field is just a confirmation of the URL already being
    // sent as part of every payload — it isn't collected separately in
    // the save handler below.
    else if (f.id === 'linkedin' && page.url.includes('linkedin.com/in/')) input.value = page.url
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
  for (const f of KINDS[kind]) {
    if (f.type === 'readonly') continue // display only — the URL is already sent above
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
