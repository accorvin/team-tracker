import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterSelector from '../../client/components/FilterSelector.vue'

describe('FilterSelector', () => {
  const mockFilters = [
    { id: 'abc123', name: 'My Teams', boardIds: [1, 2] },
    { id: 'def456', name: 'Platform Teams', boardIds: [3, 4, 5] }
  ]

  function mountComponent(props = {}) {
    return mount(FilterSelector, {
      props: { filters: [], activeFilterId: null, ...props }
    })
  }

  it('renders "All Teams" when no filter is active', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('All Teams')
  })

  it('renders active filter name when a filter is selected', () => {
    const wrapper = mountComponent({ filters: mockFilters, activeFilterId: 'def456' })
    const button = wrapper.find('[data-testid="filter-selector-button"]')
    expect(button.text()).toContain('Platform Teams')
  })

  it('does not show dropdown by default', () => {
    const wrapper = mountComponent({ filters: mockFilters })
    expect(wrapper.find('[data-testid="filter-dropdown"]').exists()).toBe(false)
  })

  it('shows dropdown when button is clicked', async () => {
    const wrapper = mountComponent({ filters: mockFilters })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    expect(wrapper.find('[data-testid="filter-dropdown"]').exists()).toBe(true)
  })

  it('hides dropdown when button is clicked again', async () => {
    const wrapper = mountComponent({ filters: mockFilters })
    const button = wrapper.find('[data-testid="filter-selector-button"]')
    await button.trigger('click')
    expect(wrapper.find('[data-testid="filter-dropdown"]').exists()).toBe(true)
    await button.trigger('click')
    expect(wrapper.find('[data-testid="filter-dropdown"]').exists()).toBe(false)
  })

  it('shows "All Teams" option in dropdown', async () => {
    const wrapper = mountComponent({ filters: mockFilters })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    const allTeamsOption = wrapper.find('[data-testid="filter-option-all"]')
    expect(allTeamsOption.exists()).toBe(true)
    expect(allTeamsOption.text()).toContain('All Teams')
  })

  it('shows all saved filters in dropdown', async () => {
    const wrapper = mountComponent({ filters: mockFilters })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    expect(wrapper.text()).toContain('My Teams')
    expect(wrapper.text()).toContain('Platform Teams')
  })

  it('shows "New Filter..." button in dropdown', async () => {
    const wrapper = mountComponent({ filters: mockFilters })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    const newFilterButton = wrapper.find('[data-testid="new-filter-button"]')
    expect(newFilterButton.exists()).toBe(true)
    expect(newFilterButton.text()).toContain('New Filter')
  })

  it('emits select-filter with null when "All Teams" is clicked', async () => {
    const wrapper = mountComponent({ filters: mockFilters, activeFilterId: 'abc123' })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    await wrapper.find('[data-testid="filter-option-all"]').trigger('click')
    expect(wrapper.emitted('select-filter')).toBeTruthy()
    expect(wrapper.emitted('select-filter')[0]).toEqual([null])
  })

  it('emits select-filter with filter id when a filter is clicked', async () => {
    const wrapper = mountComponent({ filters: mockFilters })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    await wrapper.find('[data-testid="filter-option-abc123"]').trigger('click')
    expect(wrapper.emitted('select-filter')).toBeTruthy()
    expect(wrapper.emitted('select-filter')[0]).toEqual(['abc123'])
  })

  it('closes dropdown after selecting a filter', async () => {
    const wrapper = mountComponent({ filters: mockFilters })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    await wrapper.find('[data-testid="filter-option-abc123"]').trigger('click')
    expect(wrapper.find('[data-testid="filter-dropdown"]').exists()).toBe(false)
  })

  it('emits create-filter when "New Filter..." is clicked', async () => {
    const wrapper = mountComponent({ filters: mockFilters })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    await wrapper.find('[data-testid="new-filter-button"]').trigger('click')
    expect(wrapper.emitted('create-filter')).toBeTruthy()
  })

  it('closes dropdown after clicking "New Filter..."', async () => {
    const wrapper = mountComponent({ filters: mockFilters })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    await wrapper.find('[data-testid="new-filter-button"]').trigger('click')
    expect(wrapper.find('[data-testid="filter-dropdown"]').exists()).toBe(false)
  })

  it('shows edit icon on filter items', async () => {
    const wrapper = mountComponent({ filters: mockFilters })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    const editButton = wrapper.find('[data-testid="edit-filter-abc123"]')
    expect(editButton.exists()).toBe(true)
  })

  it('emits edit-filter with filter id when edit icon is clicked', async () => {
    const wrapper = mountComponent({ filters: mockFilters })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    await wrapper.find('[data-testid="edit-filter-abc123"]').trigger('click')
    expect(wrapper.emitted('edit-filter')).toBeTruthy()
    expect(wrapper.emitted('edit-filter')[0]).toEqual(['abc123'])
  })

  it('shows delete icon on filter items', async () => {
    const wrapper = mountComponent({ filters: mockFilters })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    const deleteButton = wrapper.find('[data-testid="delete-filter-abc123"]')
    expect(deleteButton.exists()).toBe(true)
  })

  it('emits delete-filter with filter id when delete icon is clicked', async () => {
    const wrapper = mountComponent({ filters: mockFilters })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    await wrapper.find('[data-testid="delete-filter-abc123"]').trigger('click')
    expect(wrapper.emitted('delete-filter')).toBeTruthy()
    expect(wrapper.emitted('delete-filter')[0]).toEqual(['abc123'])
  })

  it('highlights "All Teams" when no filter is active', async () => {
    const wrapper = mountComponent({ filters: mockFilters, activeFilterId: null })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    const allTeamsOption = wrapper.find('[data-testid="filter-option-all"]')
    expect(allTeamsOption.classes()).toContain('font-semibold')
  })

  it('highlights active filter in dropdown', async () => {
    const wrapper = mountComponent({ filters: mockFilters, activeFilterId: 'abc123' })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    const filterOption = wrapper.find('[data-testid="filter-option-abc123"]')
    expect(filterOption.classes()).toContain('font-semibold')
  })

  it('does not emit select-filter when edit icon is clicked', async () => {
    const wrapper = mountComponent({ filters: mockFilters })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    await wrapper.find('[data-testid="edit-filter-abc123"]').trigger('click')
    expect(wrapper.emitted('select-filter')).toBeFalsy()
  })

  it('does not emit select-filter when delete icon is clicked', async () => {
    const wrapper = mountComponent({ filters: mockFilters })
    await wrapper.find('[data-testid="filter-selector-button"]').trigger('click')
    await wrapper.find('[data-testid="delete-filter-abc123"]').trigger('click')
    expect(wrapper.emitted('select-filter')).toBeFalsy()
  })
})
