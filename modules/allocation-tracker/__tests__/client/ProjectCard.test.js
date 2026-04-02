import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProjectCard from '../../client/components/ProjectCard.vue'
import AllocationBar from '../../client/components/AllocationBar.vue'

describe('ProjectCard', () => {
  const mockProject = { key: 'RHOAIENG', name: 'OpenShift AI Engineering', pillar: 'OpenShift AI' }

  const mockSummary = {
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
      },
      2: {
        sprint: { id: 101, name: 'Sprint 1', state: 'active' },
        summary: {
          totalPoints: 20,
          buckets: {
            'tech-debt-quality': { points: 8, issueCount: 2, completedPoints: 4 },
            'new-features': { points: 8, issueCount: 2, completedPoints: 2 },
            'learning-enablement': { points: 2, issueCount: 1, completedPoints: 0 },
            'uncategorized': { points: 2, issueCount: 1, completedPoints: 0 }
          }
        }
      }
    }
  }

  it('displays project name', () => {
    const wrapper = mount(ProjectCard, { props: { project: mockProject, summary: mockSummary } })
    expect(wrapper.text()).toContain('OpenShift AI Engineering')
  })

  it('displays pillar label', () => {
    const wrapper = mount(ProjectCard, { props: { project: mockProject, summary: mockSummary } })
    expect(wrapper.text()).toContain('OpenShift AI')
  })

  it('displays board count', () => {
    const wrapper = mount(ProjectCard, { props: { project: mockProject, summary: mockSummary } })
    expect(wrapper.text()).toContain('2 boards')
  })

  it('displays total points', () => {
    const wrapper = mount(ProjectCard, { props: { project: mockProject, summary: mockSummary } })
    expect(wrapper.text()).toContain('50')
  })

  it('shows allocation bar when summary has points', () => {
    const wrapper = mount(ProjectCard, { props: { project: mockProject, summary: mockSummary } })
    const bar = wrapper.findComponent(AllocationBar)
    expect(bar.exists()).toBe(true)
    expect(bar.props('totalPoints')).toBe(50)
  })

  it('shows "No data available" when summary is null', () => {
    const wrapper = mount(ProjectCard, { props: { project: mockProject, summary: null } })
    expect(wrapper.text()).toContain('No data available')
    expect(wrapper.findComponent(AllocationBar).exists()).toBe(false)
  })

  it('emits select-project on click', async () => {
    const wrapper = mount(ProjectCard, { props: { project: mockProject, summary: mockSummary } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('select-project')).toBeTruthy()
    expect(wrapper.emitted('select-project')[0]).toEqual([mockProject])
  })

  it('handles singular board count', () => {
    const singleBoardSummary = {
      boards: {
        1: {
          sprint: { id: 100, name: 'Sprint 1', state: 'active' },
          summary: { totalPoints: 10, buckets: {
            'tech-debt-quality': { points: 4 },
            'new-features': { points: 4 },
            'learning-enablement': { points: 1 },
            'uncategorized': { points: 1 }
          }}
        }
      }
    }
    const wrapper = mount(ProjectCard, { props: { project: mockProject, summary: singleBoardSummary } })
    expect(wrapper.text()).toContain('1 board')
    expect(wrapper.text()).not.toContain('1 boards')
  })
})
