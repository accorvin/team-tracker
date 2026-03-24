import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import OrgRosterHome from '../../client/views/OrgRosterHome.vue'

// Mock the composable
vi.mock('../../client/composables/useOrgRoster', () => ({
  useOrgRoster: () => ({
    orgs: ref([
      { name: 'AI Platform', teamCount: 2 },
      { name: 'AAET', teamCount: 1 },
    ]),
    selectedOrg: ref(null),
    loading: ref(false),
    error: ref(null),
    fetchedAt: ref('2026-03-24T12:00:00Z'),
    searchQuery: ref(''),
    sortBy: ref('name'),
    filteredTeams: ref([
      {
        org: 'AI Platform',
        name: 'Dashboard',
        productManagers: ['Alice'],
        engLeads: ['Bob'],
        memberCount: 5,
        components: ['AI Hub'],
        boardUrls: ['https://example.com'],
        rfeCount: 8,
        headcount: { byRole: { BFF: 3, QE: 2 } },
      },
      {
        org: 'AAET',
        name: 'Pipelines',
        productManagers: ['Eve'],
        engLeads: [],
        memberCount: 4,
        components: [],
        boardUrls: [],
        rfeCount: 0,
        headcount: { byRole: { 'Backend Engineer': 4 } },
      },
    ]),
    loadTeams: vi.fn(),
    loadOrgs: vi.fn(),
  }),
}))

// Mock the api module
vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn(),
}))

describe('OrgRosterHome', () => {
  let wrapper

  beforeEach(() => {
    wrapper = mount(OrgRosterHome, {
      global: {
        provide: {
          moduleNav: {
            navigateTo: vi.fn(),
            goBack: vi.fn(),
            params: ref({}),
          },
        },
      },
    })
  })

  it('renders the Team Directory title', () => {
    expect(wrapper.text()).toContain('Team Directory')
  })

  it('renders team cards', () => {
    expect(wrapper.text()).toContain('Dashboard')
    expect(wrapper.text()).toContain('Pipelines')
  })

  it('renders org selector buttons', () => {
    expect(wrapper.text()).toContain('AI Platform')
    expect(wrapper.text()).toContain('AAET')
    expect(wrapper.text()).toContain('All')
  })

  it('shows search input', () => {
    const input = wrapper.find('input[type="text"]')
    expect(input.exists()).toBe(true)
  })

  it('shows sort dropdown', () => {
    const select = wrapper.find('select')
    expect(select.exists()).toBe(true)
  })
})
