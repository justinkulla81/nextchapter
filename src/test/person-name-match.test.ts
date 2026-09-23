import { describe, it, expect } from 'vitest'
import { namesLookAlike } from '@/lib/text/person-name-match'

describe('namesLookAlike', () => {
  const same: [string, string][] = [
    ['Jon Smith', 'Jonathan A. Smith, MBA'],
    ['Marianne Voss, Esq.', 'Marianne Voss'],
    ['Bob Jones', 'Robert Jones'],
    ['Niko Bonatsos', 'Nicholas Bonatsos'],
    ['Kerry McKittrick', 'Kerry Mckitrick'],
    ['José García', 'Jose Garcia'],
    ['Robert (Bob) Smith', 'Bob Smith'],
  ]
  const different: [string, string][] = [
    ['John Smith', 'Jane Smith'],
    ['Daniel Elsener', 'Daniel Jones'],
    ['Mariana Dahan', 'Marianna Rossell'],
    ['Sam Lee', 'Sam'],
  ]
  for (const [a, b] of same) it(`${a} ≈ ${b}`, () => expect(namesLookAlike(a, b)).toBe(true))
  for (const [a, b] of different) it(`${a} ≠ ${b}`, () => expect(namesLookAlike(a, b)).toBe(false))
})
