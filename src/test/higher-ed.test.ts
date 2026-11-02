import { describe, expect, it } from 'vitest'
import { isHigherEdName } from '@/lib/seo/higher-ed'

describe('higher-ed name rule', () => {
  it.each(['Iowa State University', 'Macalester College', 'Truckee Meadows Community College', 'Rensselaer Polytechnic Institute', 'University of Alaska Fairbanks'])('treats %s as higher ed', (n) => expect(isHigherEdName(n)).toBe(true))
  it.each(['University Hospitals', 'University of Kansas Health System', 'Columbia University Irving Medical Center', 'College Board', 'Fairbanks Capital', 'Google'])('keeps %s as an employer', (n) => expect(isHigherEdName(n)).toBe(false))
})
