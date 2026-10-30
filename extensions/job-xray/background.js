// The only code that talks to the network. It sends the job title and employer name to NextChapter's public X-ray endpoint,
// and a site name plus link name for usage counts. Nothing else about the page leaves the browser.
var API = 'https://launchyournextchapter.com/api/xray'
var cache = new Map()
var recent = []
var MAX_PER_MINUTE = 20

function installId() {
  return chrome.storage.local.get('installId').then(function (r) {
    if (r.installId) return r.installId
    var id = crypto.randomUUID()
    return chrome.storage.local.set({ installId: id }).then(function () { return id })
  })
}

function lookup(title, employer) {
  var key = (title + '|' + employer).toLowerCase()
  if (cache.has(key)) return Promise.resolve(cache.get(key))
  var now = Date.now()
  recent = recent.filter(function (t) { return now - t < 60000 })
  if (recent.length >= MAX_PER_MINUTE) return Promise.resolve({ error: 'slow_down' })
  recent.push(now)
  var url = API + '/lookup?title=' + encodeURIComponent(title) + '&employer=' + encodeURIComponent(employer)
  return fetch(url, { credentials: 'omit' })
    .then(function (r) { return r.ok ? r.json() : { error: 'unavailable' } })
    .then(function (data) {
      if (!data.error) {
        if (cache.size > 100) cache.clear()
        cache.set(key, data)
      }
      return data
    })
    .catch(function () { return { error: 'unavailable' } })
}

function ping(event, site, props) {
  return installId().then(function (id) {
    return fetch(API + '/event', {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id, event: event, site: site, props: props || {} }),
    })
  }).catch(function () {})
}

chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
  if (!sender.tab || !msg) return false
  if (msg.type === 'lookup') {
    lookup(String(msg.title).slice(0, 120), String(msg.employer).slice(0, 120)).then(reply)
    return true
  }
  if (msg.type === 'ping') {
    ping(msg.event, msg.site, msg.props)
    return false
  }
  return false
})
