import 'server-only'
import { NextResponse } from 'next/server'
import { csvContentHeaders, rowsToCsv } from '@/lib/admin/csv-export'

// A CSV download for a partner portal. An empty export still returns a file with
// a note, so the person is never left with a blank page.
export function csvResponse(filename: string, rows: Record<string, unknown>[], emptyNote = 'Nothing to export yet.'): NextResponse {
  const body = rows.length ? rowsToCsv(rows) : `note\r\n${emptyNote}`
  return new NextResponse(body, { headers: csvContentHeaders(filename) })
}

export function datedName(base: string, now = new Date()): string {
  return `${base}-${now.toISOString().slice(0, 10)}.csv`
}
