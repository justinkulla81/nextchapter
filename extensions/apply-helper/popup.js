const DEFAULT_SITE = 'https://launchyournextchapter.com'
const $ = (id) => document.getElementById(id)
const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, (x) => r(x || {})))

async function render() {
  const s = await chrome.storage.local.get(['code', 'site', 'enabled'])
  const site = (s.site || DEFAULT_SITE).replace(/\/+$/, '')
  $('getcode').href = site + '/dashboard/apply-helper'
  $('connect').hidden = !!s.code
  $('connected').hidden = !s.code
  $('enabled').checked = s.enabled !== false
}

$('save').onclick = async () => {
  const code = $('code').value.trim()
  if (!code) { $('msg').textContent = 'Paste the code first.'; return }
  await chrome.storage.local.set({ code })
  const r = await send({ type: 'api', path: 'event', method: 'POST', body: { event: 'apply_helper_connected', site: 'popup' } })
  if (!r.ok) {
    await chrome.storage.local.remove('code')
    $('msg').textContent = r.error === 'expired' ? 'That code did not work or has expired. Get a fresh one.' : 'Could not reach NextChapter.'
  } else $('msg').textContent = ''
  $('code').value = ''
  render()
}

$('enabled').onchange = async () => {
  const on = $('enabled').checked
  await chrome.storage.local.set({ enabled: on })
  send({ type: 'api', path: 'event', method: 'POST', body: { event: on ? 'apply_helper_turned_on' : 'apply_helper_turned_off', site: 'popup' } })
}

$('disconnect').onclick = async () => {
  await send({ type: 'api', path: 'event', method: 'POST', body: { event: 'apply_helper_disconnected', site: 'popup' } })
  await chrome.storage.local.remove('code')
  render()
}
render()
