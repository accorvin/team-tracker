import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TeamCard from '../../client/components/TeamCard.vue'
import SprintStatusBadge from '../../client/components/SprintStatusBadge.vue'
import AllocationBar from '../../client/components/AllocationBar.vue'

describe('TeamCard', () => {
  const mockBoard = { id: 1, name: 'RHOAIENG Board - Team Alpha', displayName: 'Team Alpha' }

  const mockSprintData = {
    sprint: { id: 100, name: 'Sprint 42', state: 'active', startDate: '2026-02-03T00:00:00.000Z', endDate: '2026-02-14T00:00:00.000Z' },
    summary: {
      totalPoints: 45,
      estimatedIssueCount: 10,
      unestimatedIssueCount: 3,
      buckets: {
        'tech-debt-quality': { points: 20, issueCount: 4, completedPoints: 10 },
        'new-features': { points: 25, issueCount: 6, completedPoints: 10 },
        'learning-enablement': { points: 0, issueCount: 0, completedPoints: 0 },
        'uncategorized': { points: 0, issueCount: 0, completedPoints: 0 }
      }
    }
  }

  it('displays team name from displayName', () => {
    const wrapper = mount(TeamCard, { props: { board: mockBoard, sprintData: mockSprintData } })
    expect(wrapper.text()).toContain('Team Alpha')
  })

  it('falls back to board name when no displayName', () => {
    const boardNoDisplay = { id: 1, name: 'RHOAIENG Board - Team Alpha' }
    const wrapper = mount(TeamCard, { props: { board: boardNoDisplay, sprintData: mockSprintData } })
    expect(wrapper.text()).toContain('RHOAIENG Board - Team Alpha')
  })

  it('shows sprint name and status badge when sprint data exists', () => {
    const wrapper = mount(TeamCard, { props: { board: mockBoard, sprintData: mockSprintData } })
    expect(wrapper.text()).toContain('Sprint 42')
    const badge = wrapper.findComponent(SprintStatusBadge)
    expect(badge.exists()).toBe(true)
    expect(badge.props('state')).toBe('active')
  })

  it('shows allocation bar with bucket data', () => {
    const wrapper = mount(TeamCard, { props: { board: mockBoard, sprintData: mockSprintData } })
    const bar = wrapper.findComponent(AllocationBar)
    expect(bar.exists()).toBe(true)
    expect(bar.props('buckets')).toEqual(mockSprintData.summary.buckets)
    expect(bar.props('totalPoints')).toBe(45)
  })

  it('shows total points and unestimated count', () => {
    const wrapper = mount(TeamCard, { props: { board: mockBoard, sprintData: mockSprintData } })
    expect(wrapper.text()).toContain('45')
    expect(wrapper.text()).toContain('3')
  })

  it('shows unestimated count with warning styling when > 0', () => {
    const wrapper = mount(TeamCard, { props: { board: mockBoard, sprintData: mockSprintData } })
    const unestimated = wrapper.find('[data-testid="unestimated-count"]')
    expect(unestimated.exists()).toBe(true)
    expect(unestimated.classes()).toEqual(expect.arrayContaining([expect.stringContaining('amber')]))
  })

  it('shows "No sprint data" when sprintData is null', () => {
    const wrapper = mount(TeamCard, { props: { board: mockBoard, sprintData: null } })
    expect(wrapper.text()).toContain('No sprint data')
    expect(wrapper.findComponent(AllocationBar).exists()).toBe(false)
  })

  it('emits select-team on click', async () => {
    const wrapper = mount(TeamCard, { props: { board: mockBoard, sprintData: mockSprintData } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('select-team')).toBeTruthy()
    expect(wrapper.emitted('select-team')[0]).toEqual([mockBoard])
  })

  it('shows completion percentage for closed sprints', () => {
    const closedSprintData = {
      sprint: { ...mockSprintData.sprint, state: 'closed' },
      summary: {
        totalPoints: 50, estimatedIssueCount: 10, unestimatedIssueCount: 0,
        buckets: {
          'tech-debt-quality': { points: 20, issueCount: 4, completedPoints: 16 },
          'new-features': { points: 30, issueCount: 6, completedPoints: 24 },
          'learning-enablement': { points: 0, issueCount: 0, completedPoints: 0 },
          'uncategorized': { points: 0, issueCount: 0, completedPoints: 0 }
        }
      }
    }
    const wrapper = mount(TeamCard, { props: { board: mockBoard, sprintData: closedSprintData } })
    expect(wrapper.text()).toContain('80%')
  })

  it('shows sprint date range', () => {
    const wrapper = mount(TeamCard, { props: { board: mockBoard, sprintData: mockSprintData } })
    expect(wrapper.text()).toMatch(/Feb\s+\d+/)
  })
})
