import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TeamDetail from '../../client/components/TeamDetail.vue'
import SprintSelector from '../../client/components/SprintSelector.vue'
import SprintStatusBadge from '../../client/components/SprintStatusBadge.vue'
import AllocationBar from '../../client/components/AllocationBar.vue'
import BucketBreakdown from '../../client/components/BucketBreakdown.vue'
import UnestimatedPanel from '../../client/components/UnestimatedPanel.vue'
import CompletionSummary from '../../client/components/CompletionSummary.vue'

describe('TeamDetail', () => {
  const mockBoard = { id: 1, name: 'Board Alpha', displayName: 'Team Alpha' }

  const mockSprints = [
    { id: 100, name: 'Sprint 10', state: 'active', startDate: '2026-02-03', endDate: '2026-02-14' },
    { id: 101, name: 'Sprint 11', state: 'future', startDate: '2026-02-17', endDate: '2026-02-28' },
    { id: 99, name: 'Sprint 9', state: 'closed', startDate: '2026-01-20', endDate: '2026-01-31' }
  ]

  const mockSelectedSprint = mockSprints[0]

  const mockSprintData = {
    sprint: { id: 100, name: 'Sprint 10', state: 'active', startDate: '2026-02-03', endDate: '2026-02-14' },
    summary: {
      totalPoints: 50, completedPoints: 20, estimatedIssueCount: 8, unestimatedIssueCount: 2,
      buckets: {
        'tech-debt-quality': { points: 20, percentage: 40, issueCount: 3, completedPoints: 10 },
        'new-features': { points: 25, percentage: 50, issueCount: 4, completedPoints: 10 },
        'learning-enablement': { points: 5, percentage: 10, issueCount: 1, completedPoints: 0 },
        'uncategorized': { points: 0, percentage: 0, issueCount: 0, completedPoints: 0 }
      }
    },
    issues: {
      'tech-debt-quality': [
        { key: 'RHOAIENG-1', summary: 'Bug fix 1', url: 'https://issues.redhat.com/browse/RHOAIENG-1', storyPoints: 5, status: 'Done', completed: true },
        { key: 'RHOAIENG-2', summary: 'Bug fix 2', url: 'https://issues.redhat.com/browse/RHOAIENG-2', storyPoints: 8, status: 'In Progress', completed: false },
        { key: 'RHOAIENG-3', summary: 'Tech debt item', url: 'https://issues.redhat.com/browse/RHOAIENG-3', storyPoints: null, status: 'To Do', completed: false }
      ],
      'new-features': [
        { key: 'RHOAIENG-4', summary: 'Feature task', url: 'https://issues.redhat.com/browse/RHOAIENG-4', storyPoints: 13, status: 'In Progress', completed: false },
        { key: 'RHOAIENG-5', summary: 'Another feature', url: 'https://issues.redhat.com/browse/RHOAIENG-5', storyPoints: 8, status: 'Done', completed: true },
        { key: 'RHOAIENG-6', summary: 'More feature work', url: 'https://issues.redhat.com/browse/RHOAIENG-6', storyPoints: 4, status: 'To Do', completed: false },
        { key: 'RHOAIENG-7', summary: 'Unestimated feature', url: 'https://issues.redhat.com/browse/RHOAIENG-7', storyPoints: null, status: 'To Do', completed: false }
      ],
      'learning-enablement': [
        { key: 'RHOAIENG-8', summary: 'Learning item', url: 'https://issues.redhat.com/browse/RHOAIENG-8', storyPoints: 5, status: 'In Progress', completed: false }
      ],
      'uncategorized': []
    }
  }

  const defaultProps = {
    board: mockBoard,
    sprints: mockSprints,
    selectedSprint: mockSelectedSprint,
    sprintData: mockSprintData,
    isLoading: false
  }

  it('renders team name heading', () => {
    const wrapper = mount(TeamDetail, { props: defaultProps })
    expect(wrapper.text()).toContain('Team Alpha')
  })

  it('renders back button that emits "back"', async () => {
    const wrapper = mount(TeamDetail, { props: defaultProps })
    const backButton = wrapper.find('[data-testid="back-button"]')
    expect(backButton.exists()).toBe(true)
    await backButton.trigger('click')
    expect(wrapper.emitted('back')).toBeTruthy()
  })

  it('renders SprintSelector with sprints', () => {
    const wrapper = mount(TeamDetail, { props: defaultProps })
    const selector = wrapper.findComponent(SprintSelector)
    expect(selector.exists()).toBe(true)
    expect(selector.props('sprints')).toHaveLength(3)
    expect(selector.props('selectedSprintId')).toBe(100)
  })

  it('emits select-sprint when SprintSelector changes', async () => {
    const wrapper = mount(TeamDetail, { props: defaultProps })
    const selector = wrapper.findComponent(SprintSelector)
    selector.vm.$emit('select-sprint', 99)
    expect(wrapper.emitted('select-sprint')).toBeTruthy()
    expect(wrapper.emitted('select-sprint')[0]).toEqual([99])
  })

  it('renders SprintStatusBadge with sprint state', () => {
    const wrapper = mount(TeamDetail, { props: defaultProps })
    const badge = wrapper.findComponent(SprintStatusBadge)
    expect(badge.exists()).toBe(true)
    expect(badge.props('state')).toBe('active')
  })

  it('shows sprint date range', () => {
    const wrapper = mount(TeamDetail, { props: defaultProps })
    const text = wrapper.text()
    expect(text).toContain('Feb')
    expect(text).toContain('\u2013')
  })

  it('renders AllocationBar', () => {
    const wrapper = mount(TeamDetail, { props: defaultProps })
    const bar = wrapper.findComponent(AllocationBar)
    expect(bar.exists()).toBe(true)
    expect(bar.props('totalPoints')).toBe(50)
  })

  it('shows total points summary', () => {
    const wrapper = mount(TeamDetail, { props: defaultProps })
    expect(wrapper.text()).toContain('50')
    expect(wrapper.text()).toContain('total points')
  })

  it('renders 4 BucketBreakdown cards', () => {
    const wrapper = mount(TeamDetail, { props: defaultProps })
    const cards = wrapper.findAllComponents(BucketBreakdown)
    expect(cards.length).toBe(4)
  })

  it('passes correct props to BucketBreakdown cards', () => {
    const wrapper = mount(TeamDetail, { props: defaultProps })
    const cards = wrapper.findAllComponents(BucketBreakdown)
    const techDebtCard = cards.find(c => c.props('bucketKey') === 'tech-debt-quality')
    expect(techDebtCard.props('name')).toBe('Tech Debt & Quality')
    expect(techDebtCard.props('points')).toBe(20)
    expect(techDebtCard.props('targetPercentage')).toBe(40)
    expect(techDebtCard.props('color')).toBe('amber')
    const featureCard = cards.find(c => c.props('bucketKey') === 'new-features')
    expect(featureCard.props('name')).toBe('New Features')
    expect(featureCard.props('targetPercentage')).toBe(40)
    expect(featureCard.props('color')).toBe('blue')
    const learningCard = cards.find(c => c.props('bucketKey') === 'learning-enablement')
    expect(learningCard.props('name')).toBe('Learning & Enablement')
    expect(learningCard.props('targetPercentage')).toBe(20)
    expect(learningCard.props('color')).toBe('green')
    const uncategorizedCard = cards.find(c => c.props('bucketKey') === 'uncategorized')
    expect(uncategorizedCard.props('name')).toBe('Uncategorized')
    expect(uncategorizedCard.props('targetPercentage')).toBe(0)
    expect(uncategorizedCard.props('color')).toBe('gray')
  })

  it('renders UnestimatedPanel with unestimated issues', () => {
    const wrapper = mount(TeamDetail, { props: defaultProps })
    const panel = wrapper.findComponent(UnestimatedPanel)
    expect(panel.exists()).toBe(true)
    expect(panel.props('issues')).toHaveLength(2)
  })

  it('renders CompletionSummary with sprint state', () => {
    const wrapper = mount(TeamDetail, { props: defaultProps })
    const summary = wrapper.findComponent(CompletionSummary)
    expect(summary.exists()).toBe(true)
    expect(summary.props('sprintState')).toBe('active')
  })

  it('shows CompletionSummary for closed sprints', () => {
    const closedSprint = { id: 99, name: 'Sprint 9', state: 'closed', startDate: '2026-01-20', endDate: '2026-01-31' }
    const closedData = { ...mockSprintData, sprint: closedSprint }
    const wrapper = mount(TeamDetail, {
      props: { ...defaultProps, selectedSprint: closedSprint, sprintData: closedData }
    })
    const summary = wrapper.findComponent(CompletionSummary)
    expect(summary.props('sprintState')).toBe('closed')
  })

  it('shows loading spinner when isLoading and no sprintData', () => {
    const wrapper = mount(TeamDetail, {
      props: { ...defaultProps, isLoading: true, sprintData: null }
    })
    expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(true)
  })

  it('does not show loading spinner when data is present even if loading', () => {
    const wrapper = mount(TeamDetail, {
      props: { ...defaultProps, isLoading: true }
    })
    expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(false)
  })

  it('shows "No sprint data" when sprints array is empty', () => {
    const wrapper = mount(TeamDetail, {
      props: { ...defaultProps, sprints: [], selectedSprint: null, sprintData: null }
    })
    expect(wrapper.text()).toContain('No sprint data')
  })

  it('uses board name as fallback when displayName is missing', () => {
    const boardNoDisplay = { id: 1, name: 'Board Alpha' }
    const wrapper = mount(TeamDetail, {
      props: { ...defaultProps, board: boardNoDisplay }
    })
    expect(wrapper.text()).toContain('Board Alpha')
  })
})
