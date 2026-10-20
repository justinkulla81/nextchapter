// The questions a member can answer in place, on the report, to sharpen it.
// Each writes to a field that already exists and that the rest of NextChapter
// already reads, so nothing is asked twice and nothing new needs a home. Pure:
// the whitelist and validation live here so they are tested.

import { PAY_FLOOR_BANDS, payFloorFromBand } from '@/lib/onboarding/pay-floor'
import { SEARCH_STALL_OPTIONS, parseSearchStallPoint } from '@/lib/onboarding/search-stall'

export type AnswerField = 'pay_floor' | 'search_stall' | 'linkedin_url'

export interface AnswerControl {
  kind: 'select' | 'url'
  label: string
  placeholder: string
  options?: { value: string; label: string }[]
  submit: string
}

export const ANSWER_CONTROLS: Record<AnswerField, AnswerControl> = {
  pay_floor: {
    kind: 'select',
    label: 'The least you would take',
    placeholder: 'Choose a range',
    options: PAY_FLOOR_BANDS.map((b) => ({ value: b.value, label: b.label })),
    submit: 'Save pay floor',
  },
  search_stall: {
    kind: 'select',
    label: 'Where your searches usually stall',
    placeholder: 'Choose one',
    options: SEARCH_STALL_OPTIONS,
    submit: 'Save answer',
  },
  linkedin_url: {
    kind: 'url',
    label: 'Your LinkedIn address',
    placeholder: 'https://www.linkedin.com/in/your-name',
    submit: 'Save LinkedIn',
  },
}

export const ANSWER_FIELDS = Object.keys(ANSWER_CONTROLS) as AnswerField[]

export type ParsedAnswer =
  | { ok: true; data: { targetCompMin?: number; searchStallPoint?: string; linkedInUrl?: string }; confirmLinkedIn?: boolean }
  | { ok: false; error: string }

export function parseAnswer(field: string, raw: unknown): ParsedAnswer {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!(ANSWER_FIELDS as string[]).includes(field)) return { ok: false, error: 'That question is not available here.' }
  if (!value) return { ok: false, error: 'Choose or enter an answer first. Nothing was saved.' }
  if (field === 'pay_floor') {
    const floor = payFloorFromBand(value)
    return floor ? { ok: true, data: { targetCompMin: floor } } : { ok: false, error: 'Choose one of the ranges. Nothing was saved.' }
  }
  if (field === 'search_stall') {
    const point = parseSearchStallPoint(value)
    return point ? { ok: true, data: { searchStallPoint: point } } : { ok: false, error: 'Choose one of the options. Nothing was saved.' }
  }
  // linkedin_url
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return { ok: false, error: 'That does not look like a LinkedIn address. Paste the link to your profile.' }
    return { ok: true, data: { linkedInUrl: url.toString().slice(0, 300) }, confirmLinkedIn: true }
  } catch {
    return { ok: false, error: 'That does not look like a web address. Paste the link to your LinkedIn profile.' }
  }
}
