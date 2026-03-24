import { describe, it, expect } from 'vitest'
import { getTeamRollup } from '../../../../shared/server/roster.js'

describe('getTeamRollup', () => {
  it('collects unique values of a field across people', () => {
    const people = [
      { engineeringLead: 'Alice' },
      { engineeringLead: 'Bob' },
      { engineeringLead: 'Alice' },
    ]
    expect(getTeamRollup(people, 'engineeringLead')).toEqual(['Alice', 'Bob'])
  })

  it('returns empty array when no one has the field', () => {
    const people = [{ name: 'Joe' }, { name: 'Jane' }]
    expect(getTeamRollup(people, 'engineeringLead')).toEqual([])
  })

  it('skips empty and null values', () => {
    const people = [
      { productManager: '' },
      { productManager: null },
      { productManager: 'Alice' },
    ]
    expect(getTeamRollup(people, 'productManager')).toEqual(['Alice'])
  })

  it('splits comma-separated values', () => {
    const people = [
      { productManager: 'Alice, Bob' },
      { productManager: 'Carol' },
    ]
    expect(getTeamRollup(people, 'productManager')).toEqual(['Alice', 'Bob', 'Carol'])
  })

  it('falls back to customFields', () => {
    const people = [
      { customFields: { engineeringLead: 'Alice' } },
    ]
    expect(getTeamRollup(people, 'engineeringLead')).toEqual(['Alice'])
  })

  it('returns sorted results', () => {
    const people = [
      { engineeringLead: 'Charlie' },
      { engineeringLead: 'Alice' },
      { engineeringLead: 'Bob' },
    ]
    expect(getTeamRollup(people, 'engineeringLead')).toEqual(['Alice', 'Bob', 'Charlie'])
  })
})
