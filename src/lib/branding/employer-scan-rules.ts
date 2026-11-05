// Which layoff employers are worth reading a website for. A notice's employer field is often a site, a plant, an address or a note
// ("Spirit Airlines MCO ... 10084 Air Tran Blvd", "Intel Corporation - SC-12", "*Updated* ..."), not a company. Pure: the daily scan and the tests share it.

const NOT_A_COMPANY = /\b(warn|layoff|school district|county|city of|state of|department|authority|facility|plant|campus|warehouse|distribution center|revised|update[d]?|exhibit|llc d\/b\/a|dba|d b a)\b/i

/** True when the name reads like one company (a short run of ordinary words), not a site, an address or a sentence. */
export function looksLikeCompanyName(name: string): boolean {
  const n = name.trim()
  if (n.length < 3 || n.length > 38) return false
  if (/\d{3,}/.test(n)) return false
  if (n.split(/\s+/).length > 5) return false
  if (/[*#@\n]/.test(n)) return false
  if (NOT_A_COMPANY.test(n)) return false
  return true
}
