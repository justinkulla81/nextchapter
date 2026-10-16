// The school form shared by onboarding and the early-career page. Pure and client-safe.

import type { EducationInput } from './data-types'

/** Degree buttons (four, so adjacent buttons per the design principles). */
export const DEGREE_CHOICES = ["Associate", "Bachelor's", "Master's", 'Other'] as const

export function parseEducationForm(formData: FormData): { value?: EducationInput; error?: string } {
  const schoolName = String(formData.get('schoolName') ?? '').trim()
  const degreeRaw = String(formData.get('degree') ?? '').trim()
  const fieldOfStudy = String(formData.get('fieldOfStudy') ?? '').trim() || null
  const yearRaw = String(formData.get('graduationYear') ?? '').trim()
  if (!schoolName) return { error: 'Enter your school’s name.' }
  const graduationYear = yearRaw ? Number(yearRaw) : null
  const thisYear = new Date().getUTCFullYear()
  if (graduationYear !== null && (!Number.isInteger(graduationYear) || graduationYear < 1960 || graduationYear > thisYear + 6)) {
    return { error: `Enter your graduation year as four digits, between 1960 and ${thisYear + 6}.` }
  }
  const degree = (DEGREE_CHOICES as readonly string[]).includes(degreeRaw) ? (degreeRaw === 'Other' ? null : degreeRaw) : null
  return { value: { schoolName, degree, fieldOfStudy, graduationYear } }
}
