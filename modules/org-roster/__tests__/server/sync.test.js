import { describe, it, expect } from 'vitest'
import {
  parseTeamBoardsTab,
  parseComponentsTab,
  calculateHeadcountByRole,
} from '../../server/sync.js'

describe('parseTeamBoardsTab', () => {
  it('parses team rows correctly', () => {
    const headers = ['Organization', 'Scrum Team Name', 'JIRA Board', 'PM']
    const rows = [
      ['AI Platform', 'Dashboard', 'https://jira.example.com/board/1', 'Alice Smith'],
      ['AAET', 'Pipelines', 'https://jira.example.com/board/2', 'Bob Jones'],
    ]
    const teams = parseTeamBoardsTab(headers, rows)
    expect(teams).toHaveLength(2)
    expect(teams[0]).toEqual({
      org: 'AI Platform',
      name: 'Dashboard',
      boardUrls: ['https://jira.example.com/board/1'],
    })
    expect(teams[1].org).toBe('AAET')
  })

  it('returns empty for no headers', () => {
    expect(parseTeamBoardsTab([], [])).toEqual([])
    expect(parseTeamBoardsTab(null, [])).toEqual([])
  })

  it('skips rows without team name, carries forward org for merged cells', () => {
    const headers = ['Organization', 'Scrum Team Name']
    const rows = [
      ['AI Platform', ''],    // no team name — skipped, but sets lastOrg
      ['', 'Team A'],          // empty org — inherits 'AI Platform' from merged cell
      ['AI Platform', 'Team B'],
    ]
    const teams = parseTeamBoardsTab(headers, rows)
    expect(teams).toHaveLength(2)
    expect(teams[0].org).toBe('AI Platform')
    expect(teams[0].name).toBe('Team A')
    expect(teams[1].name).toBe('Team B')
  })

  it('handles multiple board URLs separated by newlines', () => {
    const headers = ['Organization', 'Scrum Team Name', 'JIRA Board', 'PM']
    const rows = [
      ['AI Platform', 'Multi', 'https://board1.com\nhttps://board2.com', 'PM1'],
    ]
    const teams = parseTeamBoardsTab(headers, rows)
    expect(teams[0].boardUrls).toEqual(['https://board1.com', 'https://board2.com'])
  })

  it('handles headers already trimmed by fetchRawSheet', () => {
    // fetchRawSheet trims headers before passing them in
    const headers = ['Organization', 'Scrum Team Name', 'JIRA Board']
    const rows = [
      ['AI Platform', 'Team A', ''],
    ]
    const teams = parseTeamBoardsTab(headers, rows)
    expect(teams).toHaveLength(1)
    expect(teams[0].name).toBe('Team A')
  })

  it('carries forward org for merged cells (empty org column)', () => {
    const headers = ['Organization', 'Scrum Team Name', 'JIRA Board']
    const rows = [
      ['AI Platform', 'Team A', ''],
      ['', 'Team B', ''],
      ['', 'Team C', ''],
      ['AAET', 'Team D', ''],
      ['', 'Team E', ''],
    ]
    const teams = parseTeamBoardsTab(headers, rows)
    expect(teams).toHaveLength(5)
    expect(teams[0].org).toBe('AI Platform')
    expect(teams[1].org).toBe('AI Platform')
    expect(teams[2].org).toBe('AI Platform')
    expect(teams[3].org).toBe('AAET')
    expect(teams[4].org).toBe('AAET')
  })
})

