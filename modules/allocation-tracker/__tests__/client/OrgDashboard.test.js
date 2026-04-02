import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OrgDashboard from '../../client/components/OrgDashboard.vue'
import ProjectCard from '../../client/components/ProjectCard.vue'
import AllocationBar from '../../client/components/AllocationBar.vue'

describe('OrgDashboard', () => {
  const mockProjects = [
    { key: 'RHOAIENG', name: 'OpenShift AI Engineering', pillar: 'OpenShift AI' },
    { key: 'RHAISTRAT', name: 'AI Strategy', pillar: 'Strategy' }
  ]

  const mockOrgSummary = {
    totalPoints: 100,
    projectCount: 2,
    boardCount: 5,
    buckets: {
      'tech-debt-quality': { points: 40, issueCount: 10, completedPoints: 20 },
      'new-features': { points: 40, issueCount: 10, completedPoints: 15 },
      'learning-enablement': { points: 10, issueCount: 3, completedPoints: 0 },
      'uncategorized': { points: 10, issueCount: 2, completedPoints: 0 }
    }
  }

  it('displays org name', () => {
    const wrapper = mount(OrgDashboard, {
      props: { orgName: 'AI Engineering', orgSummary: mockOrgSummary, projects: mockProjects }
    })
    expect(wrapper.text()).toContain('AI Engineering')
  })

  it('displays org-wide allocation bar when org summary has points', () => {
    const wrapper = mount(OrgDashboard, {
      props: { orgSummary: mockOrgSummary, projects: mockProjects }
    })
    const bars = wrapper.findAllComponents(AllocationBar)
    expect(bars.length).toBeGreaterThanOrEqual(1)
  })

  it('displays project cards for each project', () => {
    const wrapper = mount(OrgDashboard, {
      props: { orgSummary: mockOrgSummary, projects: mockProjects }
    })
    const cards = wrapper.findAllComponents(ProjectCard)
    expect(cards).toHaveLength(2)
  })

  it('emits select-project when a project card is clicked', async () => {
    const wrapper = mount(OrgDashboard, {
      props: { orgSummary: mockOrgSummary, projects: mockProjects }
    })
    const cards = wrapper.findAllComponents(ProjectCard)
    await cards[0].find('[data-testid="project-card"]').trigger('click')
    expect(wrapper.emitted('select-project')).toBeTruthy()
  })

  it('shows empty message when no projects', () => {
    const wrapper = mount(OrgDashboard, {
      props: { orgSummary: null, projects: [] }
    })
    expect(wrapper.text()).toContain('No projects configured')
  })

  it('shows allocation legend', () => {
    const wrapper = mount(OrgDashboard, {
      props: { orgSummary: mockOrgSummary, projects: mockProjects }
    })
    const legend = wrapper.find('[data-testid="allocation-legend"]')
    expect(legend.exists()).toBe(true)
    expect(legend.text()).toContain('Tech Debt & Quality')
    expect(legend.text()).toContain('New Features')
  })

  it('displays board count in org summary', () => {
    const wrapper = mount(OrgDashboard, {
      props: { orgSummary: mockOrgSummary, projects: mockProjects }
    })
    expect(wrapper.text()).toContain('5 boards')
  })
})
