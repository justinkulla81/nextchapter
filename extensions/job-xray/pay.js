// Pay: read a posted figure and compare it with the median for the title. The posted figure stays in the browser;
// only the median (from NextChapter) comes in.
(function (root) {
  var HOURS_PER_YEAR = 2080

  function toNumber(s, k) {
    var n = parseFloat(String(s).replace(/,/g, ''))
    return k ? n * 1000 : n
  }

  /** Annual USD { min, max } from posting text like "$120,000 - $150,000 a year" or "$45 - $60 an hour", or null. */
  function parsePayText(text) {
    if (!text) return null
    var unitRe = '(?:\\s*(?:\\/|per|a|an)\\s*(yr|year|annual|hr|hour|month|mo)\\b)?'
    var re = new RegExp('\\$\\s*([\\d,]+(?:\\.\\d+)?)\\s*(k)?' + unitRe + '(?:\\s*(?:-|–|—|to)\\s*\\$?\\s*([\\d,]+(?:\\.\\d+)?)\\s*(k)?' + unitRe + ')?', 'i')
    var m = re.exec(text)
    if (!m) return null
    var a = toNumber(m[1], m[2])
    var b = m[4] ? toNumber(m[4], m[5] || m[2]) : a
    var unit = (m[3] || m[6] || '').toLowerCase()
    var perYear = unit.indexOf('hr') === 0 || unit === 'hour' ? HOURS_PER_YEAR : unit.indexOf('mo') === 0 ? 12 : 1
    if (!unit) perYear = a < 1000 ? HOURS_PER_YEAR : 1
    var min = Math.round(a * perYear)
    var max = Math.round(b * perYear)
    return min > 0 && max >= min ? { min: min, max: max } : null
  }

  function fromJson(j) {
    if (!j || !j.min) return null
    var f = { HOUR: HOURS_PER_YEAR, MONTH: 12, YEAR: 1 }[j.unit] || 1
    var min = Math.round(j.min * f)
    var max = Math.round((j.max || j.min) * f)
    return min > 0 && max >= min ? { min: min, max: max } : null
  }

  /** Prefer the structured figure, then the page text. */
  function postedPay(payJson, payText) {
    return fromJson(payJson) || parsePayText(payText)
  }

  /** Where the midpoint of the posted range sits against the median: within 10% counts as "about the median". */
  function compareToMedian(pay, median) {
    if (!pay || !median) return null
    var mid = (pay.min + pay.max) / 2
    var pct = Math.round(((mid - median) / median) * 100)
    var where = Math.abs(pct) <= 10 ? 'near' : pct > 0 ? 'above' : 'below'
    return { where: where, pct: pct, mid: Math.round(mid) }
  }

  var api = { parsePayText: parsePayText, postedPay: postedPay, compareToMedian: compareToMedian }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.XrayPay = api
})(typeof self !== 'undefined' ? self : this)
