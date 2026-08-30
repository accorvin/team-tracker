import { describe, it, expect } from 'vitest'
import {
  listTrackingVersions,
  productsForVersion,
  buildReleaseSpecs,
  parseProductsFromParams,
  reconcileSelection
} from '../../../client/execute/helpers/tracking-picker.js'

function sampleConfig() {
  return {
    releases: {
      '3.6': {
        products: { rhoai: 'rhoai-3.6', rhelai: 'rhelai-3.6' }
      },
      '3.7': {
        products: { rhoai: 'rhoai-3.7', rhelai: '', rhaii: 'rhaii-3.7' }
      },
      '3.5.EA1': {
        products: { rhoai: 'rhoai-3.5.EA1' }
      }
    }
  }
}

describe('listTrackingVersions', function () {
  it('returns gear keys newest-first when freeze dates are unknown', function () {
    expect(listTrackingVersions(sampleConfig())).toEqual(['3.7', '3.6', '3.5.EA1'])
    expect(listTrackingVersions({ releases: {} })).toEqual([])
    expect(listTrackingVersions(null)).toEqual([])
  })

  it('sorts by planning freeze date earliest first', function () {
    expect(listTrackingVersions(sampleConfig(), {
      '3.7': '2026-10-01',
      '3.6': '2026-06-15',
      '3.5.EA1': '2026-03-01'
    })).toEqual(['3.5.EA1', '3.6', '3.7'])
  })

  it('uses gear overrides over API freeze dates and puts undated versions last', function () {
    var config = {
      releases: {
        '3.6.EA2': { products: {}, planningFreezeOverride: '2026-08-01' },
        '3.6.EA1': { products: {} },
        '3.6': { products: {} },
        '3.5.EA2': { products: {}, planningFreezeOverride: '2026-03-01' },
        '3.5.EA1': { products: {} },
        '3.5': { products: {} }
      }
    }
    expect(listTrackingVersions(config, {
      '3.6.EA2': '2099-01-01',
      '3.6.EA1': '2026-05-01',
      '3.6': '2026-09-01',
      '3.5.EA1': '2026-02-01',
      '3.5': '2026-04-01'
    })).toEqual(['3.5.EA1', '3.5.EA2', '3.5', '3.6.EA1', '3.6.EA2', '3.6'])
  })
})

describe('productsForVersion', function () {
  it('returns filled products in RHOAI / RHELAI / RHAII order and skips blanks', function () {
    var products = productsForVersion(sampleConfig(), '3.7')
    expect(products).toEqual([
      { family: 'rhoai', jiraName: 'rhoai-3.7' },
      { family: 'rhaii', jiraName: 'rhaii-3.7' }
    ])
  })

  it('accepts uppercase product keys from mixed config', function () {
    var products = productsForVersion({
      releases: { '3.7': { products: { RHOAI: 'rhoai-3.7' } } }
    }, '3.7')
    expect(products).toEqual([{ family: 'rhoai', jiraName: 'rhoai-3.7' }])
  })
})

describe('buildReleaseSpecs', function () {
  it('builds specs for the selected version and product filter', function () {
    var specs = buildReleaseSpecs(sampleConfig(), {
      version: '3.7',
      products: ['rhoai']
    })
    expect(specs).toEqual([
      { portfolioVersion: '3.7', family: 'rhoai', jiraName: 'rhoai-3.7' }
    ])
  })

  it('includes every filled product when no product filter is set', function () {
    var specs = buildReleaseSpecs(sampleConfig(), { version: '3.6' })
    expect(specs.map(function (s) { return s.family })).toEqual(['rhoai', 'rhelai'])
  })

  it('still emits a tracking-only spec when a version has no filled products', function () {
    var specs = buildReleaseSpecs({
      releases: { '3.8': { products: { rhoai: '' } } }
    }, { version: '3.8' })
    expect(specs).toEqual([
      { portfolioVersion: '3.8', family: null, jiraName: null }
    ])
  })

  it('returns no specs for an unknown version', function () {
    expect(buildReleaseSpecs(sampleConfig(), { version: '9.9' })).toEqual([])
  })
})

describe('parseProductsFromParams', function () {
  it('prefers products over legacy families and keeps known families only', function () {
    expect(parseProductsFromParams('rhoai,rhelai', 'ignored')).toEqual(['rhoai', 'rhelai'])
    expect(parseProductsFromParams('', 'rhoai,unknown,rhelai')).toEqual(['rhoai', 'rhelai'])
    expect(parseProductsFromParams(null, 'GA,rhoai')).toEqual(['rhoai'])
  })
})

describe('reconcileSelection', function () {
  it('defaults to the latest version and all filled products', function () {
    expect(reconcileSelection(sampleConfig(), {})).toEqual({
      version: '3.7',
      products: ['rhoai', 'rhaii']
    })
  })

  it('defaults to the earliest freeze date when dates are known', function () {
    expect(reconcileSelection(sampleConfig(), {}, {
      '3.7': '2026-10-01',
      '3.6': '2026-06-15',
      '3.5.EA1': '2026-03-01'
    })).toEqual({
      version: '3.5.EA1',
      products: ['rhoai']
    })
  })

  it('drops a deleted version and unknown products', function () {
    expect(reconcileSelection(sampleConfig(), {
      version: '2.15',
      products: ['rhoai', 'missing']
    })).toEqual({
      version: '3.7',
      products: ['rhoai']
    })
  })

  it('clears selection when the gear has no releases', function () {
    expect(reconcileSelection({ releases: {} }, { version: '3.7' })).toEqual({
      version: '',
      products: []
    })
  })
})
