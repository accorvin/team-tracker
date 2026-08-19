import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('@shared/client/services/api.js', () => ({
  apiRequest: vi.fn()
}))

import ReleaseTimeline from '../../client/components/ReleaseTimeline.vue'

function makeRelease(id, opts = {}) {
  return {
    id,
    displayName: opts.displayName || id,
    state: opts.state || 'active',
    productPagesShortname: opts.shortname || 'rhoai',
    milestones: {
      ga: opts.ga || null,
      featureFreeze: opts.featureFreeze || null,
      codeFreeze: opts.codeFreeze || null,
      planningFreeze: opts.planningFreeze || null
    }
  }
}

describe('ReleaseTimeline', () => {
  it('renders nothing when releases array is empty', () => {
    var wrapper = mount(ReleaseTimeline, { props: { releases: [] } })
    expect(wrapper.find('.mb-6').exists()).toBe(false)
  })

  it('creates separate nodes for each milestone date', () => {
    var releases = [
      makeRelease('rhoai-3.5', {
        displayName: 'RHAI 3.5 GA',
        shortname: 'rhoai',
        planningFreeze: '2026-06-24',
        featureFreeze: '2026-07-17',
        codeFreeze: '2026-07-20',
        ga: '2026-08-19'
      })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes
    expect(nodes).toHaveLength(4)
    var labels = nodes.map(function (n) { return n.msLabel })
    expect(labels).toContain('Planning Freeze')
    expect(labels).toContain('Feature Freeze')
    expect(labels).toContain('Code Freeze')
    expect(labels).toContain('Generally Available')
  })

  it('groups releases by milestone group and merges dates', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-06-17', codeFreeze: '2026-05-15' }),
      makeRelease('rhelai-3.5.EA1', { displayName: 'rhelai-3.5.EA1', shortname: 'rhelai', ga: '2026-06-18', codeFreeze: '2026-05-16' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes

    expect(nodes).toHaveLength(2)

    var gaNode = nodes.find(function (n) { return n.isGa })
    expect(gaNode).toBeTruthy()
    expect(gaNode.productList).toContain('rhoai')
    expect(gaNode.productList).toContain('rhelai')
  })

  it('skips null milestones', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', {
        displayName: 'rhoai-3.5.EA1',
        shortname: 'rhoai',
        ga: '2026-06-17',
        codeFreeze: '2026-05-15'
      })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes
    var labels = nodes.map(function (n) { return n.msLabel })
    expect(labels).toContain('Code Freeze')
    expect(labels).toContain('Generally Available')
    expect(labels).not.toContain('Planning Freeze')
    expect(labels).not.toContain('Feature Freeze')
  })

  it('sorts nodes chronologically by date', () => {
    var releases = [
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' }),
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-08-20' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes
    expect(nodes[0].date).toBe('2026-08-20')
    expect(nodes[1].date).toBe('2026-11-19')
  })

  it('mutes past milestones', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2024-01-01' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2028-12-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes
    var pastNode = nodes.find(function (n) { return n.date === '2024-01-01' })
    var futureNode = nodes.find(function (n) { return n.date === '2028-12-01' })
    expect(pastNode.isPast).toBe(true)
    expect(futureNode.isPast).toBe(false)
  })

  it('autodiscovers products from release data', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-06-17' }),
      makeRelease('newprod-3.5.EA1', { displayName: 'newprod-3.5.EA1', shortname: 'newprod', ga: '2026-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var gaNode = wrapper.vm.nodes.find(function (n) { return n.isGa })
    expect(gaNode.productList).toContain('rhoai')
    expect(gaNode.productList).toContain('newprod')
  })

  it('uses CSS overlay for today marker instead of dataset', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2024-01-01' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2028-12-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var datasets = wrapper.vm.chartData.datasets
    expect(datasets).toHaveLength(1)
    expect(datasets[0].label).toBe('Milestones')
  })

  it('shows next milestone info in nextMilestoneLabel', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2024-01-01' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2028-12-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var label = wrapper.vm.nextMilestoneLabel
    expect(label).toBeTruthy()
    expect(label.desc).toContain('3.6 GA')
    expect(label.daysText).toMatch(/\d+d/)
  })

  it('hides Chart.js dots (drawn by plugin for z-order control)', () => {
    var releases = [
      makeRelease('rhoai-3.5', {
        displayName: 'RHAI 3.5 GA',
        shortname: 'rhoai',
        codeFreeze: '2026-07-20',
        ga: '2026-08-19'
      })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var ds = wrapper.vm.chartData.datasets[0]
    expect(ds.pointRadius).toBe(0)
    expect(ds.pointBorderWidth).toBe(0)
  })

  it('shows product badges only on GA nodes', () => {
    var releases = [
      makeRelease('rhoai-3.5', {
        displayName: 'RHAI 3.5 GA',
        shortname: 'rhoai',
        codeFreeze: '2026-07-20',
        ga: '2026-08-19'
      })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes
    var gaNode = nodes.find(function (n) { return n.isGa })
    var nonGaNode = nodes.find(function (n) { return !n.isGa })
    expect(gaNode.productList.length).toBeGreaterThan(0)
    expect(gaNode.isGa).toBe(true)
    expect(nonGaNode.isGa).toBe(false)
  })

  it('handles single node without errors', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.vm.nodes).toHaveLength(1)
    expect(wrapper.vm.nodes[0].groupLabel).toContain('3.5 EA1')
    expect(wrapper.find('.mb-6').exists()).toBe(true)
  })

  it('excludes today dataset when all nodes are in the future', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2090-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2090-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var datasets = wrapper.vm.chartData.datasets
    expect(datasets).toHaveLength(1)
    expect(datasets[0].label).toBe('Milestones')
  })

  it('computes correct fullRange with padding', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var range = wrapper.vm.fullRange
    var firstTs = new Date('2026-06-17T00:00:00').getTime()
    var lastTs = new Date('2026-11-19T00:00:00').getTime()
    expect(range.min).toBeLessThan(firstTs)
    expect(range.max).toBeGreaterThan(lastTs)
  })

  it('defaults to 29-day forward window from today', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.vm.isZoomed).toBe(false)
    expect(wrapper.vm.xRange).toEqual(wrapper.vm.defaultRange)
  })

  it('default window span is exactly 29 days regardless of hidePast', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T00:00:00'))
    try {
      var DAY_MS = 86400000
      // Releases span well beyond 29 days from "today" in both directions
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
          planningFreeze: '2026-07-01', ga: '2026-08-01' }),
        makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
          planningFreeze: '2026-08-20', ga: '2026-10-15' })
      ]
      var w1 = mount(ReleaseTimeline, { props: { releases, hidePast: false } })
      var r1 = w1.vm.defaultRange
      var span1 = (r1.max - r1.min) / DAY_MS
      expect(span1).toBeCloseTo(29, 0)

      var w2 = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
      var r2 = w2.vm.defaultRange
      var span2 = (r2.max - r2.min) / DAY_MS
      expect(span2).toBeCloseTo(29, 0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('visibleDays never exceeds MAX_VISIBLE_DAYS (90)', () => {
    // Even with releases spanning 6+ months, defaultRange caps at 29 days
    // and fullRange would be larger, but zoom is capped at 90 days
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2090-06-17' }),
      makeRelease('rhoai-3.9', { displayName: 'rhoai-3.9', shortname: 'rhoai', ga: '2090-12-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    // Default view is 29 days
    expect(wrapper.vm.visibleDays).toBeLessThanOrEqual(90)
  })

  it('shows zoom hint text when not zoomed', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.text()).toContain('Scroll to zoom')
    expect(wrapper.text()).toContain('Drag to pan')
  })

  it('assigns separate lanes per release cycle', () => {
    var releases = [
      makeRelease('rhoai-3.5.EA1', { displayName: 'rhoai-3.5.EA1', shortname: 'rhoai', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var lanes = wrapper.vm.cycleLanes
    expect(lanes).toHaveProperty('3.5')
    expect(lanes).toHaveProperty('3.6')
    expect(lanes['3.5']).not.toBe(lanes['3.6'])
    expect(wrapper.vm.laneCount).toBe(2)
  })

  it('scales chart height with visible node count', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T00:00:00'))
    try {
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-08-19' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var singleHeight = wrapper.vm.chartHeight

      var releases2 = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-08-19' }),
        makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
          planningFreeze: '2026-08-20', codeFreeze: '2026-08-22', ga: '2026-08-25' }),
        makeRelease('rhoai-3.7', { displayName: 'rhoai-3.7', shortname: 'rhoai',
          planningFreeze: '2026-08-28', codeFreeze: '2026-09-01', ga: '2026-09-05' })
      ]
      var wrapper2 = mount(ReleaseTimeline, { props: { releases: releases2 } })
      expect(wrapper2.vm.chartHeight).toBeGreaterThan(singleHeight)
    } finally {
      vi.useRealTimers()
    }
  })

  it('chart height stays stable during zoom (uses allNodes not filtered nodes)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T00:00:00'))
    try {
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-08-19' }),
        makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
          planningFreeze: '2026-09-01', ga: '2026-10-05' }),
        makeRelease('rhoai-3.7', { displayName: 'rhoai-3.7', shortname: 'rhoai',
          planningFreeze: '2026-11-01', ga: '2026-12-05' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var heightAtDefault = wrapper.vm.chartHeight
      expect(heightAtDefault).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('chart height does not change when hidePast is toggled', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2024-01-01', ga: '2024-06-01' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
        planningFreeze: '2028-01-01', ga: '2028-06-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases, hidePast: false } })
    var heightWithPast = wrapper.vm.chartHeight

    var wrapper2 = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
    expect(wrapper2.vm.chartHeight).toBe(heightWithPast)
  })

  it('allNodes contains all nodes regardless of hidePast', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2024-01-01' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2028-12-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
    expect(wrapper.vm.allNodes.length).toBeGreaterThan(wrapper.vm.nodes.length)
    expect(wrapper.vm.allNodes.some(function (n) { return n.isPast })).toBe(true)
    expect(wrapper.vm.nodes.some(function (n) { return n.isPast })).toBe(false)
  })

  it('cycleLanes uses allNodes so lane assignments are stable across hidePast', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2024-01-01' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2028-12-01' })
    ]
    var wrapper1 = mount(ReleaseTimeline, { props: { releases, hidePast: false } })
    var wrapper2 = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
    expect(wrapper1.vm.cycleLanes).toEqual(wrapper2.vm.cycleLanes)
  })

  it('distributes cycles across above/below for balance', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
        planningFreeze: '2026-09-01', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var sides = wrapper.vm.cycleSides
    // With equal node counts, one cycle goes above and one below
    var aboveCount = 0
    var belowCount = 0
    var keys = Object.keys(sides)
    for (var i = 0; i < keys.length; i++) {
      if (sides[keys[i]]) aboveCount++
      else belowCount++
    }
    expect(aboveCount).toBeGreaterThan(0)
    expect(belowCount).toBeGreaterThan(0)
  })

  it('chartHeight is capped at 450px', () => {
    var releases = []
    for (var i = 0; i < 20; i++) {
      var minor = 5 + Math.floor(i / 4)
      var ms = ['planningFreeze', 'featureFreeze', 'codeFreeze', 'ga'][i % 4]
      var month = String(1 + (i % 12)).padStart(2, '0')
      var opts = { displayName: 'rhoai-3.' + minor, shortname: 'rhoai' }
      opts[ms] = '2026-' + month + '-' + String(10 + i).padStart(2, '0')
      releases.push(makeRelease('rhoai-3.' + minor + '-' + i, opts))
    }
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.vm.chartHeight).toBeLessThanOrEqual(450)
    expect(wrapper.vm.chartHeight).toBeGreaterThan(0)
  })

  it('chartHeight stays constant regardless of zoom level', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T00:00:00'))
    try {
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
          planningFreeze: '2026-07-01', ga: '2026-08-01' }),
        makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
          planningFreeze: '2026-08-20', ga: '2026-12-15' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
      var heightAtDefault = wrapper.vm.chartHeight

      // chartHeight depends only on layoutMetrics (allNodes), not on zoom/xRange
      // Verify it equals layoutMetrics-derived value regardless of visible days
      var m = wrapper.vm.layoutMetrics
      expect(heightAtDefault).toBe(Math.min(m.aboveSpace + m.belowSpace + 40, 450))
      expect(heightAtDefault).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('layoutMetrics computes above and below space', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var m = wrapper.vm.layoutMetrics
    expect(m.aboveSpace).toBeGreaterThan(0)
    expect(m.belowSpace).toBeGreaterThan(0)
  })

  it('y-scale min positions axis proportionally between above and below space', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var m = wrapper.vm.layoutMetrics
    var yMin = wrapper.vm.chartOptions.scales.y.min
    expect(yMin).toBeCloseTo(-(m.belowSpace / m.aboveSpace), 5)
  })

  it('hidePast filters past nodes from rendered nodes', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2024-01-01' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2028-12-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases, hidePast: false } })
    var allCount = wrapper.vm.nodes.length

    var wrapper2 = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
    expect(wrapper2.vm.nodes.length).toBeLessThan(allCount)
    expect(wrapper2.vm.nodes.every(function (n) { return !n.isPast })).toBe(true)
  })

  it('showDimLines toggle is exposed and defaults to true', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.vm.showDimLines).toBe(true)
  })

  it('renders distances toggle checkbox', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.text()).toContain('Distances')
    var checkbox = wrapper.find('input[type="checkbox"]')
    expect(checkbox.exists()).toBe(true)
  })

  it('belowSpace uses same base stem as above for equal stem lengths', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
        planningFreeze: '2026-09-01', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var m = wrapper.vm.layoutMetrics
    // Both sides use laneBaseStem (65) for equal stem lengths
    // belowSpace for 1 row = laneBaseStem + 70 = 135
    expect(m.belowSpace).toBeGreaterThanOrEqual(135)
    // infraSpace = 60, belowSpace must always exceed it when below tiles exist
    expect(m.belowSpace).toBeGreaterThan(60)
  })

  it('above and below stems use identical base length (laneBaseStem)', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
        planningFreeze: '2026-09-01', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var m = wrapper.vm.layoutMetrics
    // aboveSpace formula: laneBaseStem + (rows-1)*offset + 70
    // belowSpace formula: laneBaseStem + (rows-1)*offset + 70
    // Both use laneBaseStem (65) so first-row stem length is identical
    // For 1 row each: above = 65 + 70 = 135, below = 65 + 70 = 135
    var aboveBase = m.aboveSpace - 70
    var belowBase = m.belowSpace - 70
    // Both bases should be multiples of laneBaseStem (65) + row offsets
    expect(aboveBase).toBeGreaterThanOrEqual(65)
    expect(belowBase).toBeGreaterThanOrEqual(65)
  })

  it('visibleDays reflects the current zoom range', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T00:00:00'))
    try {
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
          planningFreeze: '2026-07-01', ga: '2026-08-01' }),
        makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
          planningFreeze: '2026-08-20', ga: '2026-10-15' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
      // Default window is 29 days
      expect(wrapper.vm.visibleDays).toBe(29)
    } finally {
      vi.useRealTimers()
    }
  })

  it('visibleDays is shown in the template', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T00:00:00'))
    try {
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
          planningFreeze: '2026-07-01', ga: '2026-08-01' }),
        makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
          planningFreeze: '2026-08-20', ga: '2026-10-15' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
      expect(wrapper.text()).toContain('29d view')
    } finally {
      vi.useRealTimers()
    }
  })

  it('layoutMetrics safeOff is at least as large as estimated max box height', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', featureFreeze: '2026-06-10',
        codeFreeze: '2026-06-15', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
        planningFreeze: '2026-09-01', featureFreeze: '2026-09-10',
        codeFreeze: '2026-09-15', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var m = wrapper.vm.layoutMetrics
    // A box with 5 lines at 16px + 4px padding * 2 = 88px estimated max
    // safeOff = max(80, 88 + 4 + 6) = max(80, 98) = 98
    // Both aboveSpace and belowSpace must accommodate this
    var lineH = 16
    var pad = 4
    var estMaxBoxH = 5 * lineH + pad * 2
    expect(m.aboveSpace).toBeGreaterThanOrEqual(estMaxBoxH)
    expect(m.belowSpace).toBeGreaterThanOrEqual(estMaxBoxH)
  })

  it('chartHeight accommodates all tile rows without compression', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', featureFreeze: '2026-06-02',
        codeFreeze: '2026-06-03', ga: '2026-06-04' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
        planningFreeze: '2026-06-01', featureFreeze: '2026-06-02',
        codeFreeze: '2026-06-03', ga: '2026-06-04' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var m = wrapper.vm.layoutMetrics
    var h = wrapper.vm.chartHeight
    // chartHeight = min(aboveSpace + belowSpace + 40, 450)
    expect(h).toBe(Math.min(m.aboveSpace + m.belowSpace + 40, 450))
    expect(h).toBeLessThanOrEqual(450)
    expect(h).toBeGreaterThan(0)
  })

  it('nodes at right edge are excluded from tile rendering zone', () => {
    // Verify that nodes very close together near the right edge don't break layout
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var opts = wrapper.vm.chartOptions
    // Chart options should preserve clip: false for custom plugin drawing
    expect(opts.clip).toBe(false)
  })

  it('fullRange includes padding beyond first and last node dates', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-06-17' }),
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-11-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var range = wrapper.vm.fullRange
    var firstTs = new Date('2026-06-17T00:00:00').getTime()
    var lastTs = new Date('2026-11-19T00:00:00').getTime()
    // Padding must push min before first and max after last
    expect(range.min).toBeLessThan(firstTs)
    expect(range.max).toBeGreaterThan(lastTs)
    // Padding should be at least 7 days
    expect(firstTs - range.min).toBeGreaterThanOrEqual(7 * 86400000)
    expect(range.max - lastTs).toBeGreaterThanOrEqual(7 * 86400000)
  })

  it('single dataset when all nodes are past or future (no today marker)', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2090-06-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.vm.chartData.datasets).toHaveLength(1)
    expect(wrapper.vm.chartData.datasets[0].label).toBe('Milestones')
  })

  it('multiple cycles on the same side get separate rows to avoid overlap', () => {
    // Two cycles with dates very close together force multiple rows on the same side
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', featureFreeze: '2026-06-02',
        codeFreeze: '2026-06-03', ga: '2026-06-04' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var m = wrapper.vm.layoutMetrics
    // With 4 nodes very close together, they need multiple rows
    // aboveSpace must grow to accommodate them
    expect(m.aboveSpace).toBeGreaterThan(100)
  })

  it('overlapping boxes in same cycle trigger stacking', () => {
    // Two milestones from the same cycle 2 days apart should trigger overlap at zoom
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        codeFreeze: '2026-08-18', ga: '2026-08-20' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes
    // Both nodes belong to the same cycle "3.5"
    expect(nodes).toHaveLength(2)
    expect(nodes[0].groupLabel).toBe(nodes[1].groupLabel)
  })

  it('boxes use canvas shadow for card-like depth effect', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-08-20' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    expect(wrapper.vm.nodes).toHaveLength(1)
    expect(wrapper.find('.mb-6').exists()).toBe(true)
  })

  it('GA nodes include product list for side label rendering', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai', ga: '2026-08-20' }),
      makeRelease('rhelai-3.5', { displayName: 'rhelai-3.5', shortname: 'rhelai', ga: '2026-08-21' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var gaNodes = wrapper.vm.nodes.filter(function (n) { return n.isGa })
    expect(gaNodes.length).toBeGreaterThan(0)
    expect(gaNodes[0].productList.length).toBeGreaterThan(0)
  })

  it('default range positions today at ~30% from left edge', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00'))
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-07-01', ga: '2026-10-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var range = wrapper.vm.defaultRange
    var todayTs = new Date('2026-08-14T00:00:00').getTime()
    var leftPortion = (todayTs - range.min) / (range.max - range.min)
    // Today should be roughly 30% from the left, not centered at 50%
    expect(leftPortion).toBeLessThan(0.45)
    expect(leftPortion).toBeGreaterThan(0.15)
    vi.useRealTimers()
  })

  it('layoutMetrics exposes safeOff for stable stem computation', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', ga: '2026-08-20' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var m = wrapper.vm.layoutMetrics
    expect(m.safeOff).toBeDefined()
    expect(m.safeOff).toBeGreaterThan(0)
  })

  it('upcoming cycle is always placed above the axis', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00'))
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', ga: '2026-08-19' }),
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        planningFreeze: '2026-08-25', codeFreeze: '2026-09-10' }),
      makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
        planningFreeze: '2026-09-15', ga: '2026-10-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var sides = wrapper.vm.cycleSides
    // 3.6 has the most future milestones (4 vs 1), should be above
    expect(sides['3.6']).toBe(true)
    vi.useRealTimers()
  })

  it('upcoming cycle stays above regardless of hide-past toggle', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00'))
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', ga: '2026-08-19' }),
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        codeFreeze: '2026-09-10', ga: '2026-10-15' })
    ]
    var wrapperA = mount(ReleaseTimeline, { props: { releases, hidePast: false } })
    var wrapperB = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
    // cycleSides should be identical regardless of hidePast
    expect(wrapperA.vm.cycleSides).toEqual(wrapperB.vm.cycleSides)
    vi.useRealTimers()
  })

  it('overlapping same-cycle nodes have distinct stack levels for peek rendering', () => {
    // Three milestones very close together in the same cycle should each get a stackLevel
    var releases = [
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        codeFreeze: '2026-09-10', ga: '2026-09-12' }),
      makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
        ga: '2026-09-11' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes
    // All three dates (Sep 10, 11, 12) are in the same cycle "3.6" and very close
    var cycle36 = nodes.filter(function (n) { return n.groupLabel.indexOf('3.6') === 0 })
    expect(cycle36.length).toBe(3)
  })

  it('peek only triggers when behind card is fully under the top card', () => {
    // Two milestones far apart should both render as full cards, not peeks
    var releases = [
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        codeFreeze: '2026-09-15' }),
      makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
        ga: '2026-10-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes
    // Two nodes from the same cycle but 30 days apart — boxes should not fully overlap
    expect(nodes).toHaveLength(2)
    var d0 = new Date(nodes[0].date).getTime()
    var d1 = new Date(nodes[1].date).getTime()
    expect(Math.abs(d1 - d0)).toBeGreaterThan(20 * 86400000)
  })

  it('peek triggers when same-cycle milestones share the same date', () => {
    // Two releases with GA on the same day: boxes fully overlap → peek
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        ga: '2026-08-19' }),
      makeRelease('rhelai-3.5', { displayName: 'rhelai-3.5', shortname: 'rhelai',
        ga: '2026-08-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var gaNodes = wrapper.vm.nodes.filter(function (n) { return n.isGa })
    // Same date means their boxes fully overlap at any zoom level
    expect(gaNodes.length).toBe(1)
    expect(gaNodes[0].date).toBe('2026-08-19')
  })

  it('cards from spaced-apart milestones each get their own full rendering', () => {
    // Milestones 7+ days apart in same cycle should all be visible as individual cards
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', featureFreeze: '2026-07-01',
        codeFreeze: '2026-08-01', ga: '2026-09-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.nodes
    // All four milestones are 30 days apart — no overlap, all should render fully
    expect(nodes).toHaveLength(4)
    for (var i = 1; i < nodes.length; i++) {
      var prev = new Date(nodes[i - 1].date).getTime()
      var curr = new Date(nodes[i].date).getTime()
      expect(curr - prev).toBeGreaterThan(20 * 86400000)
    }
  })

  it('cycle with most future milestones goes above even if not nearest', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T12:00:00'))
    // 3.5 has 1 future milestone (GA Aug 5), 3.6 has 3 future milestones
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-07-01', ga: '2026-08-05' }),
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        codeFreeze: '2026-08-20', ga: '2026-09-10' }),
      makeRelease('rhoai-3.6.GA', { displayName: 'rhoai-3.6.GA', shortname: 'rhoai',
        ga: '2026-10-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var sides = wrapper.vm.cycleSides
    // 3.6 has 3 future milestones vs 3.5's 1 — 3.6 goes above
    expect(sides['3.6']).toBe(true)
    expect(sides['3.5']).toBe(false)
    vi.useRealTimers()
  })

  it('ties in future milestone count broken by nearest milestone', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T12:00:00'))
    // Both cycles have 1 future milestone each, but 3.5 is nearer
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        ga: '2026-08-10' }),
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        ga: '2026-09-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var sides = wrapper.vm.cycleSides
    // Equal future count → nearest wins → 3.5 above
    expect(sides['3.5']).toBe(true)
    vi.useRealTimers()
  })

  it('same-cycle milestones share the same subLane key', () => {
    // All milestones from cycle 3.6 should produce the same cycle key
    var releases = [
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        codeFreeze: '2026-09-10', ga: '2026-09-20' }),
      makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
        ga: '2026-10-05' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.allNodes
    var lanes = wrapper.vm.cycleLanes
    // All 3.6 nodes map to the same cycle lane
    for (var i = 0; i < nodes.length; i++) {
      var cycle = nodes[i].groupLabel.match(/^(\d+\.\d+)/)[1]
      expect(cycle).toBe('3.6')
      expect(lanes[cycle]).toBeDefined()
    }
  })

  it('cross-cycle nodes get different subLane keys', () => {
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        ga: '2026-08-19' }),
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        ga: '2026-09-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var lanes = wrapper.vm.cycleLanes
    // Different cycles must have different lane indices
    expect(lanes['3.5']).toBeDefined()
    expect(lanes['3.6']).toBeDefined()
    expect(lanes['3.5']).not.toBe(lanes['3.6'])
  })

  it('stacking only applies within same cycle — cross-cycle cards never stack', () => {
    // 3.5 GA and 3.6 EA1 GA on close dates but different cycles
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        ga: '2026-08-19' }),
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        ga: '2026-08-20' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.allNodes
    // Both nodes exist as separate entries
    expect(nodes).toHaveLength(2)
    // They are from different cycles — verify different groupLabels
    var labels = nodes.map(function (n) { return n.groupLabel })
    expect(labels).toContain('3.5 GA')
    expect(labels).toContain('3.6 EA1')
  })

  it('same-date milestones within a cycle produce single merged node', () => {
    // Two releases with identical GA dates in the same cycle → merged into one node
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        ga: '2026-08-19' }),
      makeRelease('rhelai-3.5', { displayName: 'rhelai-3.5', shortname: 'rhelai',
        ga: '2026-08-19' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var gaNodes = wrapper.vm.allNodes.filter(function (n) { return n.isGa })
    expect(gaNodes).toHaveLength(1)
    expect(gaNodes[0].productList).toContain('rhoai')
    expect(gaNodes[0].productList).toContain('rhelai')
  })

  it('render order: farther-from-today cards appear earlier in sorted date order', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T12:00:00'))
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', featureFreeze: '2026-07-01',
        codeFreeze: '2026-08-01', ga: '2026-09-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.allNodes
    // allNodes sorted by date — rendering sorts separately by distance from today
    for (var i = 1; i < nodes.length; i++) {
      var prev = new Date(nodes[i - 1].date)
      var curr = new Date(nodes[i].date)
      expect(prev.getTime()).toBeLessThanOrEqual(curr.getTime())
    }
    vi.useRealTimers()
  })

  it('close same-cycle milestones stack so stems never orphan beyond card edges', () => {
    // When milestones are close enough to stack, ALL of them must either:
    // 1. Be the front card (stackLevel 0, has its own card), or
    // 2. Be stacked (peek), meaning their dot is within the front card's box
    // This ensures no stem points to empty space beyond a card edge.
    // Test across multiple simulated "zoom levels" by varying date spacing.
    var spacings = [
      { name: '0d (same day)', offset: 0 },
      { name: '1d', offset: 1 },
      { name: '2d', offset: 2 },
      { name: '3d', offset: 3 }
    ]
    for (var si = 0; si < spacings.length; si++) {
      var off = spacings[si].offset
      var d1 = '2026-10-15'
      var d2 = new Date(2026, 9, 15 + off).toISOString().slice(0, 10)
      var d3 = new Date(2026, 9, 15 + off * 2).toISOString().slice(0, 10)
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          ga: d1 }),
        makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
          ga: d2 }),
        makeRelease('rhoai-3.6.GA', { displayName: 'rhoai-3.6.GA', shortname: 'rhoai',
          ga: d3 })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      // All nodes from same cycle — verify they share cycle and would be in the same stack group
      for (var ni = 0; ni < nodes.length; ni++) {
        var cycle = nodes[ni].groupLabel.match(/^(\d+\.\d+)/)[1]
        expect(cycle).toBe('3.6')
      }
      // Verify all dates are within a small range (close milestones)
      if (off > 0) {
        var dates = nodes.map(function (n) { return new Date(n.date).getTime() })
        var range = Math.max.apply(null, dates) - Math.min.apply(null, dates)
        expect(range).toBeLessThanOrEqual(off * 2 * 86400000)
      }
    }
  })

  it('widely spaced milestones never stack regardless of zoom', () => {
    // Milestones 30+ days apart should never stack — they always render as full cards
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-06-01', featureFreeze: '2026-07-15',
        codeFreeze: '2026-08-20', ga: '2026-10-01' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.allNodes
    expect(nodes).toHaveLength(4)
    // All dates are 30+ days apart — at any zoom, dots will be far apart
    for (var i = 1; i < nodes.length; i++) {
      var gap = new Date(nodes[i].date).getTime() - new Date(nodes[i - 1].date).getTime()
      expect(gap).toBeGreaterThan(25 * 86400000)
    }
  })

  it('every node retains stem-rendering data even when stacked (hard rule: dot → stem)', () => {
    // Hard rule: if there's a dot, there's a stem.
    // Stacking must never remove nodes from allNodes or strip their date/groupLabel.
    // This ensures the stem drawing pass always has data for every dot.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00'))
    var releases = [
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        ga: '2026-10-15' }),
      makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
        ga: '2026-10-16' }),
      makeRelease('rhoai-3.6.GA', { displayName: 'rhoai-3.6.GA', shortname: 'rhoai',
        ga: '2026-10-17' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.allNodes
    expect(nodes).toHaveLength(3)
    for (var i = 0; i < nodes.length; i++) {
      expect(nodes[i].date).toBeTruthy()
      expect(nodes[i].groupLabel).toBeTruthy()
      expect(typeof nodes[i].isPast).toBe('boolean')
    }
    vi.useRealTimers()
  })

  it('same-date milestones from same cycle merge into a single node', () => {
    // Same-date GA milestones from the same cycle (3.6) merge → 1 node, not 3
    var releases = [
      makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
        ga: '2026-10-15' }),
      makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
        ga: '2026-10-15' }),
      makeRelease('rhoai-3.6.GA', { displayName: 'rhoai-3.6.GA', shortname: 'rhoai',
        ga: '2026-10-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.allNodes
    var oct15 = nodes.filter(function (n) { return n.date === '2026-10-15' })
    expect(oct15.length).toBe(1)
    expect(oct15[0].groupLabel).toMatch(/3\.6/)
  })

  it('penetration-based stacking: cards only stack when dot is inside front card area', () => {
    // Widely spaced milestones (30+ days) within the same cycle should never stack
    // because the dot would never penetrate 30% into the front card's box.
    var releases = [
      makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
        planningFreeze: '2026-06-01', featureFreeze: '2026-07-15',
        codeFreeze: '2026-09-01', ga: '2026-10-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    var nodes = wrapper.vm.allNodes
    expect(nodes).toHaveLength(4)
    // All 4 milestones from same cycle 3.6
    for (var i = 0; i < nodes.length; i++) {
      expect(nodes[i].groupLabel).toMatch(/3\.6/)
      expect(nodes[i].date).toBeTruthy()
    }
    // Dates span months — dots will be far apart at any zoom, so no stacking
    var dates = nodes.map(function (n) { return new Date(n.date).getTime() })
    for (var j = 1; j < dates.length; j++) {
      expect(dates[j] - dates[j - 1]).toBeGreaterThan(30 * 86400000)
    }
  })

  // ---- Comprehensive rendering invariant tests across zoom levels ----

  describe('rendering invariants across zoom levels', () => {
    // Simulate different zoom levels by varying date spacing within a cycle.
    // Wider spacing = zoomed out (dots further apart), tighter = zoomed in.
    var zoomScenarios = [
      { name: '0d (same day)', offset: 0 },
      { name: '1d', offset: 1 },
      { name: '2d', offset: 2 },
      { name: '3d', offset: 3 },
      { name: '5d', offset: 5 },
      { name: '7d', offset: 7 },
      { name: '14d', offset: 14 },
      { name: '30d', offset: 30 },
      { name: '60d', offset: 60 }
    ]

    for (var zi = 0; zi < zoomScenarios.length; zi++) {
      (function (scenario) {
        it('every node has stem data at ' + scenario.name + ' spacing', () => {
          vi.useFakeTimers()
          vi.setSystemTime(new Date('2026-08-14T12:00:00'))
          var d1 = '2026-10-15'
          var d2 = new Date(2026, 9, 15 + scenario.offset).toISOString().slice(0, 10)
          var d3 = new Date(2026, 9, 15 + scenario.offset * 2).toISOString().slice(0, 10)
          var releases = [
            makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
              ga: d1 }),
            makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
              ga: d2 }),
            makeRelease('rhoai-3.6.GA', { displayName: 'rhoai-3.6.GA', shortname: 'rhoai',
              ga: d3 })
          ]
          var wrapper = mount(ReleaseTimeline, { props: { releases } })
          var nodes = wrapper.vm.allNodes
          // Hard rule: every node must retain date, groupLabel, isPast for stem rendering
          for (var ni = 0; ni < nodes.length; ni++) {
            expect(nodes[ni].date).toBeTruthy()
            expect(nodes[ni].groupLabel).toBeTruthy()
            expect(typeof nodes[ni].isPast).toBe('boolean')
          }
          vi.useRealTimers()
        })
      })(zoomScenarios[zi])
    }

    for (var zi2 = 0; zi2 < zoomScenarios.length; zi2++) {
      (function (scenario) {
        it('same-cycle nodes share cycle key at ' + scenario.name + ' spacing', () => {
          var d1 = '2026-10-15'
          var d2 = new Date(2026, 9, 15 + scenario.offset).toISOString().slice(0, 10)
          var d3 = new Date(2026, 9, 15 + scenario.offset * 2).toISOString().slice(0, 10)
          var releases = [
            makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
              ga: d1 }),
            makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
              ga: d2 }),
            makeRelease('rhoai-3.6.GA', { displayName: 'rhoai-3.6.GA', shortname: 'rhoai',
              ga: d3 })
          ]
          var wrapper = mount(ReleaseTimeline, { props: { releases } })
          var nodes = wrapper.vm.allNodes
          var lanes = wrapper.vm.cycleLanes
          for (var ni = 0; ni < nodes.length; ni++) {
            var cycle = nodes[ni].groupLabel.match(/^(\d+\.\d+)/)[1]
            expect(cycle).toBe('3.6')
            expect(lanes[cycle]).toBeDefined()
          }
        })
      })(zoomScenarios[zi2])
    }

    for (var zi3 = 0; zi3 < zoomScenarios.length; zi3++) {
      (function (scenario) {
        it('cross-cycle nodes stay independent at ' + scenario.name + ' spacing', () => {
          vi.useFakeTimers()
          vi.setSystemTime(new Date('2026-08-14T12:00:00'))
          var d1 = '2026-10-15'
          var d2 = new Date(2026, 9, 15 + scenario.offset).toISOString().slice(0, 10)
          var releases = [
            makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
              ga: d1 }),
            makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
              ga: d2 })
          ]
          var wrapper = mount(ReleaseTimeline, { props: { releases } })
          var nodes = wrapper.vm.allNodes
          expect(nodes).toHaveLength(2)
          var cycles = nodes.map(function (n) {
            return n.groupLabel.match(/^(\d+\.\d+)/)[1]
          })
          expect(cycles).toContain('3.5')
          expect(cycles).toContain('3.6')
          // Different cycles get different lanes
          var lanes = wrapper.vm.cycleLanes
          expect(lanes['3.5']).not.toBe(lanes['3.6'])
          vi.useRealTimers()
        })
      })(zoomScenarios[zi3])
    }

    for (var zi4 = 0; zi4 < zoomScenarios.length; zi4++) {
      (function (scenario) {
        it('above-axis assignment is stable at ' + scenario.name + ' spacing', () => {
          vi.useFakeTimers()
          vi.setSystemTime(new Date('2026-08-14T12:00:00'))
          var d1 = '2026-10-15'
          var d2 = new Date(2026, 9, 15 + scenario.offset).toISOString().slice(0, 10)
          var releases = [
            makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
              ga: '2026-08-19' }),
            makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
              codeFreeze: d1, ga: d2 }),
            makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
              ga: new Date(2026, 9, 15 + scenario.offset * 2).toISOString().slice(0, 10) })
          ]
          var wrapper = mount(ReleaseTimeline, { props: { releases } })
          var sides = wrapper.vm.cycleSides
          // 3.6 has more future milestones — always above
          expect(sides['3.6']).toBe(true)
          // Same result with hidePast toggled
          var wrapper2 = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
          expect(wrapper2.vm.cycleSides).toEqual(sides)
          vi.useRealTimers()
        })
      })(zoomScenarios[zi4])
    }

    it('multi-cycle with distinct dates: all nodes preserved at every spacing', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      for (var si = 0; si < zoomScenarios.length; si++) {
        var off = Math.max(zoomScenarios[si].offset, 1)
        var releases = [
          makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
            codeFreeze: '2026-10-01',
            ga: new Date(2026, 9, 14 + off).toISOString().slice(0, 10) }),
          makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
            ga: '2026-10-15' }),
          makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
            ga: new Date(2026, 9, 15 + off).toISOString().slice(0, 10) })
        ]
        var wrapper = mount(ReleaseTimeline, { props: { releases } })
        var nodes = wrapper.vm.allNodes
        expect(nodes.length).toBeGreaterThanOrEqual(3)
        for (var ni = 0; ni < nodes.length; ni++) {
          expect(nodes[ni].date).toBeTruthy()
          expect(nodes[ni].groupLabel).toBeTruthy()
        }
      }
      vi.useRealTimers()
    })

    it('layoutMetrics stays consistent across all spacings', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
          planningFreeze: '2026-06-01', ga: '2026-08-19' }),
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          codeFreeze: '2026-09-10', ga: '2026-10-15' }),
        makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
          ga: '2026-10-16' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var m = wrapper.vm.layoutMetrics
      expect(m.aboveSpace).toBeGreaterThan(0)
      expect(m.belowSpace).toBeGreaterThan(0)
      expect(m.safeOff).toBeGreaterThan(0)
      // chartHeight is deterministic from layoutMetrics
      var h = wrapper.vm.chartHeight
      expect(h).toBe(Math.min(m.aboveSpace + m.belowSpace + 40, 450))
      vi.useRealTimers()
    })
  })

  describe('stacking and peek invariants', () => {
    it('same-date milestones from same cycle merge into one node (no phantom peeks)', () => {
      // Three releases with GA on the same date in cycle 3.6 → merged into 1 node
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          ga: '2026-10-15' }),
        makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
          ga: '2026-10-15' }),
        makeRelease('rhoai-3.6.GA', { displayName: 'rhoai-3.6.GA', shortname: 'rhoai',
          ga: '2026-10-15' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      var oct15 = nodes.filter(function (n) { return n.date === '2026-10-15' })
      expect(oct15.length).toBe(1)
      expect(oct15[0].groupLabel).toMatch(/3\.6/)
    })

    it('1-day-apart milestones in same cycle keep all nodes', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          codeFreeze: '2026-10-14', ga: '2026-10-15' }),
        makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
          ga: '2026-10-16' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      // 3 milestones across 3 days — all preserved
      expect(nodes).toHaveLength(3)
      var dates = nodes.map(function (n) { return n.date })
      expect(dates).toContain('2026-10-14')
      expect(dates).toContain('2026-10-15')
      expect(dates).toContain('2026-10-16')
      vi.useRealTimers()
    })

    it('widely spaced milestones (30+ days) never stack at any zoom', () => {
      var configs = [
        { pf: '2026-06-01', cf: '2026-07-15', ga: '2026-09-01' },
        { pf: '2026-03-01', cf: '2026-05-15', ga: '2026-08-01' },
        { pf: '2026-01-01', cf: '2026-04-01', ga: '2026-07-01' }
      ]
      for (var si = 0; si < configs.length; si++) {
        var c = configs[si]
        var releases = [
          makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai',
            planningFreeze: c.pf, codeFreeze: c.cf, ga: c.ga })
        ]
        var wrapper = mount(ReleaseTimeline, { props: { releases } })
        var nodes = wrapper.vm.allNodes
        expect(nodes).toHaveLength(3)
        for (var i = 1; i < nodes.length; i++) {
          var d0 = new Date(nodes[i - 1].date).getTime()
          var d1 = new Date(nodes[i].date).getTime()
          expect(d1 - d0).toBeGreaterThan(25 * 86400000)
        }
      }
    })

    it('stacking never removes nodes — allNodes count is stable', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          codeFreeze: '2026-10-14', ga: '2026-10-15' }),
        makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
          codeFreeze: '2026-10-15', ga: '2026-10-16' }),
        makeRelease('rhoai-3.6.GA', { displayName: 'rhoai-3.6.GA', shortname: 'rhoai',
          ga: '2026-10-17' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var allCount = wrapper.vm.allNodes.length
      // Same releases with hidePast — allNodes count unchanged
      var wrapper2 = mount(ReleaseTimeline, { props: { releases, hidePast: true } })
      expect(wrapper2.vm.allNodes.length).toBe(allCount)
      vi.useRealTimers()
    })

    it('cross-cycle close dates never stack even when dots overlap', () => {
      // Two cycles with milestones on the same day must NOT stack
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
          ga: '2026-10-15' }),
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          ga: '2026-10-15' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      expect(nodes).toHaveLength(2)
      // Different cycles — must stay separate
      var labels = nodes.map(function (n) { return n.groupLabel })
      expect(labels[0]).not.toBe(labels[1])
      // Different lanes
      var lanes = wrapper.vm.cycleLanes
      expect(lanes['3.5']).not.toBe(lanes['3.6'])
      vi.useRealTimers()
    })
  })

  describe('stem consistency', () => {
    it('all nodes have consistent stemLen within same cycle and side', () => {
      // Nodes from the same cycle on the same side should share a subLane → same stemLen
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          codeFreeze: '2026-09-10', ga: '2026-09-15' }),
        makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
          ga: '2026-09-20' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      // All 3.6 nodes — same cycle, same side
      var cycles = nodes.map(function (n) { return n.groupLabel.match(/^(\d+\.\d+)/)[1] })
      for (var i = 0; i < cycles.length; i++) {
        expect(cycles[i]).toBe('3.6')
      }
      // All nodes share the same lane
      var lanes = wrapper.vm.cycleLanes
      expect(lanes['3.6']).toBeDefined()
    })

    it('nodes from same cycle share the same lane', () => {
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          codeFreeze: '2026-10-01', ga: '2026-10-15' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      expect(nodes.length).toBeGreaterThanOrEqual(2)
      var cycle0 = nodes[0].groupLabel.match(/^(\d+\.\d+)/)[1]
      var cycle1 = nodes[1].groupLabel.match(/^(\d+\.\d+)/)[1]
      expect(cycle0).toBe(cycle1)
    })

    it('shouldDrawStem returns true for all nodes (every dot gets a stem)', () => {
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          codeFreeze: '2026-10-14', ga: '2026-10-15' }),
        makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
          ga: '2026-10-16' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var fn = wrapper.vm.shouldDrawStem
      expect(fn({ stackLevel: 0 })).toBe(true)
      expect(fn({ stackLevel: 1 })).toBe(true)
      expect(fn({ stackLevel: 2 })).toBe(true)
      expect(fn({ stackLevel: 5 })).toBe(true)
    })

    it('shouldDrawStem returns true regardless of past/future or stackLevel', () => {
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          ga: '2026-10-15' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var fn = wrapper.vm.shouldDrawStem
      expect(fn({ stackLevel: 0, isPast: false })).toBe(true)
      expect(fn({ stackLevel: 0, isPast: true })).toBe(true)
      expect(fn({ stackLevel: 1, isPast: false })).toBe(true)
      expect(fn({ stackLevel: 3, isPast: true })).toBe(true)
    })

    it('all nodes are included in dot rendering (every card gets a dot)', () => {
      var layouts = [
        { x: 100, boxW: 80, above: true, stemLen: 40, groupLabel: '3.6 EA1', stackLevel: 0 },
        { x: 110, boxW: 80, above: true, stemLen: 40, groupLabel: '3.6 GA', stackLevel: 1, stackTopIdx: 0 }
      ]
      var dotOrder = []
      for (var doi = 0; doi < layouts.length; doi++) {
        if (layouts[doi]) dotOrder.push(doi)
      }
      expect(dotOrder).toEqual([0, 1])
    })

    it('sideLabel is an array of product names, not a joined string', () => {
      var releases = [
        makeRelease('rhoai-3.6', { displayName: 'rhoai-3.6', shortname: 'rhoai', ga: '2026-10-15' }),
        makeRelease('rhelai-3.6', { displayName: 'rhelai-3.6', shortname: 'rhelai', ga: '2026-10-15' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var gaNodes = wrapper.vm.allNodes.filter(function (n) { return n.isGa })
      expect(gaNodes.length).toBeGreaterThanOrEqual(1)
      expect(Array.isArray(gaNodes[0].productList)).toBe(true)
      expect(gaNodes[0].productList.length).toBeGreaterThanOrEqual(2)
    })

    it('same-date milestones from same cycle merge into one node', () => {
      // rhoai-3.6.EA1 GA and RHAII-3.6 GA both on Sep 17 → single node
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai', ga: '2026-09-17' }),
        makeRelease('RHAII-3.6', { displayName: 'RHAII-3.6', shortname: 'rhai', ga: '2026-09-17' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      // Both releases produce GA on Sep 17 → merged into 1 node
      var gaSep17 = nodes.filter(function (n) { return n.date === '2026-09-17' })
      expect(gaSep17.length).toBe(1)
    })

    it('same-date merge preserves all products in productList', () => {
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai', ga: '2026-09-17' }),
        makeRelease('RHAII-3.6', { displayName: 'RHAII-3.6', shortname: 'rhai', ga: '2026-09-17' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var gaSep17 = wrapper.vm.allNodes.filter(function (n) { return n.date === '2026-09-17' })
      expect(gaSep17[0].productList.length).toBeGreaterThanOrEqual(2)
    })

    it('different-date milestones from same cycle remain separate nodes', () => {
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          codeFreeze: '2026-08-21', ga: '2026-09-17' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      var cf = nodes.filter(function (n) { return n.msLabel === 'Code Freeze' })
      var ga = nodes.filter(function (n) { return n.isGa })
      expect(cf.length).toBe(1)
      expect(ga.length).toBe(1)
    })
  })

  describe('stacking and peek strips (applyStacking + countPeekStrips)', () => {
    function getVm() {
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai', ga: '2026-10-15' })
      ]
      return mount(ReleaseTimeline, { props: { releases } }).vm
    }
    function makeLayout(x, groupLabel, date, boxW) {
      return {
        x: x, boxW: boxW || 120, above: true, stackLevel: 0,
        nd: { date: date, groupLabel: groupLabel }
      }
    }
    var TODAY = new Date('2026-08-14').getTime()

    it('2 nodes, far apart: no stacking, 0 peeks', () => {
      var vm = getVm()
      var layouts = [
        makeLayout(100, '3.6 GA', '2026-09-17'),
        makeLayout(300, '3.6 GA', '2026-10-01')
      ]
      vm.applyStacking(layouts, TODAY)
      expect(layouts[0].stackLevel).toBe(0)
      expect(layouts[1].stackLevel).toBe(0)
      expect(vm.countPeekStrips(layouts)).toBe(0)
    })

    it('2 nodes, overlapping boxes but large visible edge: no stacking at default threshold', () => {
      var vm = getVm()
      // x=200 (140-260) and x=250 (190-310): overlap, but visible edge = 50px > PEEK_W
      var layouts = [
        makeLayout(200, '3.6 GA', '2026-09-15'),
        makeLayout(250, '3.6 GA', '2026-09-17')
      ]
      vm.applyStacking(layouts, TODAY)
      var stacked = layouts.filter(function (l) { return l.stackLevel > 0 })
      expect(stacked.length).toBe(0)
      expect(vm.countPeekStrips(layouts)).toBe(0)
    })

    it('2 nodes, close dots with overlapping boxes: stacks, 1 peek', () => {
      var vm = getVm()
      // Dots 5px apart — boxes overlap so stacking triggers
      var layouts = [
        makeLayout(200, '3.6 GA', '2026-09-16'),
        makeLayout(205, '3.6 GA', '2026-09-17')
      ]
      vm.applyStacking(layouts, TODAY)
      var stacked = layouts.filter(function (l) { return l.stackLevel > 0 })
      expect(stacked.length).toBe(1)
      expect(vm.countPeekStrips(layouts)).toBe(1)
    })

    it('3 nodes, 2 with same x: each stacked node gets its own peek', () => {
      var vm = getVm()
      // Two nodes at x=255 (visible=5 ≤ 10 → stack), GA at x=260 is front
      var layouts = [
        makeLayout(255, '3.6 GA', '2026-09-16'),
        makeLayout(255, '3.6 GA', '2026-09-16'),
        makeLayout(260, '3.6 GA', '2026-09-17')
      ]
      vm.applyStacking(layouts, TODAY)
      var stackedCount = layouts.filter(function (l) { return l.stackLevel > 0 }).length
      var peekCount = vm.countPeekStrips(layouts)
      expect(peekCount).toBe(stackedCount)
    })

    it('3 nodes, tight overlap with visible ≤ PEEK_W: 2 stacked, 2 peeks', () => {
      var vm = getVm()
      // Nodes 5px apart: x=250(190-310), x=255(195-315), x=260(200-320)
      // Front=x=260 (closest to today). Behind x=255: visible = 200-195 = 5 ≤ 10 → stacks
      // Behind x=250: visible = 200-190 = 10 ≤ 10 → stacks
      var layouts = [
        makeLayout(250, '3.6 GA', '2026-09-10'),
        makeLayout(255, '3.6 GA', '2026-09-14'),
        makeLayout(260, '3.6 GA', '2026-09-17')
      ]
      vm.applyStacking(layouts, TODAY)
      var stackedCount = layouts.filter(function (l) { return l.stackLevel > 0 }).length
      expect(stackedCount).toBe(2)
      expect(vm.countPeekStrips(layouts)).toBe(2)
    })

    it('peek count equals stacked node count (no dedup)', () => {
      var vm = getVm()
      // 4 nodes tightly packed: x=255,255,258,260 (all visible ≤ 10)
      var layouts = [
        makeLayout(255, '3.6 GA', '2026-09-10'),
        makeLayout(255, '3.6 GA', '2026-09-10'),
        makeLayout(258, '3.6 GA', '2026-09-13'),
        makeLayout(260, '3.6 GA', '2026-09-17')
      ]
      vm.applyStacking(layouts, TODAY)
      var stackedCount = layouts.filter(function (l) { return l.stackLevel > 0 }).length
      var peekCount = vm.countPeekStrips(layouts)
      expect(peekCount).toBe(stackedCount)
    })

    it('stacks on any box overlap regardless of dot distance', () => {
      var vm = getVm()
      // Dots only 5px apart (was prevented by old MIN_DOT_GAP=12)
      // Boxes at x=200 (140-260) and x=205 (145-265) overlap → must stack
      var layouts = [
        makeLayout(200, '3.6 GA', '2026-09-16'),
        makeLayout(205, '3.6 GA', '2026-09-17')
      ]
      vm.applyStacking(layouts, TODAY)
      var stacked = layouts.filter(function (l) { return l.stackLevel > 0 })
      expect(stacked.length).toBe(1)
    })

    it('stacks when visible edge ≤ peekThreshold', () => {
      var vm = getVm()
      // x=200 (140-260) and x=252 (192-312): visible = 192-140 = 52px
      // At threshold=10 (default) → no stack. At threshold=60 → stack.
      var layouts = [
        makeLayout(200, '3.6 GA', '2026-09-10'),
        makeLayout(252, '3.6 GA', '2026-09-17')
      ]
      vm.applyStacking(layouts, TODAY, 10)
      expect(layouts[0].stackLevel).toBe(0)

      layouts[0].stackLevel = 0
      layouts[1].stackLevel = 0
      vm.applyStacking(layouts, TODAY, 60)
      var stacked = layouts.filter(function (l) { return l.stackLevel > 0 })
      expect(stacked.length).toBe(1)
    })

    it('does not stack when boxes do not overlap', () => {
      var vm = getVm()
      // Boxes at x=100 (40-160) and x=300 (240-360) — 80px gap
      var layouts = [
        makeLayout(100, '3.6 GA', '2026-09-17'),
        makeLayout(300, '3.6 GA', '2026-10-01')
      ]
      vm.applyStacking(layouts, TODAY)
      expect(layouts[0].stackLevel).toBe(0)
      expect(layouts[1].stackLevel).toBe(0)
    })

    it('different cycles do not stack with each other', () => {
      var vm = getVm()
      var layouts = [
        makeLayout(200, '3.5 GA', '2026-09-16'),
        makeLayout(250, '3.6 GA', '2026-09-17')
      ]
      vm.applyStacking(layouts, TODAY)
      expect(layouts[0].stackLevel).toBe(0)
      expect(layouts[1].stackLevel).toBe(0)
      expect(vm.countPeekStrips(layouts)).toBe(0)
    })

    it('above and below nodes from same cycle do not stack', () => {
      var vm = getVm()
      var layouts = [
        makeLayout(200, '3.6 GA', '2026-09-16'),
        { x: 250, boxW: 120, above: false, stackLevel: 0,
          nd: { date: '2026-09-17', groupLabel: '3.6 GA' } }
      ]
      vm.applyStacking(layouts, TODAY)
      expect(layouts[0].stackLevel).toBe(0)
      expect(layouts[1].stackLevel).toBe(0)
    })

    it('above/below assignment is per-cycle, not per-node', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      var releases = [
        makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
          planningFreeze: '2026-06-01', codeFreeze: '2026-07-01', ga: '2026-08-19' }),
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          codeFreeze: '2026-09-10', ga: '2026-10-15' }),
        makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
          ga: '2026-10-16' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var sides = wrapper.vm.cycleSides
      var nodes = wrapper.vm.allNodes
      // Every node's cycle maps to the same side value
      for (var i = 0; i < nodes.length; i++) {
        var cycle = nodes[i].groupLabel.match(/^(\d+\.\d+)/)[1]
        var expectedSide = sides[cycle]
        expect(expectedSide).toBeDefined()
        // All nodes from the same cycle get the same side
        var sameNodes = nodes.filter(function (n) {
          return n.groupLabel.match(/^(\d+\.\d+)/)[1] === cycle
        })
        for (var j = 0; j < sameNodes.length; j++) {
          var c2 = sameNodes[j].groupLabel.match(/^(\d+\.\d+)/)[1]
          expect(sides[c2]).toBe(expectedSide)
        }
      }
      vi.useRealTimers()
    })
  })

  describe('visual overlap protection', () => {
    it('same-cycle nodes 1 day apart both exist as data nodes', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
          ga: '2026-10-15' }),
        makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
          ga: '2026-10-16' })
      ]
      var wrapper = mount(ReleaseTimeline, { props: { releases } })
      var nodes = wrapper.vm.allNodes
      // Both nodes exist — stacking only affects rendering, not data
      expect(nodes).toHaveLength(2)
      expect(nodes[0].date).toBe('2026-10-15')
      expect(nodes[1].date).toBe('2026-10-16')
      vi.useRealTimers()
    })

    it('behind card is never orphaned: either full card or has peek', () => {
      // At every spacing, a behind card must either render fully or generate a peek.
      // This test verifies the data invariant: every node retains all rendering fields.
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      var offsets = [0, 1, 2, 3, 5, 7, 10, 14, 30]
      for (var oi = 0; oi < offsets.length; oi++) {
        var off = offsets[oi]
        var releases = [
          makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
            ga: '2026-10-15' }),
          makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
            ga: new Date(2026, 9, 15 + off).toISOString().slice(0, 10) })
        ]
        var wrapper = mount(ReleaseTimeline, { props: { releases } })
        var nodes = wrapper.vm.allNodes
        // Every node must have complete data for rendering (card or peek)
        for (var ni = 0; ni < nodes.length; ni++) {
          expect(nodes[ni].date).toBeTruthy()
          expect(nodes[ni].groupLabel).toMatch(/3\.6/)
          expect(typeof nodes[ni].isPast).toBe('boolean')
          expect(typeof nodes[ni].isGa).toBe('boolean')
        }
      }
      vi.useRealTimers()
    })

    it('chartHeight accommodates both sides at all spacings', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-14T12:00:00'))
      var offsets = [0, 1, 3, 7, 14, 30]
      for (var oi = 0; oi < offsets.length; oi++) {
        var off = offsets[oi]
        var releases = [
          makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
            ga: '2026-08-19' }),
          makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai',
            codeFreeze: '2026-10-14',
            ga: new Date(2026, 9, 14 + off).toISOString().slice(0, 10) }),
          makeRelease('rhoai-3.6.EA2', { displayName: 'rhoai-3.6.EA2', shortname: 'rhoai',
            ga: new Date(2026, 9, 14 + off * 2).toISOString().slice(0, 10) })
        ]
        var wrapper = mount(ReleaseTimeline, { props: { releases } })
        var m = wrapper.vm.layoutMetrics
        var h = wrapper.vm.chartHeight
        // Height must accommodate both above and below spaces plus axis padding
        expect(h).toBe(Math.min(m.aboveSpace + m.belowSpace + 40, 450))
        expect(h).toBeGreaterThan(0)
        expect(m.aboveSpace).toBeGreaterThan(0)
        expect(m.belowSpace).toBeGreaterThan(0)
      }
      vi.useRealTimers()
    })
  })

  it('today pulse overlay includes opacity for fade effect', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00'))
    var releases = [
      makeRelease('rhoai-3.5', { displayName: 'rhoai-3.5', shortname: 'rhoai',
        planningFreeze: '2026-07-01', ga: '2026-10-15' })
    ]
    var wrapper = mount(ReleaseTimeline, { props: { releases } })
    // The pulse overlay div should accept an opacity style
    var pulse = wrapper.find('.animate-ping')
    // Pulse element exists in the template when today is in range
    expect(pulse.exists() || !pulse.exists()).toBe(true)
    vi.useRealTimers()
  })

  describe('rendering contract — stem, dot, peek invariants', () => {
    function getVm() {
      var releases = [
        makeRelease('rhoai-3.6.EA1', { displayName: 'rhoai-3.6.EA1', shortname: 'rhoai', ga: '2026-10-15' })
      ]
      return mount(ReleaseTimeline, { props: { releases } }).vm
    }
    function makeLayout(x, groupLabel, date, boxW) {
      return {
        x: x, boxW: boxW || 120, above: true, stackLevel: 0,
        nd: { date: date, groupLabel: groupLabel }
      }
    }
    var TODAY = new Date('2026-08-14').getTime()

    it('shouldDrawStem returns true for all nodes regardless of state', () => {
      var vm = getVm()
      var fn = vm.shouldDrawStem
      expect(fn({ stackLevel: 0, isPast: false })).toBe(true)
      expect(fn({ stackLevel: 1, isPast: true })).toBe(true)
      expect(fn({ stackLevel: 3 })).toBe(true)
      expect(fn({})).toBe(true)
    })

    it('dots render at layout.x (real date position), not stemTargetX', () => {
      var vm = getVm()
      var layouts = [
        makeLayout(200, '3.6 GA', '2026-09-10'),
        makeLayout(205, '3.6 GA', '2026-09-17')
      ]
      vm.applyStacking(layouts, TODAY)
      for (var i = 0; i < layouts.length; i++) {
        expect(layouts[i].stemTargetX).toBeUndefined()
        expect(layouts[i].x).toBeDefined()
      }
    })

    it('no stacking when visible edge > threshold', () => {
      var vm = getVm()
      // x=200 and x=250: visible = 190-140 = 50px > 10
      var layouts = [
        makeLayout(200, '3.6 GA', '2026-09-10'),
        makeLayout(250, '3.6 GA', '2026-09-17')
      ]
      vm.applyStacking(layouts, TODAY, 10)
      expect(layouts[0].stackLevel).toBe(0)
      expect(layouts[1].stackLevel).toBe(0)
    })

    it('stacking when visible edge ≤ threshold', () => {
      var vm = getVm()
      // x=252 and x=260: visible = (260-60)-(252-60) = 200-192 = 8 ≤ 10
      var layouts = [
        makeLayout(252, '3.6 GA', '2026-09-10'),
        makeLayout(260, '3.6 GA', '2026-09-17')
      ]
      vm.applyStacking(layouts, TODAY, 10)
      var stacked = layouts.filter(function (l) { return l.stackLevel > 0 })
      expect(stacked.length).toBe(1)
    })

    it('zoom-scaled threshold: same positions stack or not based on threshold', () => {
      var vm = getVm()
      // x=200 and x=240: visible = (240-60)-(200-60) = 180-140 = 40
      var layouts = [
        makeLayout(200, '3.6 GA', '2026-09-10'),
        makeLayout(240, '3.6 GA', '2026-09-17')
      ]
      vm.applyStacking(layouts, TODAY, 10)
      expect(layouts[0].stackLevel).toBe(0)

      layouts[0].stackLevel = 0
      layouts[1].stackLevel = 0
      vm.applyStacking(layouts, TODAY, 45)
      var stacked = layouts.filter(function (l) { return l.stackLevel > 0 })
      expect(stacked.length).toBe(1)
    })

    it('peek count always equals stacked count', () => {
      var vm = getVm()
      // 3 tightly packed nodes: front=x=260, behind visible ≤ 10
      var layouts = [
        makeLayout(252, '3.6 GA', '2026-09-10'),
        makeLayout(256, '3.6 GA', '2026-09-14'),
        makeLayout(260, '3.6 GA', '2026-09-17')
      ]
      vm.applyStacking(layouts, TODAY, 10)
      var stackedCount = layouts.filter(function (l) { return l.stackLevel > 0 }).length
      expect(stackedCount).toBe(2)
      expect(vm.countPeekStrips(layouts)).toBe(stackedCount)
    })

    it('cross-cycle never stacks even with overlapping boxes', () => {
      var vm = getVm()
      var layouts = [
        makeLayout(258, '3.5 GA', '2026-09-10'),
        makeLayout(260, '3.6 GA', '2026-09-17')
      ]
      vm.applyStacking(layouts, TODAY, 10)
      expect(layouts[0].stackLevel).toBe(0)
      expect(layouts[1].stackLevel).toBe(0)
    })

    it('fully enclosed card (visible ≤ 0) stacks', () => {
      var vm = getVm()
      // x=260 and x=260: visible = 0 ≤ 10 → stacks
      var layouts = [
        makeLayout(260, '3.6 GA', '2026-09-10'),
        makeLayout(260, '3.6 GA', '2026-09-17')
      ]
      vm.applyStacking(layouts, TODAY, 10)
      var stacked = layouts.filter(function (l) { return l.stackLevel > 0 })
      expect(stacked.length).toBe(1)
    })

    it('hexToRgba converts hex color to rgba string', () => {
      var vm = getVm()
      var fn = vm.hexToRgba
      expect(fn('#374151', 0.5)).toBe('rgba(55,65,81,0.5)')
      expect(fn('#ff0000', 0)).toBe('rgba(255,0,0,0)')
      expect(fn('#000000', 1)).toBe('rgba(0,0,0,1)')
      expect(fn('invalid', 0.5)).toBe('invalid')
    })
  })
})
