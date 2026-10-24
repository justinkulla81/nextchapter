// Runs on Greenhouse, Ashby and Lever application pages. It fills fields only when the member
// presses the button, never submits, and remembers a Submit click so it can log the
// application once the employer's confirmation screen appears.
;(function () {
  const M = self.NCApplyMap
  const site = M.siteOf(location.href)
  if (!site || window.top !== window) return

  const send = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => resolve(r || { ok: false, error: 'network' })))
  const track = (event, props) => send({ type: 'api', path: 'event', method: 'POST', body: { event, site, props: props || {} } })

  // ── Panel ────────────────────────────────────────────────────────────────
  let panel, status, button
  function mountPanel() {
    if (panel) return
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647'
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML =
      '<style>div{font:14px/1.4 system-ui,sans-serif;background:#fff;color:#16213a;border:1px solid #d9dde6;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.15);padding:14px;width:270px}' +
      'b{display:block;margin-bottom:4px}p{margin:0 0 10px;color:#4a5568}button{font:inherit;background:#c2410c;color:#fff;border:0;border-radius:8px;padding:9px 12px;width:100%;cursor:pointer}' +
      'button[disabled]{opacity:.6;cursor:default}a{color:#c2410c}.x{background:none;color:#4a5568;width:auto;padding:0;position:absolute;top:8px;right:12px}</style>' +
      '<div><button class="x" title="Hide">×</button><b>NextChapter Apply Helper</b><p id="s"></p><button id="go">Fill from my profile</button></div>'
    document.documentElement.appendChild(host)
    panel = host
    status = root.getElementById('s')
    button = root.getElementById('go')
    root.querySelector('.x').onclick = () => host.remove()
    button.onclick = fillAll
  }
  const say = (t) => { status.textContent = t }

  // ── Reading the form ─────────────────────────────────────────────────────
  function labelOf(el) {
    if (el.id) {
      const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]')
      if (l) return l.innerText
    }
    const wrap = el.closest('label')
    if (wrap) return wrap.innerText
    const by = el.getAttribute('aria-labelledby')
    if (by) return by.split(/\s+/).map((id) => (document.getElementById(id) || {}).innerText || '').join(' ')
    const group = el.closest('.field, .application-field, [class*="field"], [class*="Field"]')
    const l2 = group && group.querySelector('label')
    return l2 ? l2.innerText : ''
  }

  function describe(el) {
    return { label: labelOf(el), name: el.name, id: el.id, placeholder: el.placeholder, ariaLabel: el.getAttribute('aria-label'), autocomplete: el.getAttribute('autocomplete'), type: el.tagName === 'TEXTAREA' ? 'textarea' : el.type }
  }

  // Dropdown-with-suggestions fields (Greenhouse selects, Lever's location) only accept a value picked from their
  // list; typing text into them looks filled but does not count. The member picks those themselves.
  function isPicker(el) {
    return el.getAttribute('role') === 'combobox' || !!el.getAttribute('aria-autocomplete') || !!el.getAttribute('aria-haspopup') || (site === 'lever' && el.name === 'location')
  }

  function setValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.style.outline = '2px solid #c2410c'
    el.style.outlineOffset = '1px'
  }

  async function attachResume(input) {
    if (input.files && input.files.length) return false
    const r = await send({ type: 'api', path: 'resume', binary: true })
    if (!r.ok) return false
    const bin = atob(r.base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const dt = new DataTransfer()
    dt.items.add(new File([bytes], r.fileName, { type: r.type }))
    input.files = dt.files
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }

  async function fillAll() {
    button.disabled = true
    say('Reading your profile…')
    const p = await send({ type: 'api', path: 'profile' })
    if (!p.ok) {
      button.disabled = false
      say(p.error === 'not_connected' ? 'Not connected yet. Click the puzzle-piece icon, open Apply Helper and paste your connect code.' : p.error === 'expired' ? 'Your connect code expired. Get a new one from NextChapter and paste it in the helper.' : 'Could not reach NextChapter. Try again in a moment.')
      return
    }
    const values = M.valuesFromProfile(p.data)
    const filled = []
    let resume = false
    for (const el of document.querySelectorAll('input, textarea')) {
      if (!el.offsetParent && el.type !== 'file') continue
      const key = M.classifyField(describe(el))
      if (!key) continue
      if (isPicker(el)) continue
      if (key === 'resume' && el.type === 'file') {
        if (p.data.hasResume && (await attachResume(el))) { resume = true; el.style.outline = '2px solid #c2410c' }
        continue
      }
      if (el.type === 'file' || !values[key] || el.value) continue
      setValue(el, values[key])
      filled.push(key)
    }
    button.disabled = false
    const n = filled.length + (resume ? 1 : 0)
    say(n ? 'Filled ' + n + ' item' + (n === 1 ? '' : 's') + ' (outlined in orange). Check every answer, answer the rest yourself, then press Submit.' : 'Nothing new to fill here. Everything we know is already in, or this form asks other questions.')
    track('apply_helper_filled', { fields: filled.length, resume, work_history_used: !!values.current_company })
  }

  // ── Logging the application ──────────────────────────────────────────────
  const PENDING = 'ncPending'
  function jobTitle() {
    const og = document.querySelector('meta[property="og:title"]')
    const h1 = document.querySelector('h1')
    return ((h1 && h1.innerText) || (og && og.content) || document.title || '').trim().slice(0, 200)
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button, input[type=submit]')
    if (!b || !b.closest('form')) return
    const label = (b.innerText || b.value || '').toLowerCase()
    if (b.type !== 'submit' && !/submit|apply/.test(label)) return
    chrome.storage.local.set({ [PENDING]: { url: M.canonicalJobUrl(location.href), title: jobTitle(), company: M.companyFromUrl(location.href), at: Date.now() } })
  }, true)

  let logged = false
  async function checkConfirmation() {
    if (logged) return
    if (!M.isConfirmation(site, location.href, document.body && document.body.innerText)) return
    const s = await chrome.storage.local.get(PENDING)
    const pend = s[PENDING]
    if (!pend || Date.now() - pend.at > 30 * 60 * 1000) return
    logged = true
    await chrome.storage.local.remove(PENDING)
    const r = await send({ type: 'api', path: 'log', method: 'POST', body: { url: pend.url, title: pend.title, company: pend.company, site } })
    if (panel) say(r.ok ? 'Logged in My jobs on NextChapter.' : 'We could not log this one. Add it in My jobs yourself.')
  }

  async function start() {
    const cfg = await send({ type: 'settings' })
    if (cfg.enabled === false) return
    if (document.querySelector('form input, form textarea')) {
      mountPanel()
      say(cfg.code ? 'Fills your name, contact details, current job and resume. You review and submit.' : 'Not connected yet. Click the puzzle-piece icon, open Apply Helper and paste your connect code.')
      track('apply_helper_page_seen', { connected: !!cfg.code })
    }
    setInterval(checkConfirmation, 1500)
    checkConfirmation()
  }
  start()
})()
