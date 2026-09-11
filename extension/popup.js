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

const KINDS = {
  person: [
    { id: 'name', label: 'Name', type: 'text' },
    { id: 'company', label: 'Company', type: 'text' },
    { id: 'jobTitle', label: 'Title', type: 'text' },
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
  article: [{ id: 'title', label: 'Title', type: 'text' }],
}

let kind = 'person'
let page = { title: '', url: '', selection: '', scraped: {} }

const $ = (id) => document.getElementById(id)

/** Runs in the page. Pulls what is visibly there; guesses nothing. */
function readPage() {
  const pick = (sel) => document.querySelector(sel)?.textContent?.trim() || ''
  const meta = (name) =>
    document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.content?.trim() || ''

  const isLinkedIn = location.hostname.endsWith('linkedin.com') && location.pathname.startsWith('/in/')
  const out = { selection: String(window.getSelection() ?? '').trim().slice(0, 1000) }

  if (isLinkedIn) {
    out.name = pick('h1') || ''
    // The headline sits under the name; the company block varies by layout, so
    // take the first plausible one and let the human correct it.
    out.jobTitle = pick('.text-body-medium') || ''
    out.company =
      pick('[aria-label^="Current company"]') ||
      pick('button[aria-label*="Current company"] span') ||
      ''
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
    const input = document.createElement('input')
    input.id = `f-${f.id}`
    input.type = f.type
    const guess = page.scraped[f.id]
    if (guess !== undefined && guess !== '') input.value = guess
    else if (f.id === 'title') input.value = page.title
    host.append(label, input)
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
  const base = $('base').value.trim().replace(/\/+$/, '')
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
  } catch {
    msg.textContent = 'Could not reach the site. Check the address and your connection.'
    msg.className = 'msg err'
  }
  btn.disabled = false
  btn.textContent = 'Save to CRM'
})

init()
