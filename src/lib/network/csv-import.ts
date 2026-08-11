// Parses a LinkedIn "Connections.csv" export. LinkedIn prefixes the file
// with a few notice lines before the real header row, so this scans for
// the header rather than assuming line 1. No external CSV library —
// LinkedIn's export has no embedded newlines, so a small quoted-field-aware
// splitter is enough.

import { sanitizeContactName } from './sanitize-contact-name'

export interface ImportedContact {
  name: string
  company: string | null
  title: string | null
  email: string | null
  linkedinUrl: string | null
  connectedAt: Date | null
}

// LinkedIn's "Connected On" column is a plain "D Mon YYYY" date (e.g. "23
// Jan 2020"), not ISO — new Date() parses that fine in Node, but guard
// against a malformed/renamed-format cell rather than writing an Invalid
// Date into the DB.
function parseConnectedOn(raw: string | undefined): Date | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

// Lower-trimmed "name|company" dedup key — used both to stop re-uploading
// the same LinkedIn export from creating duplicate SupportNetworkContact
// rows (via createMany's skipDuplicates against the DB's unique index) and
// to identify genuinely-new contacts for the weekly NETWORKING_LIST Sprint
// credit.
export function normalizeContactKey(name: string, company: string | null): string {
  return `${name.trim().toLowerCase()}|${(company ?? '').trim().toLowerCase()}`
}

function splitCsvLine(line: string): string[] {
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
  return fields
}

export function parseLinkedInConnectionsCsv(csvText: string): ImportedContact[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const headerIndex = lines.findIndex((l) => l.includes('First Name') && l.includes('Last Name'))
  if (headerIndex === -1) return []

  const headers = splitCsvLine(lines[headerIndex]).map((h) => h.trim())
  const firstNameIdx = headers.indexOf('First Name')
  const lastNameIdx = headers.indexOf('Last Name')
  const emailIdx = headers.indexOf('Email Address')
  const companyIdx = headers.indexOf('Company')
  const positionIdx = headers.indexOf('Position')
  const urlIdx = headers.indexOf('URL')
  const connectedOnIdx = headers.indexOf('Connected On')

  const contacts: ImportedContact[] = []
  for (const line of lines.slice(headerIndex + 1)) {
    const fields = splitCsvLine(line)
    const firstName = fields[firstNameIdx]?.trim()
    const lastName = fields[lastNameIdx]?.trim()
    if (!firstName && !lastName) continue

    const name = sanitizeContactName([firstName, lastName].filter(Boolean).join(' '))
    if (!name) continue

    contacts.push({
      name,
      email: emailIdx >= 0 ? fields[emailIdx]?.trim() || null : null,
      company: companyIdx >= 0 ? fields[companyIdx]?.trim() || null : null,
      title: positionIdx >= 0 ? fields[positionIdx]?.trim() || null : null,
      linkedinUrl: urlIdx >= 0 ? fields[urlIdx]?.trim() || null : null,
      connectedAt: connectedOnIdx >= 0 ? parseConnectedOn(fields[connectedOnIdx]) : null,
    })
  }
  return contacts
}
