// All calls to NextChapter go through here: a page on greenhouse.io cannot call our API
// directly (CORS), but the extension's own worker can, with the member's connect code.
const DEFAULT_SITE = 'https://launchyournextchapter.com'

async function settings() {
  const s = await chrome.storage.local.get(['code', 'site', 'enabled'])
  return { code: s.code || '', site: (s.site || DEFAULT_SITE).replace(/\/+$/, ''), enabled: s.enabled !== false }
}

function toBase64(buf) {
  let bin = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

async function call(msg) {
  const { code, site } = await settings()
  if (!code) return { ok: false, error: 'not_connected' }
  const res = await fetch(site + '/api/apply-helper/' + msg.path, {
    method: msg.method || 'GET',
    headers: { Authorization: 'Bearer ' + code, ...(msg.body ? { 'Content-Type': 'application/json' } : {}) },
    body: msg.body ? JSON.stringify(msg.body) : undefined,
  })
  if (res.status === 401) return { ok: false, error: 'expired' }
  if (!res.ok) return { ok: false, error: 'http_' + res.status }
  if (msg.binary) {
    return { ok: true, base64: toBase64(await res.arrayBuffer()), type: res.headers.get('content-type') || 'application/pdf', fileName: decodeURIComponent(res.headers.get('x-file-name') || 'resume.pdf') }
  }
  return { ok: true, data: await res.json() }
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg && msg.type === 'api') {
    call(msg).then(reply, () => reply({ ok: false, error: 'network' }))
    return true
  }
  if (msg && msg.type === 'settings') {
    settings().then(reply)
    return true
  }
  return false
})
