// Roster and gift CSVs from a college's CRM (spec §9). Pure: parsing and
// per-row validation only, so it's unit-tested and the importer can report
// every bad row by number instead of failing the whole file.

import { createHash } from 'crypto'
import type { InstitutionAffiliation } from '@prisma/client'
import { parseCsv } from '@/lib/warn/csv'

export type RowError = { row: number; column?: string; message: string }

export type RosterRow = {
  row: number
  externalId: string
  email: string
  firstName: string
  lastName: string
  affiliation: InstitutionAffiliation
  classYear: number | null
  degree: string | null
  major: string | null
  employer: string | null
  title: string | null
  doNotContact: boolean
}

export type GiftRow = {
  externalId: string
  giftDate: Date
  amountCents: number
  fund: string | null
  appeal: string | null
  dedupeKey: string
}

const ROSTER_REQUIRED = ['external_id', 'email', 'first_name', 'last_name', 'affiliation'] as const
const GIFT_REQUIRED = ['external_id', 'gift_date', 'amount'] as const
const AFFILIATIONS: InstitutionAffiliation[] = ['ALUM', 'STUDENT', 'PARENT', 'STAFF_ALUM']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function table(text: string): { header: string[]; rows: string[][] } {
  const all = parseCsv(text.replace(/^﻿/, '')).filter((r) => r.some((c) => c.trim() !== ''))
  const header = (all[0] ?? []).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return { header, rows: all.slice(1) }
}

function missingColumns(header: string[], required: readonly string[]): string[] {
  return required.filter((c) => !header.includes(c))
}

const truthy = (v: string) => ['true', 'yes', 'y', '1'].includes(v.trim().toLowerCase())

export function parseRoster(text: string, now = new Date()): { rows: RosterRow[]; errors: RowError[]; fileError?: string } {
  const { header, rows } = table(text)
  const missing = missingColumns(header, ROSTER_REQUIRED)
  if (missing.length) return { rows: [], errors: [], fileError: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}` }
  return parseRosterRecords(
    rows.map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']))),
    now,
    2, // 1-based, after the header, as a spreadsheet shows it
  )
}

// The same checks for records that arrive as JSON (the census API): keys
// are the CSV column names.
export function parseRosterRecords(records: Record<string, unknown>[], now = new Date(), firstRow = 1): { rows: RosterRow[]; errors: RowError[] } {
  const out: RosterRow[] = []
  const errors: RowError[] = []
  const seen = new Set<string>()
  records.forEach((rec, i) => {
    const row = i + firstRow
    const get = (col: string) => {
      const v = rec[col]
      return v === null || v === undefined ? '' : String(v).trim()
    }
    const externalId = get('external_id')
    const email = get('email').toLowerCase()
    const affiliation = get('affiliation').toUpperCase().replace(/\s+/g, '_') as InstitutionAffiliation
    const classYearRaw = get('class_year')
    const classYear = classYearRaw ? Number(classYearRaw) : null

    if (!externalId) return errors.push({ row, column: 'external_id', message: 'External id is empty.' })
    if (seen.has(externalId)) return errors.push({ row, column: 'external_id', message: `External id ${externalId} appears twice in this file.` })
    if (!EMAIL.test(email)) return errors.push({ row, column: 'email', message: `"${get('email')}" isn't an email address.` })
    if (!get('first_name') || !get('last_name')) return errors.push({ row, column: 'first_name', message: 'First and last name are required.' })
    if (!AFFILIATIONS.includes(affiliation)) {
      return errors.push({ row, column: 'affiliation', message: `Affiliation must be one of ${AFFILIATIONS.join(', ')}.` })
    }
    if (classYear !== null && (!Number.isInteger(classYear) || classYear < 1900 || classYear > now.getUTCFullYear() + 6)) {
      return errors.push({ row, column: 'class_year', message: `"${classYearRaw}" isn't a class year.` })
    }
    seen.add(externalId)
    out.push({
      row,
      externalId,
      email,
      firstName: get('first_name'),
      lastName: get('last_name'),
      affiliation,
      classYear,
      degree: get('degree') || null,
      major: get('major') || null,
      employer: get('employer') || null,
      title: get('title') || null,
      doNotContact: truthy(get('do_not_contact')),
    })
  })
  return { rows: out, errors }
}

