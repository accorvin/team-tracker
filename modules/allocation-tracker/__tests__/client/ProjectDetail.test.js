import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProjectDetail from '../../client/components/ProjectDetail.vue'
import TeamCard from '../../client/components/TeamCard.vue'
import AllocationBar from '../../client/components/AllocationBar.vue'

describe('ProjectDetail', () => {
  const mockProject = { key: 'RHOAIENG', name: 'OpenShift AI Engineering', pillar: 'OpenShift AI' }

  const mockBoards = [
    { id: 1, name: 'Board A', displayName: 'Team Alpha' },
    { id: 2, name: 'Board B', displayName: 'Team Beta' }
  ]

  const mockProjectSummary = {
    lastUpdated: '2026-02-10T00:00:00Z',
    boards: {
      1: {
        sprint: { id: 100, name: 'Sprint 1', state: 'active' },
        summary: {
          totalPoints: 30,
          buckets: {
            'tech-debt-quality': { points: 12, issueCount: 3, completedPoints: 5 },
            'new-features': { points: 12, issueCount: 3, completedPoints: 3 },
            'learning-enablement': { points: 3, issueCount: 1, completedPoints: 0 },
            'uncategorized': { points: 3, issueCount: 1, completedPoints: 0 }
          }
        }
      }
    }
  }

  const mockBoardSprintData = {
    1: {
      sprint: { id: 100, name: 'Sprint 1', state: 'active' },
      summary: {
        totalPoints: 30,
        buckets: {
          'tech-debt-quality': { points: 12, issueCount: 3, completedPoints: 5 },
          'new-features': { points: 12, issueCount: 3, completedPoints: 3 },
          'learning-enablement': { points: 3, issueCount: 1, completedPoints: 0 },
          'uncategorized': { points: 3, issueCount: 1, completedPoints: 0 }
        }
      }
    }
  }

  it('displays project name', () => {
    const wrapper = mount(ProjectDetail, {
      props: { project: mockProject, boards: mockBoards, projectSummary: mockProjectSummary, boardSprintData: mockBoardSprintData }
    })
    expect(wrapper.text()).toContain('OpenShift AI Engineering')
  })

  it('displays team cards for each board', () => {
    const wrapper = mount(ProjectDetail, {
      props: { project: mockProject, boards: mockBoards, projectSummary: mockProjectSummary, boardSprintData: mockBoardSprintData }
    })
    const cards = wrapper.findAllComponents(TeamCard)
    expect(cards).toHaveLength(2)
  })

  it('shows project allocation bar when summary has data', () => {
    const wrapper = mount(ProjectDetail, {
      props: { project: mockProject, boards: mockBoards, projectSummary: mockProjectSummary, boardSprintData: mockBoardSprintData }
    })
    const bars = wrapper.findAllComponents(AllocationBar)
    expect(bars.length).toBeGreaterThanOrEqual(1)
  })

  it('emits back event when back button clicked', async () => {
    const wrapper = mount(ProjectDetail, {
      props: { project: mockProject, boards: mockBoards }
    })
    const backButton = wrapper.find('button')
    await backButton.trigger('click')
    expect(wrapper.emitted('back')).toBeTruthy()
  })

  it('emits select-team when board card clicked', async () => {
    const wrapper = mount(ProjectDetail, {
      props: { project: mockProject, boards: mockBoards, boardSprintData: mockBoardSprintData }
    })
    const cards = wrapper.findAllComponents(TeamCard)
    await cards[0].trigger('click')
    expect(wrapper.emitted('select-team')).toBeTruthy()
  })

  it('shows empty message when no boards', () => {
    const wrapper = mount(ProjectDetail, {
      props: { project: mockProject, boards: [] }
    })
    expect(wrapper.text()).toContain('No boards found')
  })

  it('displays total points across boards', () => {
    const wrapper = mount(ProjectDetail, {
      props: { project: mockProject, boards: mockBoards, projectSummary: mockProjectSummary, boardSprintData: mockBoardSprintData }
    })
    expect(wrapper.text()).toContain('30')
  })
})
