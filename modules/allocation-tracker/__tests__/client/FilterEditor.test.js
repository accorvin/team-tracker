import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterEditor from '../../client/components/FilterEditor.vue'

describe('FilterEditor', () => {
  const mockBoards = [
    { id: 1, name: 'Board Alpha', displayName: 'Team Alpha' },
    { id: 2, name: 'Board Beta', displayName: 'Team Beta' },
    { id: 3, name: 'Board Gamma', displayName: 'Team Gamma' }
  ]

  function mountComponent(props = {}) {
    return mount(FilterEditor, {
      props: { boards: mockBoards, filter: null, ...props }
    })
  }

  describe('create mode (filter=null)', () => {
    it('renders a modal with title "New Filter"', () => {
      const wrapper = mountComponent()
      expect(wrapper.text()).toContain('New Filter')
    })

    it('renders an empty name input', () => {
      const wrapper = mountComponent()
      const input = wrapper.find('[data-testid="filter-name-input"]')
      expect(input.exists()).toBe(true)
      expect(input.element.value).toBe('')
    })

    it('renders a checklist of all boards', () => {
      const wrapper = mountComponent()
      expect(wrapper.text()).toContain('Team Alpha')
      expect(wrapper.text()).toContain('Team Beta')
      expect(wrapper.text()).toContain('Team Gamma')
    })

    it('renders checkboxes for each board, all unchecked', () => {
      const wrapper = mountComponent()
      const boardCheckboxes = wrapper.findAll('[data-testid^="board-checkbox-"]')
      expect(boardCheckboxes).toHaveLength(3)
      boardCheckboxes.forEach(cb => {
        expect(cb.element.checked).toBe(false)
      })
    })

    it('has a disabled Save button when name is empty', () => {
      const wrapper = mountComponent()
      const saveButton = wrapper.find('[data-testid="save-filter-button"]')
      expect(saveButton.exists()).toBe(true)
      expect(saveButton.element.disabled).toBe(true)
    })

    it('has a disabled Save button when no boards are selected', async () => {
      const wrapper = mountComponent()
      const input = wrapper.find('[data-testid="filter-name-input"]')
      await input.setValue('My Filter')
      const saveButton = wrapper.find('[data-testid="save-filter-button"]')
      expect(saveButton.element.disabled).toBe(true)
    })

    it('enables Save button when name and at least one board is selected', async () => {
      const wrapper = mountComponent()
      await wrapper.find('[data-testid="filter-name-input"]').setValue('My Filter')
      await wrapper.find('[data-testid="board-checkbox-1"]').setValue(true)
      const saveButton = wrapper.find('[data-testid="save-filter-button"]')
      expect(saveButton.element.disabled).toBe(false)
    })

    it('emits save with name and boardIds when Save is clicked', async () => {
      const wrapper = mountComponent()
      await wrapper.find('[data-testid="filter-name-input"]').setValue('My Filter')
      await wrapper.find('[data-testid="board-checkbox-1"]').setValue(true)
      await wrapper.find('[data-testid="board-checkbox-3"]').setValue(true)
      await wrapper.find('[data-testid="save-filter-button"]').trigger('click')
      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')[0]).toEqual([{ name: 'My Filter', boardIds: [1, 3] }])
    })

    it('emits cancel when Cancel button is clicked', async () => {
      const wrapper = mountComponent()
      await wrapper.find('[data-testid="cancel-filter-button"]').trigger('click')
      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('emits cancel when backdrop is clicked', async () => {
      const wrapper = mountComponent()
      await wrapper.find('[data-testid="filter-editor-backdrop"]').trigger('click')
      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('does not emit cancel when modal content is clicked', async () => {
      const wrapper = mountComponent()
      await wrapper.find('[data-testid="filter-editor-modal"]').trigger('click')
      expect(wrapper.emitted('cancel')).toBeFalsy()
    })
  })

  describe('edit mode (filter provided)', () => {
    const existingFilter = { id: 'abc123', name: 'My Teams', boardIds: [1, 3] }

    it('renders title "Edit Filter"', () => {
      const wrapper = mountComponent({ filter: existingFilter })
      expect(wrapper.text()).toContain('Edit Filter')
    })

    it('pre-fills the name input', () => {
      const wrapper = mountComponent({ filter: existingFilter })
      const input = wrapper.find('[data-testid="filter-name-input"]')
      expect(input.element.value).toBe('My Teams')
    })

    it('pre-checks boards from the filter', () => {
      const wrapper = mountComponent({ filter: existingFilter })
      expect(wrapper.find('[data-testid="board-checkbox-1"]').element.checked).toBe(true)
      expect(wrapper.find('[data-testid="board-checkbox-2"]').element.checked).toBe(false)
      expect(wrapper.find('[data-testid="board-checkbox-3"]').element.checked).toBe(true)
    })

    it('enables Save button with valid existing data', () => {
      const wrapper = mountComponent({ filter: existingFilter })
      const saveButton = wrapper.find('[data-testid="save-filter-button"]')
      expect(saveButton.element.disabled).toBe(false)
    })

    it('emits save with updated data', async () => {
      const wrapper = mountComponent({ filter: existingFilter })
      await wrapper.find('[data-testid="filter-name-input"]').setValue('Updated Name')
      await wrapper.find('[data-testid="board-checkbox-2"]').setValue(true)
      await wrapper.find('[data-testid="save-filter-button"]').trigger('click')
      expect(wrapper.emitted('save')[0]).toEqual([{ name: 'Updated Name', boardIds: [1, 2, 3] }])
    })
  })

  describe('Select All / Deselect All', () => {
    it('renders Select All button', () => {
      const wrapper = mountComponent()
      const selectAllButton = wrapper.find('[data-testid="select-all-button"]')
      expect(selectAllButton.exists()).toBe(true)
    })

    it('selects all boards when Select All is clicked', async () => {
      const wrapper = mountComponent()
      await wrapper.find('[data-testid="select-all-button"]').trigger('click')
      expect(wrapper.find('[data-testid="board-checkbox-1"]').element.checked).toBe(true)
      expect(wrapper.find('[data-testid="board-checkbox-2"]').element.checked).toBe(true)
      expect(wrapper.find('[data-testid="board-checkbox-3"]').element.checked).toBe(true)
    })

    it('renders Deselect All button', () => {
      const wrapper = mountComponent()
      const deselectAllButton = wrapper.find('[data-testid="deselect-all-button"]')
      expect(deselectAllButton.exists()).toBe(true)
    })

    it('deselects all boards when Deselect All is clicked', async () => {
      const wrapper = mountComponent({
        filter: { id: 'abc', name: 'Test', boardIds: [1, 2, 3] }
      })
      await wrapper.find('[data-testid="deselect-all-button"]').trigger('click')
      expect(wrapper.find('[data-testid="board-checkbox-1"]').element.checked).toBe(false)
      expect(wrapper.find('[data-testid="board-checkbox-2"]').element.checked).toBe(false)
      expect(wrapper.find('[data-testid="board-checkbox-3"]').element.checked).toBe(false)
    })
  })

  describe('uses displayName for board labels', () => {
    it('shows displayName when available', () => {
      const wrapper = mountComponent()
      const labels = wrapper.findAll('[data-testid^="board-label-"]')
      expect(labels[0].text()).toContain('Team Alpha')
      expect(labels[1].text()).toContain('Team Beta')
    })

    it('falls back to name when displayName is absent', () => {
      const boards = [{ id: 10, name: 'Raw Board Name' }]
      const wrapper = mountComponent({ boards })
      expect(wrapper.text()).toContain('Raw Board Name')
    })
  })
})
