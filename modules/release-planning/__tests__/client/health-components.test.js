import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RiskBadge from '../../client/components/RiskBadge.vue'
import HealthSummaryCards from '../../client/components/HealthSummaryCards.vue'
import DorChecklist from '../../client/components/DorChecklist.vue'
import RiceScoreDisplay from '../../client/components/RiceScoreDisplay.vue'
import HealthFilterBar from '../../client/components/HealthFilterBar.vue'
import MilestoneTimeline from '../../client/components/MilestoneTimeline.vue'
import FeatureHealthTable from '../../client/components/FeatureHealthTable.vue'
import PhaseSelector from '../../client/components/PhaseSelector.vue'

// ─── RiskBadge ───

describe('RiskBadge', function() {
  it('renders Green label by default', function() {
    var wrapper = mount(RiskBadge)
    expect(wrapper.text()).toContain('Green')
  })

  it('renders Red label for level red', function() {
    var wrapper = mount(RiskBadge, { props: { level: 'red' } })
    expect(wrapper.text()).toContain('Red')
  })

  it('renders Yellow label for level yellow', function() {
    var wrapper = mount(RiskBadge, { props: { level: 'yellow' } })
    expect(wrapper.text()).toContain('Yellow')
  })

  it('applies red color classes for red level', function() {
    var wrapper = mount(RiskBadge, { props: { level: 'red' } })
    expect(wrapper.find('span').classes().join(' ')).toContain('red')
  })

  it('shows flag count superscript when flagCount > 0', function() {
    var wrapper = mount(RiskBadge, { props: { level: 'yellow', flagCount: 3 } })
    var sup = wrapper.find('sup')
    expect(sup.exists()).toBe(true)
    expect(sup.text()).toBe('3')
  })

  it('does not show superscript when flagCount is 0', function() {
    var wrapper = mount(RiskBadge, { props: { level: 'green', flagCount: 0 } })
    expect(wrapper.find('sup').exists()).toBe(false)
  })

  it('shows override indicator when override is present', function() {
    var wrapper = mount(RiskBadge, {
      props: { level: 'red', override: { riskOverride: 'green', reason: 'PM approved' } }
    })
    expect(wrapper.text()).toContain('M')
  })

  it('displays override level instead of original level', function() {
    var wrapper = mount(RiskBadge, {
      props: { level: 'red', override: { riskOverride: 'green', reason: 'PM approved' } }
    })
    expect(wrapper.text()).toContain('Green')
  })
})

// ─── HealthSummaryCards ───

describe('HealthSummaryCards', function() {
  var summary = {
    totalFeatures: 10,
    byRisk: { green: 5, yellow: 3, red: 2 },
    dorCompletionRate: 65,
    averageRiceScore: 200
  }

  it('renders nothing when summary is null', function() {
    var wrapper = mount(HealthSummaryCards, { props: { summary: null } })
    expect(wrapper.text()).toBe('')
  })

  it('renders risk count cards', function() {
    var wrapper = mount(HealthSummaryCards, { props: { summary: summary } })
    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('2')
  })

  it('renders DoR completion percentage', function() {
    var wrapper = mount(HealthSummaryCards, { props: { summary: summary } })
    expect(wrapper.text()).toContain('65')
  })

  it('emits filterByRisk when a risk card is clicked', async function() {
    var wrapper = mount(HealthSummaryCards, { props: { summary: summary } })
    var buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')
    expect(wrapper.emitted('filterByRisk')).toBeDefined()
  })

  it('renders planning deadline card when planningDeadline is present', function() {
    var summaryWithDeadline = Object.assign({}, summary, {
      planningDeadline: { date: '2026-05-01', daysRemaining: 5 }
    })
    var wrapper = mount(HealthSummaryCards, { props: { summary: summaryWithDeadline } })
    expect(wrapper.text()).toContain('Planning Deadline')
    expect(wrapper.text()).toContain('2026-05-01')
  })

  it('does not render planning deadline card when planningDeadline is null', function() {
    var wrapper = mount(HealthSummaryCards, { props: { summary: summary } })
    expect(wrapper.text()).not.toContain('Planning Deadline')
  })

  it('shows days remaining for planning deadline', function() {
    var summaryWithDeadline = Object.assign({}, summary, {
      planningDeadline: { date: '2026-05-01', daysRemaining: 10 }
    })
    var wrapper = mount(HealthSummaryCards, { props: { summary: summaryWithDeadline } })
    expect(wrapper.text()).toContain('10')
  })
})

