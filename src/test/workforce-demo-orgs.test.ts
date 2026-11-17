import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { cityFromAddress, sourceKey } from '@/lib/workforce/demo-orgs'

describe('cityFromAddress', () => {
  it('reads the city before the state and zip', () => {
    expect(cityFromAddress('410 W Chestnut Street, Suite 200, Louisville, KY 40202')).toBe('Louisville')
    expect(cityFromAddress('22 Spiral Drive, Florence, KY 41042')).toBe('Florence')
    expect(cityFromAddress('1 Main St, Hazard, KY 41701-1234')).toBe('Hazard')
  })
  it('gives up on an address it cannot read rather than guessing', () => {
    expect(cityFromAddress(null)).toBeNull()
    expect(cityFromAddress('PO Box 12')).toBeNull()
    expect(cityFromAddress('Suite 200, 410 W Chestnut Street')).toBeNull()
  })
})

describe('sourceKey', () => {
  it('names the directory record a demo was built from', () => {
    expect(sourceKey('WORKFORCE_BOARD', 'KY-247')).toBe('WORKFORCE_BOARD:KY-247')
  })
})
