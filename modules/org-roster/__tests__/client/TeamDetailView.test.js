import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import TeamDetailView from '../../client/views/TeamDetailView.vue'

// Mock the composable
vi.mock('../../client/composables/useOrgRoster', () => ({
  useOrgRoster: () => ({
    loadTeamDetail: vi.fn().mockResolvedValue({
      org: 'AI Platform',
      name: 'Dashboard',
      productManagers: ['Alice Smith'],
      engLeads: ['Bob Jones'],
      boardUrls: ['https://jira.example.com/board/1'],
      components: ['AI Hub', 'AI Core Dashboard'],
      memberCount: 3,
      rfeCount: 12,
      headcount: {
        byRole: { BFF: 2, QE: 1 },
        byRoleFte: { BFF: 2, QE: 0.5 },
        totalHeadcount: 3,
        totalFte: 2.5,
      },
    }),
    loadTeamMembers: vi.fn().mockResolvedValue({
      members: [
        {
          name: 'John Doe',
          managerUid: 'manager1',
          specialty: 'BFF',
          status: 'Confirmed',
          geo: 'NA',
          customFields: {},
        },
        {
          name: 'Jane Smith',
          managerUid: 'manager1',
          specialty: 'BFF',
          status: 'Confirmed',
          geo: 'EMEA',
          customFields: {},
        },
        {
          name: 'Unconfirmed Person',
          managerUid: 'manager2',
          specialty: 'QE',
          status: 'Not Confirmed',
          geo: null,
          customFields: { status: 'Not Confirmed' },
        },
      ],
    }),
    loadRfeBacklog: vi.fn().mockResolvedValue({
      byComponent: {
        'AI Hub': { count: 8 },
        'AI Core Dashboard': { count: 4 },
      },
      byTeam: {},
    }),
  }),
}))

// Mock the api module
vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn(),
}))

// Mock the cross-module link composable
vi.mock('@shared/client/composables/useModuleLink', () => ({
  useModuleLink: () => ({
    linkTo: (slug, view, params) => `#/${slug}/${view}?person=${params.person}`,
    navigateTo: vi.fn(),
  }),
}))

describe('TeamDetailView', () => {
  let wrapper

  beforeEach(async () => {
    wrapper = mount(TeamDetailView, {
      global: {
        provide: {
          moduleNav: {
            navigateTo: vi.fn(),
            goBack: vi.fn(),
            params: ref({ teamKey: 'AI Platform::Dashboard' }),
          },
        },
      },
    })
    // Wait for onMounted async operations
    await new Promise(r => setTimeout(r, 50))
  })

  it('renders the team name', () => {
    expect(wrapper.text()).toContain('Dashboard')
  })

  it('renders the org name', () => {
    expect(wrapper.text()).toContain('AI Platform')
  })

  it('shows PM names', () => {
    expect(wrapper.text()).toContain('Alice Smith')
  })

  it('shows engineering leads', () => {
    expect(wrapper.text()).toContain('Bob Jones')
  })

  it('renders RFE backlog badge', () => {
    expect(wrapper.text()).toContain('12 open RFEs')
  })

  it('renders the members table', () => {
    expect(wrapper.text()).toContain('Team Members')
    expect(wrapper.text()).toContain('John Doe')
    expect(wrapper.text()).toContain('Jane Smith')
  })

  it('shows unconfirmed status for unconfirmed members', () => {
    expect(wrapper.text()).toContain('Unconfirmed')
  })

  it('renders person names as cross-module links', () => {
    const links = wrapper.findAll('a[href*="team-tracker"]')
    expect(links.length).toBeGreaterThan(0)
    const johnLink = links.find(l => l.text().includes('John Doe'))
    expect(johnLink).toBeTruthy()
    expect(johnLink.attributes('href')).toContain('person=John Doe')
  })

  it('renders component list', () => {
    expect(wrapper.text()).toContain('Components')
    expect(wrapper.text()).toContain('AI Hub')
    expect(wrapper.text()).toContain('AI Core Dashboard')
  })

  it('shows back button', () => {
    const backBtn = wrapper.find('button')
    expect(backBtn.text()).toContain('Back')
  })
})
