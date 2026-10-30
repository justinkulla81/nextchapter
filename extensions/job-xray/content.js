// Draws the X-ray panel on a job page. Read-only: it reads the title, employer and pay already on screen, asks the
// background script for the NextChapter facts, and shows them in a small panel. It fills in nothing and clicks nothing.
(function () {
  var Sites = self.XraySites
  var Pay = self.XrayPay
  var site = Sites.siteFor(location)
  if (!site) return

  var host = null
  var shownKey = ''
  var timer = null

  var dom = {
    text: function (sel) {
      var el = document.querySelector(sel)
      return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''
    },
    jsonLd: function () {
      return Array.prototype.map.call(document.querySelectorAll('script[type="application/ld+json"]'), function (s) { return s.textContent || '' })
    },
  }

  var money = function (n) { return '$' + Math.round(n / 1000) + 'K' }
  var send = function (m) { try { chrome.runtime.sendMessage(m, function () { void chrome.runtime.lastError }) } catch (e) {} }
  var tagged = function (u) { return u + (u.indexOf('?') < 0 ? '?' : '&') + 'utm_source=job_xray&utm_medium=extension' }

  function row(label, body) {
    var d = document.createElement('div')
    d.className = 'row'
    var l = document.createElement('div')
    l.className = 'label'
    l.textContent = label
    var b = document.createElement('div')
    b.className = 'body'
    if (typeof body === 'string') b.textContent = body
    else b.appendChild(body)
    d.appendChild(l)
    d.appendChild(b)
    return d
  }

  function link(text, url, name, external) {
    var a = document.createElement('a')
    a.textContent = text
    a.href = external ? url : tagged(url)
    a.target = '_blank'
    a.rel = 'noopener'
    a.addEventListener('click', function () { send({ type: 'ping', event: 'xray_link_clicked', site: site, props: { link: name } }) })
    return a
  }

  function remove() {
    if (host) host.remove()
    host = null
  }

  function render(posting, data) {
    remove()
    host = document.createElement('div')
    host.setAttribute('data-nextchapter-xray', '')
    var root = host.attachShadow({ mode: 'open' })
    var style = document.createElement('style')
    style.textContent =
      ':host{all:initial}.box{position:fixed;right:16px;bottom:16px;z-index:2147483000;width:300px;font:13px/1.4 -apple-system,system-ui,sans-serif;color:#1c1f26;background:#fff;border:1px solid #d6d9e0;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.18)}' +
      '.head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #eceef2;font-weight:600}' +
      '.head button{all:unset;cursor:pointer;color:#6b7280;padding:0 4px;font-size:16px}' +
      '.row{padding:8px 12px}.label{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;margin-bottom:2px}' +
      '.big{font-size:20px;font-weight:700}.muted{color:#6b7280;font-size:12px}a{color:#2456d6;text-decoration:none;display:block;margin-top:2px}a:hover{text-decoration:underline}' +
      '.warn{color:#b42318;font-weight:600}.foot{padding:8px 12px;border-top:1px solid #eceef2;font-size:11px;color:#6b7280}.min .row,.min .foot{display:none}' +
      '@media (prefers-color-scheme:dark){.box{background:#1b1e25;color:#e8eaee;border-color:#343843}.head,.foot{border-color:#2b2f39}a{color:#8ab4ff}.warn{color:#ff8a80}}'
    root.appendChild(style)
    var box = document.createElement('div')
    box.className = 'box'
    var head = document.createElement('div')
    head.className = 'head'
    var name = document.createElement('span')
    name.textContent = 'NextChapter job X-ray'
    var close = document.createElement('button')
    close.textContent = '×'
    close.setAttribute('aria-label', 'Close the X-ray panel')
    close.addEventListener('click', remove)
    var min = document.createElement('button')
    min.textContent = '–'
    min.setAttribute('aria-label', 'Collapse the X-ray panel')
    min.addEventListener('click', function () { box.classList.toggle('min') })
    var btns = document.createElement('span')
    btns.appendChild(min)
    btns.appendChild(close)
    head.appendChild(name)
    head.appendChild(btns)
    box.appendChild(head)

    var shown = { exposure: false, layoffs: true, pay: false }
    var occ = data && data.occupation
    if (occ) {
      shown.exposure = true
      var c = document.createElement('div')
      var big = document.createElement('div')
      big.className = 'big'
      big.textContent = occ.exposurePercent + '% of tasks'
      var sub = document.createElement('div')
      sub.className = 'muted'
      sub.textContent = occ.sentence + ' (Anthropic Economic Index, matched to ' + occ.title + ')'
      c.appendChild(big)
      c.appendChild(sub)
      c.appendChild(link('See the full AI job check', occ.url, 'ai_check'))
      box.appendChild(row('AI use in this job', c))
    } else {
      box.appendChild(row('AI use in this job', 'We could not match this title to a job we measure.'))
    }

    var lay = data && data.layoffs
    var lc = document.createElement('div')
    if (lay) {
      var parts = []
      if (lay.recentNotices) parts.push(lay.recentNotices + ' layoff notice' + (lay.recentNotices === 1 ? '' : 's') + ' filed in the last 12 months' + (lay.latest ? ' (latest ' + lay.latest + ')' : ''))
      if (lay.announcedRecently) parts.push('job cuts announced')
      var t = document.createElement('div')
      t.className = 'warn'
      t.textContent = lay.name + ': ' + parts.join('; ')
      lc.appendChild(t)
      lc.appendChild(link('See the filings', lay.url, 'layoffs'))
    } else {
      lc.textContent = posting.employer ? 'No WARN notices or announced cuts for ' + posting.employer + ' in our records for the last 12 months.' : 'Employer name not found on this page.'
      shown.layoffs = false
    }
    box.appendChild(row('Layoffs', lc))

    var pay = Pay.postedPay(posting.payJson, posting.payText)
    var cmp = pay && occ ? Pay.compareToMedian(pay, occ.medianWage) : null
    if (cmp) {
      shown.pay = true
      var word = cmp.where === 'near' ? 'about the median' : Math.abs(cmp.pct) + '% ' + cmp.where + ' the median'
      box.appendChild(row('Posted pay', money(pay.min) + (pay.max > pay.min ? '–' + money(pay.max) : '') + ' is ' + word + ' of ' + money(occ.medianWage) + ' for ' + occ.title.toLowerCase() + '.'))
    }

    var cs = data && data.careerSite
    if (cs) {
      var cc = document.createElement('div')
      cc.appendChild(link('This role on the employer’s career site', cs.url, 'career_site', true))
      cc.appendChild(link('Same job on NextChapter', cs.ncUrl, 'nc_job'))
      box.appendChild(row('Apply direct', cc))
    }

    var foot = document.createElement('div')
    foot.className = 'foot'
    foot.textContent = 'Only the job title and employer name are sent to NextChapter.'
    box.appendChild(foot)
    root.appendChild(box)
    document.documentElement.appendChild(host)
    send({ type: 'ping', event: 'xray_panel_shown', site: site, props: { exposure: shown.exposure, layoffs: shown.layoffs, pay: shown.pay } })
  }

  function check() {
    var posting = Sites.extract(site, dom)
    if (!posting) {
      shownKey = ''
      return remove()
    }
    var key = posting.title + '|' + posting.employer
    if (key === shownKey) return
    shownKey = key
    try {
      chrome.runtime.sendMessage({ type: 'lookup', title: posting.title, employer: posting.employer }, function (data) {
        void chrome.runtime.lastError
        if (shownKey !== key) return
        if (!data || data.error) return remove()
        render(posting, data)
      })
    } catch (e) {}
  }

  // These sites swap the job in place without a page load, so watch for changes and re-read, at most twice a second.
  new MutationObserver(function () {
    clearTimeout(timer)
    timer = setTimeout(check, 500)
  }).observe(document.body, { childList: true, subtree: true })
  check()
})()