describe('parseComponentsTab', () => {
  it('parses real spreadsheet layout (org names in headers, labels in first row)', () => {
    // Real layout: header row has org names, first data row has Team/Component(s) labels
    const headers = ['AI Platform', '', 'AAET', '']
    const rows = [
      ['Team', 'Component(s)', 'Team', 'Component(s)'],  // label row
      ['Dashboard', 'AI Hub', 'Model Serving', 'KServe'],  // data
      ['Other Team', 'AI Hub', '', ''],
    ]
    const result = parseComponentsTab(headers, rows)
    expect(result['AI Hub']).toEqual(['Dashboard', 'Other Team'])
    expect(result['KServe']).toEqual(['Model Serving'])
  })

  it('handles multiple org sections side-by-side', () => {
    const headers = ['AI Platform', '', '', 'AAET', '', '', 'Inf Eng', '']
    const rows = [
      ['Team', 'Component(s)', '', 'Team', 'Component(s)', '', 'Team', 'Component(s)'],
      ['Dashboard', 'AI Hub', '', 'Serving', 'KServe', '', 'Infra', 'General'],
      ['Pipelines', 'DS Pipelines', '', '', '', '', '', ''],
    ]
    const result = parseComponentsTab(headers, rows)
    expect(result['AI Hub']).toEqual(['Dashboard'])
    expect(result['KServe']).toEqual(['Serving'])
    expect(result['DS Pipelines']).toEqual(['Pipelines'])
    expect(result['General']).toEqual(['Infra'])
  })

  it('handles comma-separated components', () => {
    const headers = ['AI Platform', '']
    const rows = [
      ['Team', 'Component(s)'],
      ['Dashboard', 'AI Hub, AI Core Dashboard'],
    ]
    const result = parseComponentsTab(headers, rows)
    expect(result['AI Hub']).toEqual(['Dashboard'])
    expect(result['AI Core Dashboard']).toEqual(['Dashboard'])
  })

  it('returns empty for no headers', () => {
    expect(parseComponentsTab([], [])).toEqual({})
    expect(parseComponentsTab(null, [])).toEqual({})
  })

  it('deduplicates team names for same component', () => {
    const headers = ['AI Platform', '']
    const rows = [
      ['Team', 'Component(s)'],
      ['Dashboard', 'AI Hub'],
      ['Dashboard', 'AI Hub'],
    ]
    const result = parseComponentsTab(headers, rows)
    expect(result['AI Hub']).toEqual(['Dashboard'])
  })

  it('falls back to headers-as-labels if no label row detected', () => {
    // Fallback: if headers themselves contain Team/Component labels
    const headers = ['Team', 'Component(s)']
    const rows = [
      ['Dashboard', 'AI Hub'],
      ['Serving', 'KServe'],
    ]
    const result = parseComponentsTab(headers, rows)
    expect(result['AI Hub']).toEqual(['Dashboard'])
    expect(result['KServe']).toEqual(['Serving'])
  })
})

describe('calculateHeadcountByRole', () => {
  it('calculates headcount and FTE correctly', () => {
    const people = [
      { specialty: 'BFF', miroTeam: 'Dashboard' },
      { specialty: 'BFF', miroTeam: 'Dashboard' },
      { specialty: 'QE', miroTeam: 'Dashboard, Model Serving' },
    ]
    const result = calculateHeadcountByRole(people)
    expect(result.byRole).toEqual({ BFF: 2, QE: 1 })
    expect(result.byRoleFte.BFF).toBe(2)
    expect(result.byRoleFte.QE).toBe(0.5) // split across 2 teams
    expect(result.totalHeadcount).toBe(3)
    expect(result.totalFte).toBe(2.5)
  })

  it('uses Unspecified for null specialty', () => {
    const people = [{ specialty: null, miroTeam: 'Team' }]
    const result = calculateHeadcountByRole(people)
    expect(result.byRole).toEqual({ Unspecified: 1 })
  })

  it('handles empty miroTeam as 1 FTE', () => {
    const people = [{ specialty: 'Dev', miroTeam: '' }]
    const result = calculateHeadcountByRole(people)
    expect(result.byRoleFte.Dev).toBe(1)
  })

  it('reads engineeringSpeciality field', () => {
    const people = [{ engineeringSpeciality: 'Backend Engineer', miroTeam: 'Team' }]
    const result = calculateHeadcountByRole(people)
    expect(result.byRole).toEqual({ 'Backend Engineer': 1 })
  })

  it('uses _teamGrouping when miroTeam is absent', () => {
    const people = [{ specialty: 'QE', _teamGrouping: 'A, B, C' }]
    const result = calculateHeadcountByRole(people)
    expect(result.byRoleFte.QE).toBeCloseTo(0.33, 1) // 1/3
  })
})
