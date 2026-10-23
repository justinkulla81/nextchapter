#!/usr/bin/env node
// Checks the JobPosting JSON-LD on public job pages against Google's required and
// recommended fields (https://developers.google.com/search/docs/appearance/structured-data/job-posting).
// Usage: node scripts/seo/check-job-jsonld.mjs <page url> [<page url> ...]
// Exits 1 if any page is missing a required field or has an invalid value.

const EMPLOYMENT_TYPES = new Set(['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'TEMPORARY', 'INTERN', 'VOLUNTEER', 'PER_DIEM', 'OTHER'])
const UNITS = new Set(['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR'])
const isDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v))

function check(ld) {
  const errors = []
  const warnings = []
  if (ld['@type'] !== 'JobPosting') errors.push('@type is not JobPosting')
  if (!ld.title) errors.push('missing title')
  if (!ld.description || String(ld.description).length < 50) errors.push('missing/short description')
  if (!isDate(ld.datePosted)) errors.push('missing/invalid datePosted')
  if (!ld.hiringOrganization?.name) errors.push('missing hiringOrganization.name')
  const remote = ld.jobLocationType === 'TELECOMMUTE'
  if (remote) {
    if (!ld.applicantLocationRequirements?.name) errors.push('TELECOMMUTE without applicantLocationRequirements')
  } else {
    const a = ld.jobLocation?.address
    if (!a) errors.push('missing jobLocation.address')
    else {
      if (!a.addressCountry) errors.push('missing addressCountry')
      if (!a.addressRegion) warnings.push('no addressRegion')
      if (!a.addressLocality) warnings.push('no addressLocality')
    }
  }
  if (ld.validThrough === undefined) warnings.push('no validThrough')
  else if (!isDate(ld.validThrough)) errors.push('invalid validThrough')
  else if (Date.parse(ld.validThrough) < Date.now()) errors.push('validThrough is in the past')
  if (ld.employmentType !== undefined && !EMPLOYMENT_TYPES.has(ld.employmentType)) errors.push(`bad employmentType ${ld.employmentType}`)
  if (ld.baseSalary) {
    const v = ld.baseSalary.value ?? {}
    if (!ld.baseSalary.currency) errors.push('baseSalary without currency')
    if (!UNITS.has(v.unitText)) errors.push(`bad baseSalary unitText ${v.unitText}`)
    if (v.value === undefined && v.minValue === undefined) errors.push('baseSalary without a value')
  } else warnings.push('no baseSalary')
  if (!ld.identifier?.value) warnings.push('no identifier')
  if (ld.directApply !== false && ld.directApply !== true) warnings.push('no directApply')
  return { errors, warnings }
}

let failed = false
for (const url of process.argv.slice(2)) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } })
  const html = await res.text()
  const robots = html.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? '(none)'
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
  const ld = blocks.find((b) => b['@type'] === 'JobPosting')
  if (!ld) {
    console.log(`FAIL ${url} — HTTP ${res.status}, robots ${robots}, no JobPosting JSON-LD`)
    failed = true
    continue
  }
  const { errors, warnings } = check(ld)
  if (errors.length) failed = true
  console.log(`${errors.length ? 'FAIL' : 'PASS'} ${url} — HTTP ${res.status}, robots ${robots}`)
  console.log(`     "${ld.title}" at ${ld.hiringOrganization?.name}; ${ld.jobLocationType ?? 'onsite'}; salary ${ld.baseSalary ? 'yes' : 'no'}; type ${ld.employmentType ?? '-'}`)
  for (const e of errors) console.log(`     error: ${e}`)
  for (const w of warnings) console.log(`     note: ${w}`)
}
process.exit(failed ? 1 : 0)
