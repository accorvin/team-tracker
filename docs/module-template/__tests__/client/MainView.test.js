import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MainView from '../../client/views/MainView.vue'

describe('MainView', () => {
  it('renders the module title', () => {
    const wrapper = mount(MainView)
    expect(wrapper.text()).toContain('My Module')
  })
})
