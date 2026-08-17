import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('../../../client/services/allocation-api', () => ({
  updateTeamAllocationSettings: vi.fn()
}))

const mockTriggerRefresh = vi.fn().mockResolvedValue({ status: 'started' })
vi.mock('../../../client/composables/useAllocationRefresh', () => ({
  useAllocationRefresh: () => ({ refreshing: { value: false }, message: { value: '' }, triggerRefresh: mockTriggerRefresh })
}))

const { updateTeamAllocationSettings } = await import('../../../client/services/allocation-api')
import AllocationSettingsModal from '../../../client/allocation/AllocationSettingsModal.vue'

function mountModal(currentMode = 'points') {
  return mount(AllocationSettingsModal, { props: { teamId: 'team_1', currentMode } })
}

describe('AllocationSettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateTeamAllocationSettings.mockResolvedValue({ allocationMode: 'counts' })
  })

  it('requires an explicit choice on first-time config (no mode pre-selected)', async () => {
    const wrapper = mountModal(null)
    expect(wrapper.find('[data-testid="allocation-settings-firsttime"]').exists()).toBe(true)
    expect(wrapper.get('input[value="points"]').element.checked).toBe(false)
    expect(wrapper.get('input[value="counts"]').element.checked).toBe(false)
    expect(wrapper.get('[data-testid="allocation-settings-save"]').attributes('disabled')).toBeDefined()

    await wrapper.get('input[value="points"]').setValue()
    expect(wrapper.get('[data-testid="allocation-settings-save"]').attributes('disabled')).toBeUndefined()
  })

  it('disables Save until the mode changes', async () => {
    const wrapper = mountModal('points')
    expect(wrapper.get('[data-testid="allocation-settings-save"]').attributes('disabled')).toBeDefined()

    await wrapper.get('input[value="counts"]').setValue()
    expect(wrapper.get('[data-testid="allocation-settings-save"]').attributes('disabled')).toBeUndefined()
  })

  it('persists the new mode, triggers a refresh, and emits saved', async () => {
    const wrapper = mountModal('points')
    await wrapper.get('input[value="counts"]').setValue()
    await wrapper.get('[data-testid="allocation-settings-save"]').trigger('click')
    await flushPromises()

    expect(updateTeamAllocationSettings).toHaveBeenCalledWith('team_1', 'counts')
    expect(mockTriggerRefresh).toHaveBeenCalledWith({ teamId: 'team_1' })
    expect(wrapper.emitted('saved')).toBeTruthy()
    expect(wrapper.emitted('saved')[0]).toEqual(['counts'])
  })

  it('shows a permission error on 403 and does not emit saved', async () => {
    const err = new Error('forbidden'); err.status = 403
    updateTeamAllocationSettings.mockRejectedValue(err)

    const wrapper = mountModal('points')
    await wrapper.get('input[value="counts"]').setValue()
    await wrapper.get('[data-testid="allocation-settings-save"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="allocation-settings-error"]').text()).toContain("don't have permission")
    expect(wrapper.emitted('saved')).toBeFalsy()
  })

  it('emits close on Cancel', async () => {
    const wrapper = mountModal('points')
    const cancel = wrapper.findAll('button').find(b => b.text() === 'Cancel')
    await cancel.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
