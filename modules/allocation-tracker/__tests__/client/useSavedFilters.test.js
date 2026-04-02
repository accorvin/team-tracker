import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSavedFilters } from '../../client/composables/useSavedFilters.js'

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: vi.fn((key) => localStorageMock.store[key] ?? null),
  setItem: vi.fn((key, value) => { localStorageMock.store[key] = value }),
  removeItem: vi.fn((key) => { delete localStorageMock.store[key] })
}
global.localStorage = localStorageMock

describe('useSavedFilters', () => {
  beforeEach(() => {
    localStorageMock.store = {}
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()
  })

  it('initializes with empty filters and null activeFilterId', () => {
    const { filters, activeFilterId, activeFilter } = useSavedFilters()
    expect(filters.value).toEqual([])
    expect(activeFilterId.value).toBeNull()
    expect(activeFilter.value).toBeNull()
  })

  it('loads saved filters from localStorage on init', () => {
    const savedFilters = [{ id: 'abc123', name: 'My Teams', boardIds: [1, 2] }]
    localStorageMock.store.dashboardFilters = JSON.stringify(savedFilters)
    const { filters } = useSavedFilters()
    expect(filters.value).toEqual(savedFilters)
  })

  it('loads activeFilterId from localStorage on init', () => {
    localStorageMock.store.dashboardFilters = JSON.stringify([
      { id: 'abc123', name: 'My Teams', boardIds: [1, 2] }
    ])
    localStorageMock.store.activeFilterId = 'abc123'
    const { activeFilterId } = useSavedFilters()
    expect(activeFilterId.value).toBe('abc123')
  })

  it('computes activeFilter from activeFilterId', () => {
    const savedFilters = [
      { id: 'abc123', name: 'My Teams', boardIds: [1, 2] },
      { id: 'def456', name: 'Platform', boardIds: [3, 4] }
    ]
    localStorageMock.store.dashboardFilters = JSON.stringify(savedFilters)
    localStorageMock.store.activeFilterId = 'def456'
    const { activeFilter } = useSavedFilters()
    expect(activeFilter.value).toEqual({ id: 'def456', name: 'Platform', boardIds: [3, 4] })
  })

  it('returns null activeFilter when activeFilterId is null', () => {
    localStorageMock.store.dashboardFilters = JSON.stringify([
      { id: 'abc123', name: 'My Teams', boardIds: [1, 2] }
    ])
    const { activeFilter } = useSavedFilters()
    expect(activeFilter.value).toBeNull()
  })

  describe('createFilter', () => {
    it('creates a filter and returns its ID', () => {
      const { filters, createFilter } = useSavedFilters()
      const id = createFilter({ name: 'My Teams', boardIds: [1, 2, 3] })
      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
      expect(filters.value).toHaveLength(1)
      expect(filters.value[0]).toEqual({ id, name: 'My Teams', boardIds: [1, 2, 3] })
    })

    it('persists filters to localStorage after create', () => {
      const { createFilter } = useSavedFilters()
      createFilter({ name: 'My Teams', boardIds: [1, 2] })
      const savedCall = localStorageMock.setItem.mock.calls.find(([key]) => key === 'dashboardFilters')
      expect(savedCall).toBeTruthy()
      const saved = JSON.parse(savedCall[1])
      expect(saved).toHaveLength(1)
      expect(saved[0].name).toBe('My Teams')
    })

    it('appends to existing filters', () => {
      localStorageMock.store.dashboardFilters = JSON.stringify([
        { id: 'existing', name: 'Existing', boardIds: [1] }
      ])
      const { filters, createFilter } = useSavedFilters()
      createFilter({ name: 'New Filter', boardIds: [2, 3] })
      expect(filters.value).toHaveLength(2)
      expect(filters.value[0].name).toBe('Existing')
      expect(filters.value[1].name).toBe('New Filter')
    })
  })

  describe('updateFilter', () => {
    it('updates a filter by id', () => {
      localStorageMock.store.dashboardFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', boardIds: [1, 2] }
      ])
      const { filters, updateFilter } = useSavedFilters()
      updateFilter('abc123', { name: 'Renamed', boardIds: [1, 2, 3] })
      expect(filters.value[0]).toEqual({ id: 'abc123', name: 'Renamed', boardIds: [1, 2, 3] })
    })

    it('persists after update', () => {
      localStorageMock.store.dashboardFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', boardIds: [1, 2] }
      ])
      const { updateFilter } = useSavedFilters()
      localStorageMock.setItem.mockClear()
      updateFilter('abc123', { name: 'Updated', boardIds: [5] })
      const savedCall = localStorageMock.setItem.mock.calls.find(([key]) => key === 'dashboardFilters')
      expect(savedCall).toBeTruthy()
      const saved = JSON.parse(savedCall[1])
      expect(saved[0].name).toBe('Updated')
    })

    it('allows partial updates (name only)', () => {
      localStorageMock.store.dashboardFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', boardIds: [1, 2] }
      ])
      const { filters, updateFilter } = useSavedFilters()
      updateFilter('abc123', { name: 'Renamed' })
      expect(filters.value[0].name).toBe('Renamed')
      expect(filters.value[0].boardIds).toEqual([1, 2])
    })

    it('allows partial updates (boardIds only)', () => {
      localStorageMock.store.dashboardFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', boardIds: [1, 2] }
      ])
      const { filters, updateFilter } = useSavedFilters()
      updateFilter('abc123', { boardIds: [3, 4, 5] })
      expect(filters.value[0].name).toBe('My Teams')
      expect(filters.value[0].boardIds).toEqual([3, 4, 5])
    })
  })

  describe('deleteFilter', () => {
    it('removes a filter by id', () => {
      localStorageMock.store.dashboardFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', boardIds: [1, 2] },
        { id: 'def456', name: 'Platform', boardIds: [3] }
      ])
      const { filters, deleteFilter } = useSavedFilters()
      deleteFilter('abc123')
      expect(filters.value).toHaveLength(1)
      expect(filters.value[0].id).toBe('def456')
    })

    it('clears activeFilterId if deleted filter was active', () => {
      localStorageMock.store.dashboardFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', boardIds: [1, 2] }
      ])
      localStorageMock.store.activeFilterId = 'abc123'
      const { activeFilterId, deleteFilter } = useSavedFilters()
      expect(activeFilterId.value).toBe('abc123')
      deleteFilter('abc123')
      expect(activeFilterId.value).toBeNull()
    })

    it('does not clear activeFilterId if a different filter was deleted', () => {
      localStorageMock.store.dashboardFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', boardIds: [1, 2] },
        { id: 'def456', name: 'Platform', boardIds: [3] }
      ])
      localStorageMock.store.activeFilterId = 'def456'
      const { activeFilterId, deleteFilter } = useSavedFilters()
      deleteFilter('abc123')
      expect(activeFilterId.value).toBe('def456')
    })

    it('persists after delete', () => {
      localStorageMock.store.dashboardFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', boardIds: [1, 2] }
      ])
      const { deleteFilter } = useSavedFilters()
      localStorageMock.setItem.mockClear()
      deleteFilter('abc123')
      const savedCall = localStorageMock.setItem.mock.calls.find(([key]) => key === 'dashboardFilters')
      expect(savedCall).toBeTruthy()
      const saved = JSON.parse(savedCall[1])
      expect(saved).toHaveLength(0)
    })
  })

  describe('setActiveFilter', () => {
    it('sets activeFilterId', () => {
      localStorageMock.store.dashboardFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', boardIds: [1, 2] }
      ])
      const { activeFilterId, setActiveFilter } = useSavedFilters()
      setActiveFilter('abc123')
      expect(activeFilterId.value).toBe('abc123')
    })

    it('sets activeFilterId to null for All Teams', () => {
      localStorageMock.store.dashboardFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', boardIds: [1, 2] }
      ])
      localStorageMock.store.activeFilterId = 'abc123'
      const { activeFilterId, setActiveFilter } = useSavedFilters()
      setActiveFilter(null)
      expect(activeFilterId.value).toBeNull()
    })

    it('persists activeFilterId to localStorage', () => {
      const { setActiveFilter } = useSavedFilters()
      localStorageMock.setItem.mockClear()
      setActiveFilter('abc123')
      const savedCall = localStorageMock.setItem.mock.calls.find(([key]) => key === 'activeFilterId')
      expect(savedCall).toBeTruthy()
      expect(savedCall[1]).toBe('abc123')
    })

    it('removes activeFilterId from localStorage when set to null', () => {
      localStorageMock.store.activeFilterId = 'abc123'
      const { setActiveFilter } = useSavedFilters()
      localStorageMock.removeItem.mockClear()
      setActiveFilter(null)
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('activeFilterId')
    })
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorageMock.store.dashboardFilters = 'not valid json'
    const { filters, activeFilterId } = useSavedFilters()
    expect(filters.value).toEqual([])
    expect(activeFilterId.value).toBeNull()
  })
})
