import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ProductView from '../../client/views/ProductView.vue'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn(),
}))

vi.mock('@vueuse/core', () => ({
  useScroll: () => ({ arrivedState: { bottom: false } }),
}))

const { apiRequest } = await import('@shared/client/services/api')

describe('ProductView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.location.hash = '#/product-builds/base-images'
    apiRequest.mockImplementation((path) => {
      if (path.endsWith('/products/base-images')) {
        return Promise.resolve({ key: 'base-images', product_name: 'Base Images', short_name: 'Base Images' })
      }
      if (path.includes('/drops?')) {
        const drops = [{
          key: 'base-images-3.6-ga',
          name: 'Base Images 3.6 GA',
          product_version: '3.6',
          environments: ['production'],
          created_at: '2026-10-01T12:00:00Z',
        }, {
          key: 'base-images-3.6-ea1',
          name: 'Base Images 3.6-EA1',
          product_version: '3.6-EA1',
          environments: ['production'],
          created_at: '2026-08-01T12:00:00Z',
        }, {
          key: 'base-images-3.6-ea2',
          name: 'Base Images 3.6-EA2',
          product_version: '3.6-EA2',
          environments: ['stage'],
          created_at: '2026-09-01T12:00:00Z',
        }]
        return Promise.resolve(path.includes('artifact_type=') ? drops.slice(2) : drops)
      }
      if (path.includes('/series?')) return Promise.resolve(['3.6', '3.6-EA2', '3.6-EA1'])
      if (path.includes('/artifacts?')) {
        if (!path.includes('type=base-images')) return Promise.resolve([])
        return Promise.resolve([{
          key: 'base-image-artifact-3.6-ea2',
          type: 'base-images',
          variant: 'cpu',
          archs: ['x86_64'],
          environments: ['stage'],
        }])
      }
      return Promise.resolve([])
    })
  })

  it('shows base-image drops across releases without artifact subtype filtering', async () => {
    const wrapper = mount(ProductView, {
      global: { provide: { moduleNav: { navigateTo: vi.fn() } } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Base Images 3.6 GA')
    expect(wrapper.text()).toContain('Base Images 3.6-EA1')
    expect(wrapper.text()).toContain('Base Images 3.6-EA2')
  })

  it('keeps Base Images series navigation enabled', async () => {
    const navigateTo = vi.fn()
    const wrapper = mount(ProductView, {
      global: { provide: { moduleNav: { navigateTo } } },
    })
    await flushPromises()

    const seriesHeading = wrapper.findAll('h3').find(heading => heading.text() === '3.6-EA2')
    await seriesHeading.trigger('click')

    expect(navigateTo).toHaveBeenCalledWith('series-detail', { series: '3.6-EA2', product: 'base-images' })
  })

  it('loads Base Images artifacts with their precise artifact type', async () => {
    const wrapper = mount(ProductView, {
      global: { provide: { moduleNav: { navigateTo: vi.fn() } } },
    })
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text() === 'Artifacts').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('base-image-artifact-3.6-ea2')
  })
})
