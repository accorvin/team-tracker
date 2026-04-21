import { describe, it, expect } from 'vitest'

const { splitByKnownNames, getTeamRollup } = require('../roster')

describe('splitByKnownNames', () => {
  const knownNames = new Set([
    'Yuan Tang',
    'Pierangelo Di Pilato',
    'Lindani Phiri',
    'Steven Grubb',
    'Adam Bellusci',
    'Naina Singh',
    'Jonathan Zarecki'
  ])

  it('returns a single known name unchanged', () => {
    expect(splitByKnownNames('Yuan Tang', knownNames)).toEqual(['Yuan Tang'])
  })

  it('splits two concatenated names', () => {
    expect(splitByKnownNames('Pierangelo Di Pilato Yuan Tang', knownNames))
      .toEqual(['Pierangelo Di Pilato', 'Yuan Tang'])
  })

  it('splits three concatenated names', () => {
    expect(splitByKnownNames('Adam Bellusci Naina Singh Jonathan Zarecki', knownNames))
      .toEqual(['Adam Bellusci', 'Naina Singh', 'Jonathan Zarecki'])
  })

  it('returns unknown names as-is', () => {
    expect(splitByKnownNames('Someone Unknown', knownNames))
      .toEqual(['Someone Unknown'])
  })

  it('returns original string when only partial match at start', () => {
    expect(splitByKnownNames('Yuan Tang Unknown Person', knownNames))
      .toEqual(['Yuan Tang Unknown Person'])
  })

  it('handles empty knownNames set', () => {
    expect(splitByKnownNames('Yuan Tang', new Set())).toEqual(['Yuan Tang'])
  })

  it('prefers longer name match (greedy longest-first)', () => {
    const names = new Set(['John', 'John Smith', 'Anna Brown'])
    expect(splitByKnownNames('John Smith Anna Brown', names))
      .toEqual(['John Smith', 'Anna Brown'])
  })

  it('handles extra whitespace between names', () => {
    expect(splitByKnownNames('Yuan Tang  Lindani Phiri', knownNames))
      .toEqual(['Yuan Tang', 'Lindani Phiri'])
  })
})

describe('getTeamRollup with knownNames', () => {
  const knownNames = new Set([
    'Yuan Tang',
    'Pierangelo Di Pilato',
    'Adam Bellusci',
    'Naina Singh'
  ])

  it('splits concatenated names when knownNames provided', () => {
    const people = [
      { name: 'Alice', engineeringLead: 'Pierangelo Di Pilato Yuan Tang' },
      { name: 'Bob', engineeringLead: 'Yuan Tang' }
    ]
    const result = getTeamRollup(people, 'engineeringLead', knownNames)
    expect(result).toEqual(['Pierangelo Di Pilato', 'Yuan Tang'])
  })

  it('handles mix of comma-separated and concatenated names', () => {
    const people = [
      { name: 'Alice', productManager: 'Adam Bellusci, Naina Singh' },
      { name: 'Bob', productManager: 'Adam Bellusci Naina Singh' }
    ]
    const result = getTeamRollup(people, 'productManager', knownNames)
    expect(result).toEqual(['Adam Bellusci', 'Naina Singh'])
  })

  it('works without knownNames (backward compatible)', () => {
    const people = [
      { name: 'Alice', engineeringLead: 'Pierangelo Di Pilato Yuan Tang' }
    ]
    const result = getTeamRollup(people, 'engineeringLead')
    expect(result).toEqual(['Pierangelo Di Pilato Yuan Tang'])
  })

  it('deduplicates across people', () => {
    const people = [
      { name: 'Alice', engineeringLead: 'Yuan Tang' },
      { name: 'Bob', engineeringLead: 'Yuan Tang' },
      { name: 'Carol', engineeringLead: 'Adam Bellusci Yuan Tang' }
    ]
    const result = getTeamRollup(people, 'engineeringLead', knownNames)
    expect(result).toEqual(['Adam Bellusci', 'Yuan Tang'])
  })

  it('returns sorted results', () => {
    const people = [
      { name: 'Alice', engineeringLead: 'Yuan Tang Adam Bellusci' }
    ]
    const result = getTeamRollup(people, 'engineeringLead', knownNames)
    expect(result).toEqual(['Adam Bellusci', 'Yuan Tang'])
  })

  it('skips empty and null values', () => {
    const people = [
      { name: 'Alice', engineeringLead: '' },
      { name: 'Bob', engineeringLead: null },
      { name: 'Carol' }
    ]
    const result = getTeamRollup(people, 'engineeringLead', knownNames)
    expect(result).toEqual([])
  })
})
