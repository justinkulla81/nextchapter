import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The Review List's route filter must stay in step with what the warm-door
// rules treat as a rated route; otherwise a route could count as a way in
// without ever surfacing for review.
describe('routes to confirm', () => {
  const src = readFileSync(join(__dirname, '..', 'lib', 'crm', 'route-review.ts'), 'utf8')
  const rules = readFileSync(join(__dirname, '..', 'lib', 'crm', 'warm-doors-rules.ts'), 'utf8')

  it('reviews exactly the strengths the warm-door rules count', () => {
    expect(src).toMatch(/RATED[^=]*=\s*\['STRONG', 'MEDIUM'\]/)
    expect(rules).toMatch(/r\.strength !== 'STRONG' && r\.strength !== 'MEDIUM'/)
  })
  it('only picks routes nobody has asked about or confirmed', () => {
    expect(src).toMatch(/status:\s*'IDENTIFIED'/)
  })
  it('targets organizations, not people', () => {
    expect(src).toMatch(/targetOrgId:\s*\{\s*not:\s*null\s*\}/)
  })
})
