// Everything that depends on how LinkedIn, Indeed and Google Jobs lay out their pages lives in this file. When a site changes,
// this is the only file to touch. Each site lists selectors in order of preference; if none match, the page's own schema.org
// JobPosting JSON-LD (when it has one) fills the gap. Nothing here reads beyond the page the person is already viewing.
//
// `dom` is a small adapter so the same code runs in the browser and in the tests:
//   dom.text(selector)  -> trimmed text of the first match, or ''
//   dom.jsonLd()        -> array of raw JSON-LD script texts
(function (root) {
  var SITES = {
    linkedin: {
      host: /(^|\.)linkedin\.com$/,
      path: /^\/jobs\//,
      title: ['.job-details-jobs-unified-top-card__job-title h1', '.job-details-jobs-unified-top-card__job-title', '.jobs-unified-top-card__job-title', 'h1.top-card-layout__title', 'h1.t-24', '.job-view-layout h1'],
      employer: ['.job-details-jobs-unified-top-card__company-name a', '.job-details-jobs-unified-top-card__company-name', '.jobs-unified-top-card__company-name a', 'a.topcard__org-name-link', '.topcard__flavor:first-child', '.job-details-jobs-unified-top-card__primary-description-container a'],
      pay: ['.job-details-jobs-unified-top-card__job-insight', '.job-details-fit-level-preferences', '.salary.compensation__salary', '.jobs-unified-top-card__job-insight'],
    },
    indeed: {
      host: /(^|\.)indeed\.com$/,
      path: /^\/(viewjob|jobs|m\/|q-|$)/,
      title: ['h1[data-testid="jobsearch-JobInfoHeader-title"]', 'h1.jobsearch-JobInfoHeader-title', '.jobsearch-JobInfoHeader-title', 'h1'],
      employer: ['[data-testid="inlineHeader-companyName"] a', '[data-testid="inlineHeader-companyName"]', '[data-testid="jobsearch-JobInfoHeader-companyNameLink"]', '.jobsearch-CompanyInfoContainer a', '[data-company-name="true"]'],
      pay: ['#salaryInfoAndJobType', '[data-testid="jobsearch-OtherJobDetailsContainer"]', '#jobDetailsSection', '[data-testid="salaryInfoAndJobType"]'],
    },
    google: {
      host: /(^|\.)google\.[a-z.]+$/,
      path: /^\/search/,
      // Google's job pane uses generated class names, so these lean on roles and stable attributes.
      title: ['[data-ved] h1', 'h1[role="heading"]', '[role="heading"][aria-level="1"]', '#gws-plugins-horizon-jobs__job_details_page h1', '.KLsYvd', '.LZAQDf'],
      employer: ['#gws-plugins-horizon-jobs__job_details_page .nJlQNd', '.nJlQNd', '.wHYlTd.MKCbgd', '.a3jPc'],
      pay: ['#gws-plugins-horizon-jobs__job_details_page .I2Cbhb', '.I2Cbhb', '.LL4CDc'],
    },
  }

  // Google Jobs is a pane inside the search page: only treat it as a job view when the jobs tab is open.
  function isGoogleJobs(loc) {
    var q = loc.search || ''
    return /[?&]udm=8(&|$)/.test(q) || /htl;jobs|htivrt=jobs/.test(q) || /[?&]ibp=htl/.test(q)
  }

  function siteFor(loc) {
    for (var name in SITES) {
      var s = SITES[name]
      if (!s.host.test(loc.hostname) || !s.path.test(loc.pathname)) continue
      if (name === 'google' && !isGoogleJobs(loc)) continue
      return name
    }
    return null
  }

  function firstText(dom, selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var t = dom.text(selectors[i])
      if (t) return t
    }
    return ''
  }

  function postingFromJsonLd(texts) {
    for (var i = 0; i < texts.length; i++) {
      var data
      try { data = JSON.parse(texts[i]) } catch (e) { continue }
      var nodes = Array.isArray(data) ? data : data && data['@graph'] ? data['@graph'] : [data]
      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j]
        if (!n || (n['@type'] !== 'JobPosting' && [].concat(n['@type'] || []).indexOf('JobPosting') < 0)) continue
        var org = n.hiringOrganization
        var salary = n.baseSalary && n.baseSalary.value
        return {
          title: typeof n.title === 'string' ? n.title : '',
          employer: org && typeof org === 'object' ? String(org.name || '') : typeof org === 'string' ? org : '',
          pay: salary && typeof salary === 'object' ? { min: Number(salary.minValue) || Number(salary.value) || null, max: Number(salary.maxValue) || Number(salary.value) || null, unit: String(salary.unitText || 'YEAR').toUpperCase() } : null,
        }
      }
    }
    return null
  }

  /** { site, title, employer, payText, payJson } for the page in view, or null when it is not a job page or has no title. */
  function extract(site, dom) {
    var cfg = SITES[site]
    if (!cfg) return null
    var ld = postingFromJsonLd(dom.jsonLd())
    var title = firstText(dom, cfg.title) || (ld && ld.title) || ''
    var employer = firstText(dom, cfg.employer) || (ld && ld.employer) || ''
    if (!title) return null
    return { site: site, title: title, employer: employer, payText: firstText(dom, cfg.pay), payJson: ld && ld.pay }
  }

  var api = { SITES: SITES, siteFor: siteFor, extract: extract, postingFromJsonLd: postingFromJsonLd }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.XraySites = api
})(typeof self !== 'undefined' ? self : this)
