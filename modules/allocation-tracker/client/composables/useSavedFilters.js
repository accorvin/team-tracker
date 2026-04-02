import { ref, computed } from 'vue'

export function useSavedFilters() {
  const filters = ref(loadFilters())
  const activeFilterId = ref(loadActiveFilterId())

  const activeFilter = computed(() => {
    if (!activeFilterId.value) return null
    return filters.value.find(f => f.id === activeFilterId.value) || null
  })

  function loadFilters() {
    try {
      return JSON.parse(localStorage.getItem('dashboardFilters')) || []
    } catch {
      return []
    }
  }

  function loadActiveFilterId() {
    try {
      return localStorage.getItem('activeFilterId') || null
    } catch {
      return null
    }
  }

  function persistFilters() {
    localStorage.setItem('dashboardFilters', JSON.stringify(filters.value))
  }

  function createFilter({ name, boardIds }) {
    const id = Date.now().toString(36)
    filters.value.push({ id, name, boardIds })
    persistFilters()
    return id
  }

  function updateFilter(id, updates) {
    const index = filters.value.findIndex(f => f.id === id)
    if (index === -1) return
    filters.value[index] = { ...filters.value[index], ...updates }
    persistFilters()
  }

  function deleteFilter(id) {
    filters.value = filters.value.filter(f => f.id !== id)
    if (activeFilterId.value === id) {
      activeFilterId.value = null
      localStorage.removeItem('activeFilterId')
    }
    persistFilters()
  }

  function setActiveFilter(id) {
    activeFilterId.value = id
    if (id === null) {
      localStorage.removeItem('activeFilterId')
    } else {
      localStorage.setItem('activeFilterId', id)
    }
  }

  return {
    filters,
    activeFilterId,
    activeFilter,
    createFilter,
    updateFilter,
    deleteFilter,
    setActiveFilter
  }
}
