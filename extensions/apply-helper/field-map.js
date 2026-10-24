// Pure helpers for the Apply Helper: which form field is which, which site we are on, and
// whether a page is the "your application was received" screen. No DOM access here so the
// repo's tests (src/test/apply-helper-field-map.test.ts) can run it directly.
(function (root) {
  var HOSTS = {
    greenhouse: /(^|\.)greenhouse\.io$/i,
    ashby: /^jobs\.ashbyhq\.com$/i,
    lever: /^jobs\.lever\.co$/i,
  }

  function siteOf(url) {
    var u
    try { u = new URL(url) } catch (e) { return null }
    for (var k in HOSTS) if (HOSTS[k].test(u.hostname)) return k
    return null
  }

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[*_:()\u2713\u2731\uff0a]/g, ' ').replace(/\s+/g, ' ').trim()
  }

  // Ordered: the first rule that matches wins, so specific rules go before general ones.
  // A field we do not recognise is left alone. The helper never guesses.
  var RULES = [
    ['resume', /\b(resume|resum[eé]|cv|curriculum vitae)\b/],
    ['skip', /cover letter|\bwhy\b|how did you hear|salary|compensation|sponsor|authori[sz]ed|gender|race|ethnic|veteran|disabilit|pronoun|referr|\bessay\b|tell us|describe|additional information|anything else/],
    ['first_name', /\bfirst name\b|given name|^first$|fname|first_name/],
    ['last_name', /\blast name\b|family name|surname|^last$|lname|last_name/],
    ['preferred_name', /preferred (first )?name|nickname/],
    ['email', /e-?mail/],
    ['phone', /\bphone\b|mobile|\bcell\b|telephone/],
    ['linkedin', /linkedin/],
    ['current_company', /current (company|employer|organi[sz]ation)|most recent (company|employer)|^company$|^employer$/],
    ['current_title', /current (title|role|position|job title)|most recent (title|role)|^job title$/],
    ['location', /current location|\blocation\b|\bcity\b|where are you (based|located)|^address/],
    ['full_name', /^(full |legal )?name$|your name|full name|legal name/],
  ]

  // desc: { label, name, id, placeholder, ariaLabel, autocomplete, type }
  function classifyField(desc) {
    var type = norm(desc.type)
    if (type === 'submit' || type === 'button' || type === 'checkbox' || type === 'radio' || type === 'hidden' || type === 'password') return null
    var ac = norm(desc.autocomplete)
    var AC = { 'given-name': 'first_name', 'family-name': 'last_name', email: 'email', tel: 'phone', name: 'full_name', organization: 'current_company', 'organization-title': 'current_title' }
    if (AC[ac]) return AC[ac]
    if (type === 'file') return /\b(resume|resum[eé]|cv)\b/.test(norm([desc.label, desc.name, desc.id, desc.ariaLabel].join(' '))) && !/cover/.test(norm([desc.label, desc.name, desc.id].join(' '))) ? 'resume' : null
    if (type === 'email') return 'email'
    if (type === 'tel') return 'phone'
    // Visible label first (what the member sees), then machine names.
    var sources = [desc.label, desc.ariaLabel, desc.placeholder, desc.name, desc.id]
    for (var i = 0; i < sources.length; i++) {
      var text = norm(sources[i])
      if (!text) continue
      for (var j = 0; j < RULES.length; j++) {
        if (RULES[j][1].test(text)) return RULES[j][0] === 'skip' ? null : RULES[j][0]
      }
    }
    return null
  }

  // profile: what /api/apply-helper/profile returns.
  function valuesFromProfile(p) {
    var first = (p.firstName || '').trim()
    var last = (p.lastName || '').trim()
    var v = {
      first_name: first,
      last_name: last,
      preferred_name: first,
      full_name: [first, last].filter(Boolean).join(' '),
      email: p.email || '',
      phone: p.phone || '',
      location: p.location || '',
      current_company: p.currentCompany || '',
      current_title: p.currentTitle || '',
    }
    Object.keys(v).forEach(function (k) { if (!v[k]) delete v[k] })
    return v
  }

  var CONFIRMATION = {
    greenhouse: { path: /\/confirmation\b|\/thanks?\b/i, text: /thank you for applying|your application has been (submitted|received)|application (was )?(successfully )?submitted/i },
    lever: { path: /\/thanks\b/i, text: /application (was )?(successfully )?submitted|thanks for applying|thank you for applying/i },
    ashby: { path: /\/(thanks|confirmation)\b/i, text: /application (was )?(successfully )?submitted|thank you for (applying|your application)|your application has been (received|submitted)/i },
  }

  function isConfirmation(site, url, bodyText) {
    var c = CONFIRMATION[site]
    if (!c) return false
    var path = ''
    try { path = new URL(url).pathname } catch (e) {}
    return c.path.test(path) || c.text.test(String(bodyText || '').slice(0, 4000))
  }

  // Lever and Ashby carry the employer in the first path segment; Greenhouse boards do too
  // (boards.greenhouse.io/<company>/jobs/<id>, job-boards.greenhouse.io/<company>/jobs/<id>).
  function companyFromUrl(url) {
    var u
    try { u = new URL(url) } catch (e) { return '' }
    var seg = u.pathname.split('/').filter(Boolean)[0] || ''
    if (u.searchParams.get('for')) seg = u.searchParams.get('for')
    return seg.replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase() }).trim()
  }

  // The posting a member applied to, without tracking parameters or the /apply tail,
  // so the same job always logs as the same row.
  function canonicalJobUrl(url) {
    var u
    try { u = new URL(url) } catch (e) { return '' }
    var path = u.pathname.replace(/\/(apply|application|confirmation|thanks?)\/?$/i, '').replace(/\/+$/, '')
    var keep = u.hostname.indexOf('greenhouse.io') >= 0 && u.searchParams.get('gh_jid') ? '?gh_jid=' + u.searchParams.get('gh_jid') : ''
    return u.origin + path + keep
  }

  var api = { siteOf: siteOf, classifyField: classifyField, valuesFromProfile: valuesFromProfile, isConfirmation: isConfirmation, companyFromUrl: companyFromUrl, canonicalJobUrl: canonicalJobUrl }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.NCApplyMap = api
})(typeof self !== 'undefined' ? self : this)
