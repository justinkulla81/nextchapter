// CSV export — Phase 2 Master Script, Part B: "Every view exports CSV"
// (Prompt 4) is a blanket requirement across every admin analytics view.
// No precedent existed anywhere in the repo before this (only CSV *import*,
// for candidate networking contacts — nothing export-related in admin).
//
// Deliberately framework-agnostic: `rowsToCsv` is a pure string builder with
// no Next.js import, so it's usable from a route handler, a Server Action,
// or a script. `csvContentHeaders` supplies the response-header convention
// this repo already uses for a real streaming download —
// src/app/api/resume/export/route.ts sets `Content-Type` +
// `Content-Disposition: attachment; filename="..."` on a `NextResponse`
// built from a raw buffer; a CSV route handler does the same thing with a
// string body instead of a Buffer:
//
//   import { NextResponse } from 'next/server'
//   import { rowsToCsv, csvContentHeaders } from '@/lib/admin/csv-export'
//
//   const rows = await buildPrevalenceRows(filters)
//   return new NextResponse(rowsToCsv(rows), { headers: csvContentHeaders('issue-prevalence.csv') })

// RFC 4180-style field escaping: quote any field containing a comma, quote
// character, or newline, and double any embedded quote characters.
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''

  let str: string
  if (value instanceof Date) {
    str = value.toISOString()
  } else if (typeof value === 'string') {
    str = value
  } else if (typeof value === 'object') {
    str = JSON.stringify(value)
  } else {
    str = String(value)
  }

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// Converts an array of flat row objects into CSV text, header row first.
// The header set is the union of every key across every row (in first-seen
// order) — admin analytics rows are often built by mapping over
// differently-populated segments, so this avoids silently dropping a
// column that's only present on some rows. Rows missing a given key emit
// an empty field for it, same as a spreadsheet would.
export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''

  const headers: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        headers.push(key)
      }
    }
  }

  const lines = [headers.map(escapeCsvField).join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvField(row[h])).join(','))
  }
  // CRLF per RFC 4180 — also what most spreadsheet importers expect.
  return lines.join('\r\n')
}

// Response-header convention for triggering a browser download of CSV text
// — mirrors src/app/api/resume/export/route.ts's Content-Type /
// Content-Disposition pair (see file-header comment for the exact call
// site). `filename` should already include the `.csv` extension.
export function csvContentHeaders(filename: string): HeadersInit {
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  }
}
