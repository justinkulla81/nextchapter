// Pure weighted-attempts math (Market Reality Redesign Part 1) — tested
// separately from computeWeightedAttempts's Prisma-calling wrapper, same
// separation scoreQaSubmission gets from combineCrucibleScores.
import { describe, it, expect } from 'vitest'
import { weightApplicationsAndNetworking, isPoorFitApplication, NETWORKING_WEIGHT } from '@/lib/scoring/market-reality/attempts'

describe('weightApplicationsAndNetworking', () => {
  it('excludes only applications with a confirmed poor-fit score', () => {
    // 80 (strong), 40 (poor), null (never analyzed, counts by default), 69 (poor, just under the 70 threshold)
    const result = weightApplicationsAndNetworking([80, 40, null, 69], 0)
    expect(result.rawApplications).toBe(4)
    expect(result.poorFitApplications).toBe(2)
    expect(result.qualityFilteredApplications).toBe(2)
    expect(result.weightedAttempts).toBe(2)
  })

  it('a fitScore exactly at the strong-fit threshold counts (not excluded)', () => {
    const result = weightApplicationsAndNetworking([70], 0)
    expect(result.poorFitApplications).toBe(0)
    expect(result.qualityFilteredApplications).toBe(1)
  })

  it('multiplies networking actions by NETWORKING_WEIGHT and combines into one pool', () => {
    const result = weightApplicationsAndNetworking([80, 90], 3)
    expect(result.qualityFilteredApplications).toBe(2)
    expect(result.networkingActions).toBe(3)
    expect(result.weightedAttempts).toBe(2 + 3 * NETWORKING_WEIGHT)
  })

  it('networking alone (no applications) still produces real weighted attempts — a flexible combined pool, not a rigid per-channel quota', () => {
    const result = weightApplicationsAndNetworking([], 5)
    expect(result.weightedAttempts).toBe(5 * NETWORKING_WEIGHT)
  })

  it('zero of everything is zero, not null/undefined', () => {
    const result = weightApplicationsAndNetworking([], 0)
    expect(result.weightedAttempts).toBe(0)
  })
})

describe('isPoorFitApplication', () => {
  it('null (never analyzed) is never treated as poor fit', () => {
    expect(isPoorFitApplication(null)).toBe(false)
  })
  it('a real score below the strong-fit threshold is poor fit', () => {
    expect(isPoorFitApplication(69)).toBe(true)
  })
  it('a real score at or above the strong-fit threshold is not poor fit', () => {
    expect(isPoorFitApplication(70)).toBe(false)
    expect(isPoorFitApplication(100)).toBe(false)
  })
})
