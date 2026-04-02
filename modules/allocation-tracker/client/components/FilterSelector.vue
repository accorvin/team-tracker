<template>
  <div class="relative">
    <button
      data-testid="filter-selector-button"
      @click="showDropdown = !showDropdown"
      class="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-colors"
    >
      <svg class="h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
      <span>{{ activeFilterName }}</span>
      <svg class="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div
      v-if="showDropdown"
      data-testid="filter-dropdown"
      class="absolute left-0 mt-1 w-64 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10"
    >
      <button
        data-testid="filter-option-all"
        @click="selectFilter(null)"
        class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between"
        :class="{ 'font-semibold': activeFilterId === null }"
      >
        All Teams
      </button>

      <div v-if="filters.length > 0" class="border-t border-gray-100 my-1"></div>

      <div
        v-for="filter in filters"
        :key="filter.id"
        class="group flex items-center"
      >
        <button
          :data-testid="`filter-option-${filter.id}`"
          @click="selectFilter(filter.id)"
          class="flex-1 text-left px-4 py-2 text-sm hover:bg-gray-100 truncate"
          :class="{ 'font-semibold': activeFilterId === filter.id }"
        >
          {{ filter.name }}
        </button>
        <div class="flex items-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            :data-testid="`edit-filter-${filter.id}`"
            @click.stop="editFilter(filter.id)"
            class="p-1 text-gray-400 hover:text-gray-600 rounded"
            title="Edit filter"
          >
            <svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            :data-testid="`delete-filter-${filter.id}`"
            @click.stop="deleteFilter(filter.id)"
            class="p-1 text-gray-400 hover:text-red-500 rounded"
            title="Delete filter"
          >
            <svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div class="border-t border-gray-100 my-1"></div>

      <button
        data-testid="new-filter-button"
        @click="createFilter()"
        class="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-gray-100 flex items-center gap-2"
      >
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Filter...
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  filters: {
    type: Array,
    default: () => []
  },
  activeFilterId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['select-filter', 'create-filter', 'edit-filter', 'delete-filter'])

const showDropdown = ref(false)

const activeFilterName = computed(() => {
  if (!props.activeFilterId) return 'All Teams'
  const filter = props.filters.find(f => f.id === props.activeFilterId)
  return filter ? filter.name : 'All Teams'
})

function selectFilter(id) {
  emit('select-filter', id)
  showDropdown.value = false
}

function createFilter() {
  emit('create-filter')
  showDropdown.value = false
}

function editFilter(id) {
  emit('edit-filter', id)
  showDropdown.value = false
}

function deleteFilter(id) {
  emit('delete-filter', id)
}
</script>
