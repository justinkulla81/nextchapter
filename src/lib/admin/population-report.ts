// Read-side helpers for /support/admin/(portal)/population — every
// function here reads ONLY from `PopulationSnapshot`, never a live table
// (Prompt 6: "Trends read snapshots, never live tables"). The write side
// lives in src/lib/analytics/population-metrics.ts, called only from the
// weekly cron and the page's manual "generate now" action.

import 'server-only'
import { prisma } from '@/lib/prisma'
import type { SegmentType, SegmentPopulationMetrics } from '@/lib/analytics/population-metrics'
import { suppressSmallCells, type MaybeSuppressed } from '@/lib/admin/cell-suppression'

export interface SnapshotRow {
  weekStartDate: Date
  segmentType: SegmentType
  segmentValue: string
  memberCount: number
  metrics: SegmentPopulationMetrics
  computedAt: Date
}

function toSnapshotRow(row: {
  weekStartDate: Date
  segmentType: string
  segmentValue: string
  memberCount: number
  metrics: unknown
  computedAt: Date
}): SnapshotRow {
  return {
    weekStartDate: row.weekStartDate,
    segmentType: row.segmentType as SegmentType,
    segmentValue: row.segmentValue,
    memberCount: row.memberCount,
    metrics: row.metrics as unknown as SegmentPopulationMetrics,
    computedAt: row.computedAt,
  }
}

/** Every distinct week that has a snapshot, newest first — powers the week picker. */
export async function listSnapshotWeeks(): Promise<Date[]> {
  const rows = await prisma.populationSnapshot.findMany({
    where: { segmentType: 'all', segmentValue: 'all' },
    select: { weekStartDate: true },
    orderBy: { weekStartDate: 'desc' },
  })
  return rows.map((r) => r.weekStartDate)
}

export async function getAllSegmentRow(weekStartDate: Date): Promise<SnapshotRow | null> {
  const row = await prisma.populationSnapshot.findUnique({
    where: { weekStartDate_segmentType_segmentValue: { weekStartDate, segmentType: 'all', segmentValue: 'all' } },
  })
  return row ? toSnapshotRow(row) : null
}

/** Every segmentValue row for one segmentType, one week — the raw material for a Composition breakdown table. */
export async function getSegmentTypeRows(weekStartDate: Date, segmentType: SegmentType): Promise<SnapshotRow[]> {
  const rows = await prisma.populationSnapshot.findMany({
    where: { weekStartDate, segmentType },
    orderBy: { memberCount: 'desc' },
  })
  return rows.map(toSnapshotRow)
}

/** Same, run through suppressSmallCells (Phase B, MIN_CELL_SIZE = 5) before it ever reaches a table or CSV — every segment breakdown in this report must call this, not getSegmentTypeRows directly, per Prompt 8. */
export async function getSuppressedSegmentTypeRows(
  weekStartDate: Date,
  segmentType: SegmentType
): Promise<MaybeSuppressed<SnapshotRow>[]> {
  const rows = await getSegmentTypeRows(weekStartDate, segmentType)
  return suppressSmallCells(
    rows,
    (r) => r.memberCount,
    (r) => r.segmentValue
  )
}

export const SEGMENT_TYPE_LABELS: Record<SegmentType, string> = {
  all: 'All members',
  seniority: 'Seniority band',
  function: 'Function',
  industry: 'Industry',
  metro: 'Metro',
  employment_status: 'Employment status / persona',
  usage_tier: 'Usage tier (derived)',
}
