/**
 * Validation and SQL generation for competitor capability research files.
 *
 * File shape (data/competitor-matrix/*.json):
 *   { "competitor": "<ProductCompetitor.name>", "cells": [{ "capabilityKey", "status", "note?", "evidenceUrl", "checkedAt" }] }
 *
 * Rules: known capability keys; status YES | PARTIAL | NO | UNKNOWN; YES, PARTIAL and NO need an https evidenceUrl and a
 * checkedAt date (YYYY-MM-DD), because a fact about a competitor without a source and a date cannot be used. UNKNOWN is a
 * valid answer and needs neither. Nothing here runs SQL; it only returns text.
 */
import { createHash } from 'node:crypto'
import { CAPABILITIES, CAPABILITY_KEYS } from './capabilities'
import { isCellStatus, type CellStatus } from './capability-matrix'

export interface ImportCell { capabilityKey: string; status: CellStatus; note?: string; evidenceUrl?: string; checkedAt?: string }
export interface ImportFile { competitor: string; cells: ImportCell[] }
export interface ValidationResult { ok: boolean; errors: string[]; file?: ImportFile }

const DATE_RE = /^\d{4}-\d{2}-\d{2}/

export function validateImport(input: unknown, label = 'file', now: Date = new Date()): ValidationResult {
  const errors: string[] = []
  if (!input || typeof input !== 'object') return { ok: false, errors: [`${label}: not a JSON object`] }
  const o = input as Record<string, unknown>
  const competitor = typeof o.competitor === 'string' ? o.competitor.trim() : ''
  if (!competitor) errors.push(`${label}: "competitor" is required`)
  if (!Array.isArray(o.cells)) errors.push(`${label}: "cells" must be an array`)
  const cells: ImportCell[] = []
  const seen = new Set<string>()
  if (Array.isArray(o.cells)) {
    o.cells.forEach((raw, i) => {
      const where = `${label}: cells[${i}]`
      if (!raw || typeof raw !== 'object') { errors.push(`${where}: not an object`); return }
      const r = raw as Record<string, unknown>
      const key = typeof r.capabilityKey === 'string' ? r.capabilityKey : ''
      if (!CAPABILITY_KEYS.has(key)) { errors.push(`${where}: unknown capabilityKey "${key}"`); return }
      if (seen.has(key)) errors.push(`${where}: duplicate capabilityKey "${key}"`)
      seen.add(key)
      if (!isCellStatus(r.status)) { errors.push(`${where} (${key}): status must be YES, PARTIAL, NO or UNKNOWN`); return }
      const status = r.status
      const evidenceUrl = typeof r.evidenceUrl === 'string' ? r.evidenceUrl.trim() : ''
      const checkedAt = typeof r.checkedAt === 'string' ? r.checkedAt.trim() : ''
      const note = typeof r.note === 'string' ? r.note.trim() : ''
      if (status !== 'UNKNOWN') {
        if (!evidenceUrl) errors.push(`${where} (${key}): evidenceUrl is required for ${status}`)
        if (!checkedAt) errors.push(`${where} (${key}): checkedAt is required for ${status}`)
      }
      if (evidenceUrl) {
        let ok = false
        try { const u = new URL(evidenceUrl); ok = u.protocol === 'https:' && u.hostname.includes('.') } catch { ok = false }
        if (!ok) errors.push(`${where} (${key}): evidenceUrl must be an https URL`)
      }
      if (checkedAt) {
        const t = DATE_RE.test(checkedAt) ? Date.parse(checkedAt) : NaN
        if (Number.isNaN(t)) errors.push(`${where} (${key}): checkedAt must be a date like 2026-10-23`)
        else if (t > now.getTime() + 86_400_000) errors.push(`${where} (${key}): checkedAt is in the future`)
      }
      cells.push({ capabilityKey: key, status, ...(note ? { note } : {}), ...(evidenceUrl ? { evidenceUrl } : {}), ...(checkedAt ? { checkedAt } : {}) })
    })
  }
  return errors.length ? { ok: false, errors } : { ok: true, errors: [], file: { competitor, cells } }
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const tsOrNull = (d?: string) => (d ? `${q(d.slice(0, 10))}::timestamp` : 'NULL')

/** Upserts for the catalog rows, so a fresh database has the capabilities the cells point at. Idempotent. */
export function catalogSql(): string {
  const lines = ['-- ProductCapability rows from src/lib/vision/capabilities.ts']
  CAPABILITIES.forEach((c, i) => {
    lines.push(
      `INSERT INTO "ProductCapability" ("id","key","area","name","description","ours","evidencePath","sortOrder","updatedAt") VALUES (` +
      `${q('cap_' + c.key)},${q(c.key)},${q(c.area)},${q(c.name)},${q(c.description)},${q(c.ours)}::"ProductCapabilityStatus",${q(c.evidencePath)},${i},current_timestamp) ` +
      `ON CONFLICT ("key") DO UPDATE SET "area"=EXCLUDED."area","name"=EXCLUDED."name","description"=EXCLUDED."description","ours"=EXCLUDED."ours","evidencePath"=EXCLUDED."evidencePath","sortOrder"=EXCLUDED."sortOrder","updatedAt"=current_timestamp;`,
    )
  })
  return lines.join('\n')
}

/** Upserts for one validated file. Competitor and capability are looked up by name and key; a missing one inserts nothing. */
export function cellsSql(file: ImportFile, checkedBy = 'research-import'): string {
  const lines = [`-- ${file.competitor.replace(/[\r\n]/g, ' ')}: ${file.cells.length} cells`]
  for (const c of file.cells) {
    const id = 'cc_' + createHash('sha1').update(file.competitor + '|' + c.capabilityKey).digest('hex').slice(0, 24)
    lines.push(
      `INSERT INTO "CompetitorCapability" ("id","competitorId","capabilityId","status","note","evidenceUrl","checkedAt","checkedBy") ` +
      `SELECT ${q(id)}, pc."id", cap."id", ${q(c.status)}::"CompetitorCapabilityStatus", ` +
      `${c.note ? q(c.note) : 'NULL'}, ${c.evidenceUrl ? q(c.evidenceUrl) : 'NULL'}, ${tsOrNull(c.checkedAt)}, ${q(checkedBy)} ` +
      `FROM "ProductCompetitor" pc, "ProductCapability" cap WHERE pc."name" = ${q(file.competitor)} AND cap."key" = ${q(c.capabilityKey)} ` +
      `ON CONFLICT ("competitorId","capabilityId") DO UPDATE SET "status"=EXCLUDED."status","note"=EXCLUDED."note","evidenceUrl"=EXCLUDED."evidenceUrl","checkedAt"=EXCLUDED."checkedAt","checkedBy"=EXCLUDED."checkedBy";`,
    )
  }
  return lines.join('\n')
}
