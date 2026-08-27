import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FeatureSignalsBoard from '../../../client/execute/components/FeatureSignalsBoard.vue'

function feature(overrides) {
  return Object.assign({
    key: 'A-1',
    summary: 'Test feature',
    status: 'In Progress',
    statusCategory: 'In Progress',
    completionPct: 40,
    epicCount: 1,
    issueCount: 2,
    blockerCount: 0,
    health: 'GREEN'
  }, overrides)
}

describe('FeatureSignalsBoard progress summary', () => {
  it('renders the progress strip above signal groups with rolled-up counts', () => {
    const wrapper = mount(FeatureSignalsBoard, {
      props: {
        features: [
          feature({
            key: 'A-1',
            status: 'Done',
            statusCategory: 'Done',
            completionPct: 100,
            epicCount: 2,
            issueCount: 4,
            health: 'GREEN'
          }),
          feature({
            key: 'A-2',
            status: 'In Progress',
            statusCategory: 'In Progress',
            completionPct: 20,
            epicCount: 1,
            issueCount: 3,
            blockerCount: 2,
            health: 'RED'
          })
        ]
      }
    })

    const bar = wrapper.get('[data-testid="signals-progress-summary"]')
    expect(bar.text()).toContain('Features')
    expect(bar.text()).toContain('Epics')
    expect(bar.text()).toContain('Done')
    expect(bar.text()).toContain('Active')
    expect(bar.text()).toContain('Backlog')
    expect(bar.text()).toContain('Blockers')
    expect(bar.text()).toContain('Issues')
    expect(bar.text()).toContain('complete')
    expect(bar.text()).toMatch(/3/)
    expect(bar.text()).toMatch(/7/)

    const html = wrapper.html()
    expect(html.indexOf('signals-progress-summary')).toBeLessThan(html.indexOf('signal-group-'))
  })

  it('hides the strip when there are no features', () => {
    const wrapper = mount(FeatureSignalsBoard, { props: { features: [] } })
    expect(wrapper.find('[data-testid="signals-progress-summary"]').exists()).toBe(false)
  })
})