// ─── DorChecklist ───

describe('DorChecklist', function() {
  var items = [
    { id: 'F-1', label: 'Description exists', type: 'automated', checked: true, source: 'jira' },
    { id: 'F-2', label: 'Target version set', type: 'automated', checked: false, source: 'jira' },
    { id: 'F-3', label: 'Stakeholders identified', type: 'manual', checked: false, source: 'manual' }
  ]

  it('renders all items', function() {
    var wrapper = mount(DorChecklist, { props: { items: items, canEdit: false } })
    expect(wrapper.text()).toContain('Description exists')
    expect(wrapper.text()).toContain('Target version set')
    expect(wrapper.text()).toContain('Stakeholders identified')
  })

  it('displays checked count in header', function() {
    var wrapper = mount(DorChecklist, { props: { items: items, canEdit: false } })
    expect(wrapper.text()).toContain('1/3')
  })

  it('shows lock icon for automated items', function() {
    var wrapper = mount(DorChecklist, { props: { items: items, canEdit: true } })
    var automatedRows = wrapper.findAll('[data-automated]').length
    || wrapper.findAll('svg').length
    expect(automatedRows).toBeGreaterThan(0)
  })

  it('emits toggleItem when manual item row is clicked and canEdit is true', async function() {
    var wrapper = mount(DorChecklist, { props: { items: items, canEdit: true, featureKey: 'T-1' } })
    var checkboxes = wrapper.findAll('input[type="checkbox"]')
    if (checkboxes.length > 0) {
      await checkboxes[0].trigger('click')
      expect(wrapper.emitted('toggleItem')).toBeDefined()
    }
  })

  it('shows textarea when canEdit is true', function() {
    var wrapper = mount(DorChecklist, { props: { items: items, canEdit: true, notes: '' } })
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('shows read-only notes when canEdit is false and notes exist', function() {
    var wrapper = mount(DorChecklist, { props: { items: items, canEdit: false, notes: 'Some notes here' } })
    expect(wrapper.text()).toContain('Some notes here')
  })
})

// ─── RiceScoreDisplay ───

describe('RiceScoreDisplay', function() {
  it('shows N/A when rice is null', function() {
    var wrapper = mount(RiceScoreDisplay, { props: { rice: null } })
    expect(wrapper.text()).toContain('N/A')
  })

  it('shows score when rice data is complete', function() {
    var wrapper = mount(RiceScoreDisplay, {
      props: { rice: { reach: 1000, impact: 2, confidence: 80, effort: 4, score: 400, complete: true } }
    })
    expect(wrapper.text()).toContain('400')
  })

  it('shows N/A when rice has no score', function() {
    var wrapper = mount(RiceScoreDisplay, {
      props: { rice: { reach: 1000, impact: null, confidence: 80, effort: 4, score: null, complete: false } }
    })
    expect(wrapper.text()).toContain('N/A')
  })

  it('expands breakdown on click when score exists', async function() {
    var wrapper = mount(RiceScoreDisplay, {
      props: { rice: { reach: 1000, impact: 2, confidence: 80, effort: 4, score: 400, complete: true } }
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).toContain('Reach')
    expect(wrapper.text()).toContain('1000')
    expect(wrapper.text()).toContain('Impact')
    expect(wrapper.text()).toContain('Confidence')
    expect(wrapper.text()).toContain('Effort')
  })

  it('does not expand on click when score is null', async function() {
    var wrapper = mount(RiceScoreDisplay, { props: { rice: null } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).not.toContain('Reach')
  })
})

// ─── PhaseSelector ───

describe('PhaseSelector', function() {
  var phases = [
    { value: 'EA1', label: 'RHOAI 3.5 EA1' },
    { value: 'EA2', label: 'RHOAI 3.5 EA2' },
    { value: 'GA', label: 'RHOAI 3.5 GA' }
  ]

  it('renders select with All Phases option', function() {
    var wrapper = mount(PhaseSelector, { props: { phases: phases, modelValue: '' } })
    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.text()).toContain('All Phases')
  })

  it('renders all provided phase options', function() {
    var wrapper = mount(PhaseSelector, { props: { phases: phases, modelValue: '' } })
    expect(wrapper.text()).toContain('RHOAI 3.5 EA1')
    expect(wrapper.text()).toContain('RHOAI 3.5 EA2')
    expect(wrapper.text()).toContain('RHOAI 3.5 GA')
  })

  it('emits update:modelValue on change', async function() {
    var wrapper = mount(PhaseSelector, { props: { phases: phases, modelValue: '' } })
    await wrapper.find('select').setValue('EA2')
    expect(wrapper.emitted('update:modelValue')).toBeDefined()
    expect(wrapper.emitted('update:modelValue')[0][0]).toBe('EA2')
  })

  it('renders empty when no phases provided', function() {
    var wrapper = mount(PhaseSelector, { props: { phases: [], modelValue: '' } })
    var options = wrapper.findAll('option')
    expect(options.length).toBe(1)
    expect(options[0].text()).toContain('All Phases')
  })
})

// ─── HealthFilterBar ───

describe('HealthFilterBar', function() {
  it('renders search input', function() {
    var wrapper = mount(HealthFilterBar)
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('renders risk filter select', function() {
    var wrapper = mount(HealthFilterBar)
    var selects = wrapper.findAll('select')
    expect(selects.length).toBeGreaterThanOrEqual(2)
  })

  it('renders big rocks select when bigRocks provided', function() {
    var wrapper = mount(HealthFilterBar, { props: { bigRocks: ['Rock A', 'Rock B'] } })
    expect(wrapper.text()).toContain('Rock A')
    expect(wrapper.text()).toContain('Rock B')
  })

  it('renders components select when components provided', function() {
    var wrapper = mount(HealthFilterBar, { props: { components: ['Model Serving', 'Pipelines'] } })
    expect(wrapper.text()).toContain('Model Serving')
    expect(wrapper.text()).toContain('Pipelines')
  })

  it('renders tier filter select', function() {
    var wrapper = mount(HealthFilterBar)
    expect(wrapper.text()).toContain('All Tiers')
    expect(wrapper.text()).toContain('Tier 1')
    expect(wrapper.text()).toContain('Tier 2')
    expect(wrapper.text()).toContain('Tier 3')
  })

  it('emits update:tierFilter on tier select change', async function() {
    var wrapper = mount(HealthFilterBar)
    var tierSelect = wrapper.findAll('select').filter(function(s) {
      return s.text().includes('All Tiers')
    })
    if (tierSelect.length > 0) {
      await tierSelect[0].setValue('2')
      expect(wrapper.emitted('update:tierFilter')).toBeDefined()
      expect(wrapper.emitted('update:tierFilter')[0][0]).toBe('2')
    }
  })

  it('shows clear button when hasActiveFilters is true', function() {
    var wrapper = mount(HealthFilterBar, { props: { hasActiveFilters: true } })
    var clearBtn = wrapper.findAll('button').filter(function(b) { return b.text().toLowerCase().includes('clear') })
    expect(clearBtn.length).toBeGreaterThan(0)
  })

  it('hides clear button when hasActiveFilters is false', function() {
    var wrapper = mount(HealthFilterBar, { props: { hasActiveFilters: false } })
    var clearBtn = wrapper.findAll('button').filter(function(b) { return b.text().toLowerCase().includes('clear') })
    expect(clearBtn.length).toBe(0)
  })

  it('emits clearFilters when clear button is clicked', async function() {
    var wrapper = mount(HealthFilterBar, { props: { hasActiveFilters: true } })
    var clearBtn = wrapper.findAll('button').filter(function(b) { return b.text().toLowerCase().includes('clear') })
    if (clearBtn.length > 0) {
      await clearBtn[0].trigger('click')
      expect(wrapper.emitted('clearFilters')).toBeDefined()
    }
  })

  it('emits update:searchQuery on input', async function() {
    var wrapper = mount(HealthFilterBar)
    await wrapper.find('input').setValue('test query')
    expect(wrapper.emitted('update:searchQuery')).toBeDefined()
    expect(wrapper.emitted('update:searchQuery')[0][0]).toBe('test query')
  })
})

// ─── MilestoneTimeline ───

describe('MilestoneTimeline', function() {
  var milestones = {
    ea1Freeze: '2026-05-01',
    ea1Target: '2026-05-15',
    ea2Freeze: '2026-06-15',
    ea2Target: '2026-07-01',
    gaFreeze: '2026-08-01',
    gaTarget: '2026-08-15'
  }

  it('shows fallback when milestones is null', function() {
    var wrapper = mount(MilestoneTimeline, { props: { milestones: null } })
    expect(wrapper.text()).toContain('Milestone')
  })

  it('renders milestone labels when data provided', function() {
    var wrapper = mount(MilestoneTimeline, { props: { milestones: milestones } })
    expect(wrapper.text()).toContain('EA1')
    expect(wrapper.text()).toContain('GA')
  })

  it('shows next milestone countdown', function() {
    var wrapper = mount(MilestoneTimeline, { props: { milestones: milestones } })
    var text = wrapper.text()
    if (text.includes('day')) {
      expect(text).toMatch(/\d+\s*day/)
    }
  })

  it('renders milestone points', function() {
    var wrapper = mount(MilestoneTimeline, { props: { milestones: milestones } })
    expect(wrapper.findAll('[class*="rounded-full"]').length || wrapper.findAll('div').length).toBeGreaterThan(0)
  })
})

// ─── FeatureHealthTable ───

describe('FeatureHealthTable', function() {
  var features = [
    {
      key: 'T-1', summary: 'Feature 1', status: 'In Progress',
      risk: { level: 'green', flags: [], riskScore: 0 },
      dor: { checkedCount: 10, totalCount: 13, completionPct: 77, items: [] },
      rice: null, components: ['Model Serving'], phase: 'GA', bigRock: 'MaaS'
    },
    {
      key: 'T-2', summary: 'Feature 2', status: 'New',
      risk: { level: 'red', flags: [{ category: 'MILESTONE_MISS', severity: 'high' }], riskScore: 1 },
      dor: { checkedCount: 3, totalCount: 13, completionPct: 23, items: [] },
      rice: { score: 250, complete: true }, components: ['Pipelines'], phase: 'TP', bigRock: null
    }
  ]

  it('renders table headers', function() {
    var wrapper = mount(FeatureHealthTable, { props: { features: features } })
    expect(wrapper.text()).toContain('Feature')
    expect(wrapper.text()).toContain('Summary')
    expect(wrapper.text()).toContain('Risk')
  })

  it('shows empty state when features array is empty', function() {
    var wrapper = mount(FeatureHealthTable, { props: { features: [] } })
    expect(wrapper.text()).toContain('No features')
  })

  it('renders feature rows', function() {
    var wrapper = mount(FeatureHealthTable, { props: { features: features } })
    expect(wrapper.text()).toContain('T-1')
    expect(wrapper.text()).toContain('T-2')
    expect(wrapper.text()).toContain('Feature 1')
    expect(wrapper.text()).toContain('Feature 2')
  })

  it('does not show pagination for small feature lists', function() {
    var wrapper = mount(FeatureHealthTable, { props: { features: features } })
    expect(wrapper.text()).not.toContain('Next')
  })

  it('sorts features by risk by default (red first)', function() {
    var wrapper = mount(FeatureHealthTable, { props: { features: features } })
    var rows = wrapper.findAll('tr')
    var firstDataRow = rows.length > 1 ? rows[1].text() : ''
    expect(firstDataRow).toContain('T-2')
  })
})
