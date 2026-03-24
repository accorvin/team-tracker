import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DoughnutChart from '../../client/components/DoughnutChart.vue'

// Mock vue-chartjs
vi.mock('vue-chartjs', () => ({
  Doughnut: {
    name: 'Doughnut',
    props: ['data', 'options'],
    template: '<canvas data-testid="doughnut-canvas"></canvas>',
    emits: ['click']
  }
}))

// Mock chart.js
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  ArcElement: 'ArcElement',
  Tooltip: 'Tooltip',
  Legend: 'Legend'
}))

describe('DoughnutChart', () => {
  const defaultProps = {
    labels: ['Alice', 'Bob', 'Charlie'],
    data: [30, 20, 10]
  }

  it('renders the Doughnut component', () => {
    const wrapper = mount(DoughnutChart, { props: defaultProps })
    expect(wrapper.find('[data-testid="doughnut-canvas"]').exists()).toBe(true)
  })

  it('passes correct data to chart', () => {
    const wrapper = mount(DoughnutChart, { props: defaultProps })
    const doughnut = wrapper.findComponent({ name: 'Doughnut' })
    const chartData = doughnut.props('data')

    expect(chartData.labels).toEqual(['Alice', 'Bob', 'Charlie'])
    expect(chartData.datasets[0].data).toEqual([30, 20, 10])
  })

  it('applies custom colors', () => {
    const colors = ['#ff0000', '#00ff00', '#0000ff']
    const wrapper = mount(DoughnutChart, {
      props: { ...defaultProps, colors }
    })
    const doughnut = wrapper.findComponent({ name: 'Doughnut' })
    const chartData = doughnut.props('data')

    expect(chartData.datasets[0].backgroundColor).toEqual(colors)
  })

  it('uses default height of 300', () => {
    const wrapper = mount(DoughnutChart, { props: defaultProps })
    const container = wrapper.find('div')
    expect(container.attributes('style')).toContain('height: 300px')
  })

  it('accepts custom height', () => {
    const wrapper = mount(DoughnutChart, {
      props: { ...defaultProps, height: 400 }
    })
    const container = wrapper.find('div')
    expect(container.attributes('style')).toContain('height: 400px')
  })

  it('configures legend on the right', () => {
    const wrapper = mount(DoughnutChart, { props: defaultProps })
    const doughnut = wrapper.findComponent({ name: 'Doughnut' })
    const options = doughnut.props('options')

    expect(options.plugins.legend.position).toBe('right')
  })

  it('emits slice-click when onClick fires', () => {
    const wrapper = mount(DoughnutChart, { props: defaultProps })
    const doughnut = wrapper.findComponent({ name: 'Doughnut' })
    const options = doughnut.props('options')

    // Simulate Chart.js onClick callback
    const mockElements = [{ index: 1 }]
    options.onClick({}, mockElements)

    expect(wrapper.emitted('slice-click')).toHaveLength(1)
    expect(wrapper.emitted('slice-click')[0]).toEqual(['Bob'])
  })

  it('does not emit slice-click when clicking empty area', () => {
    const wrapper = mount(DoughnutChart, { props: defaultProps })
    const doughnut = wrapper.findComponent({ name: 'Doughnut' })
    const options = doughnut.props('options')

    // Simulate clicking empty area (no elements)
    options.onClick({}, [])

    expect(wrapper.emitted('slice-click')).toBeUndefined()
  })

  it('cycles colors when more labels than colors', () => {
    const wrapper = mount(DoughnutChart, {
      props: {
        labels: ['A', 'B', 'C'],
        data: [1, 2, 3],
        colors: ['#ff0000', '#00ff00']
      }
    })
    const doughnut = wrapper.findComponent({ name: 'Doughnut' })
    const chartData = doughnut.props('data')
    const bg = chartData.datasets[0].backgroundColor

    expect(bg[0]).toBe('#ff0000')
    expect(bg[1]).toBe('#00ff00')
    expect(bg[2]).toBe('#ff0000') // cycles back
  })
})