// Learners for a cohort (workforce and exec-ed programs): people who aren't
// alumni. email, first_name, last_name required; payer and employer optional.
export type LearnerRow = { row: number; email: string; firstName: string; lastName: string; payer: string | null; employer: string | null }

export function parseLearners(text: string): { rows: LearnerRow[]; errors: RowError[]; fileError?: string } {
  const { header, rows } = table(text)
  const missing = missingColumns(header, ['email', 'first_name', 'last_name'])
  if (missing.length) return { rows: [], errors: [], fileError: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}` }
  const out: LearnerRow[] = []
  const errors: RowError[] = []
  const seen = new Set<string>()
  rows.forEach((cells, i) => {
    const row = i + 2
    const get = (col: string) => (header.includes(col) ? (cells[header.indexOf(col)] ?? '').trim() : '')
    const email = get('email').toLowerCase()
    if (!EMAIL.test(email)) return errors.push({ row, column: 'email', message: `"${get('email')}" isn't an email address.` })
    if (seen.has(email)) return errors.push({ row, column: 'email', message: `${email} appears twice in this file.` })
    if (!get('first_name') || !get('last_name')) return errors.push({ row, column: 'first_name', message: 'First and last name are required.' })
    seen.add(email)
    out.push({ row, email, firstName: get('first_name'), lastName: get('last_name'), payer: get('payer').toUpperCase().replace(/\s+/g, '_') || null, employer: get('employer') || null })
  })
  if (out.length + errors.length > 2000) return { rows: [], errors: [], fileError: '2,000 rows at most. Split the file.' }
  return { rows: out, errors }
}

// Gift files have no gift id, so the dedupe key (constituent, date, amount,
// fund, appeal) is what makes a re-import of the same file add nothing.
export function giftDedupeKey(g: { externalId: string; giftDate: Date; amountCents: number; fund: string | null; appeal: string | null }): string {
  return createHash('sha256')
    .update([g.externalId, g.giftDate.toISOString().slice(0, 10), g.amountCents, g.fund ?? '', g.appeal ?? ''].join('|'))
    .digest('hex')
}

export function parseGifts(text: string): { rows: GiftRow[]; errors: RowError[]; fileError?: string } {
  const { header, rows } = table(text)
  const missing = missingColumns(header, GIFT_REQUIRED)
  if (missing.length) return { rows: [], errors: [], fileError: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}` }

  const out: GiftRow[] = []
  const errors: RowError[] = []
  rows.forEach((cells, i) => {
    const row = i + 2
    const get = (col: string) => (cells[header.indexOf(col)] ?? '').trim()
    const externalId = get('external_id')
    const dateRaw = get('gift_date')
    const giftDate = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? new Date(`${dateRaw}T00:00:00Z`) : null
    const amount = Number(get('amount').replace(/[$,]/g, ''))

    if (!externalId) return errors.push({ row, column: 'external_id', message: 'External id is empty.' })
    if (!giftDate || Number.isNaN(giftDate.getTime())) return errors.push({ row, column: 'gift_date', message: `"${dateRaw}" isn't a date like 2026-11-03.` })
    if (!Number.isFinite(amount) || amount <= 0) return errors.push({ row, column: 'amount', message: `"${get('amount')}" isn't a gift amount.` })
    const base = { externalId, giftDate, amountCents: Math.round(amount * 100), fund: get('fund') || null, appeal: get('appeal') || null }
    out.push({ ...base, dedupeKey: giftDedupeKey(base) })
  })
  return { rows: out, errors }
}
