// Minimal CSV parser for the bulk-enrollment upload — deliberately small
// (no dependency) since the only shape this needs to handle is two columns,
// `email` and `name`, with an optional header row. Handles quoted fields
// (so a name like "Doe, Jane" survives) and escaped quotes ("" inside a
// quoted field), which covers what a real HR person's export from Excel or
// Workday commonly produces — a full RFC 4180 implementation isn't needed
// beyond that.
export interface EnrollmentCsvRow {
  email: string
  name: string | null
  line: number
}

export interface EnrollmentCsvParseResult {
  rows: EnrollmentCsvRow[]
  errors: string[]
}

function parseLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields.map((f) => f.trim())
}

const MAX_ROWS = 500

export function parseEnrollmentCsv(text: string): EnrollmentCsvParseResult {
  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0)
  const rows: EnrollmentCsvRow[] = []
  const errors: string[] = []

  if (lines.length === 0) {
    return { rows, errors: ['The file is empty.'] }
  }
  if (lines.length - 1 > MAX_ROWS) {
    errors.push(`This file has more than ${MAX_ROWS} rows — split it into smaller batches.`)
    return { rows, errors }
  }

  const first = parseLine(lines[0]).map((f) => f.toLowerCase())
  const hasHeader = first.includes('email')
  const emailCol = hasHeader ? first.indexOf('email') : 0
  const nameCol = hasHeader ? first.findIndex((f) => f === 'name' || f === 'full name' || f === 'fullname') : 1
  const dataLines = hasHeader ? lines.slice(1) : lines

  const seen = new Set<string>()
  dataLines.forEach((raw, idx) => {
    const lineNum = idx + (hasHeader ? 2 : 1)
    const fields = parseLine(raw)
    const email = (fields[emailCol] ?? '').trim().toLowerCase()
    const name = nameCol >= 0 ? (fields[nameCol] ?? '').trim() || null : null

    if (!email || !email.includes('@') || !email.includes('.')) {
      errors.push(`Row ${lineNum}: "${fields[emailCol] ?? ''}" doesn't look like a valid email address.`)
      return
    }
    if (seen.has(email)) {
      errors.push(`Row ${lineNum}: ${email} appears more than once in this file — skipped the duplicate.`)
      return
    }
    seen.add(email)
    rows.push({ email, name, line: lineNum })
  })

  return { rows, errors }
}
