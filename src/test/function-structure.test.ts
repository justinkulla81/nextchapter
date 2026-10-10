import { describe, it, expect } from 'vitest'
import { inferFunctionFromTitle as fn } from '@/lib/jobs/infer-job-function'

// The structural pass: titles the keyword list missed because it knows "sales director"
// but not "Director of Sales". It runs only when the keyword pass found nothing.

describe('leadership phrasing the keyword list missed', () => {
  it.each([
    ['Head of Sales', 'Sales'],
    ['Director of Sales', 'Sales'],
    ['Vice President of Sales', 'Sales'],
    ['Head of Product', 'Product'],
    ['Director of Product Management', 'Product'],
    ['Head of People', 'Human Resources'],
    ['VP of People', 'Human Resources'],
    ['Tax Manager', 'Finance'],
    ['Internal Audit Manager', 'Finance'],
    ['Operations Manager', 'Operations'],
    ['Director of Operations', 'Operations'],
    ['Project Manager', 'Operations'],
    ['Program Manager', 'Operations'],
    ['Plant Manager', 'Operations'],
    ['Chief of Staff', 'Executive Leadership'],
    ['Head of Data', 'Data & Analytics'],
    ['Vice President of Information Technology', 'Engineering'],
    ['Regulatory Affairs Manager', 'Legal'],
    ['Customer Experience Manager', 'Customer Success'],
    ['Head of Communications', 'Marketing'],
  ])('%s -> %s', (title, expected) => {
    expect(fn(title)).toBe(expected)
  })
})

describe('words that mean something else are not read as the function', () => {
  it('leaves non-corporate and look-alike roles unclassified', () => {
    for (const t of ['Facilities Operations Manager', 'Nurse Case Manager', 'Dean', 'Assistant Deli Manager', 'Warehouse Operations Manager', 'Store Manager']) {
      expect(fn(t), t).toBeNull()
    }
  })
  it('does not call construction or data-centre work sales or data', () => {
    expect(fn('Commercial Construction Project Manager')).not.toBe('Sales')
    expect(fn('Senior Project Manager - Data Centre Construction')).not.toBe('Data & Analytics')
    expect(fn('MEP Construction Project Manager Data Center')).not.toBe('Data & Analytics')
  })
  it('does not call engineering or construction design the Design function', () => {
    for (const t of ['Electrical Design Lead', 'Network Design Manager', 'Workplace Design & Construction Project Manager']) {
      expect(fn(t), t).not.toBe('Design')
    }
  })
  it('does not read community development as marketing, or workers comp as HR', () => {
    expect(fn('Community Development Director')).not.toBe('Marketing')
    expect(fn('Workers Compensation Team Lead')).not.toBe('Human Resources')
  })
})

describe('what the keyword pass already classified is untouched', () => {
  it('keeps the existing, more specific answers', () => {
    expect(fn('Software Engineer')).toBe('Engineering')
    expect(fn('Sales Director')).toBe('Sales')
    expect(fn('Chief Financial Officer')).toBe('Executive Leadership')
    expect(fn('Finance Systems Engineer')).toBe('Engineering')
    expect(fn('Product Manager')).toBe('Product')
  })
})
