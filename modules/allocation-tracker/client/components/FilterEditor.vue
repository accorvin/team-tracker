<template>
  <div
    data-testid="filter-editor-backdrop"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="$emit('cancel')"
  >
    <div
      data-testid="filter-editor-modal"
      class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
      @click.stop
    >
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">
          {{ filter ? 'Edit Filter' : 'New Filter' }}
        </h2>
      </div>

      <div class="px-6 py-4 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Filter Name</label>
          <input
            data-testid="filter-name-input"
            v-model="name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
            placeholder="e.g. My Teams"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-sm font-medium text-gray-700">Teams</label>
            <div class="flex gap-2">
              <button
                data-testid="select-all-button"
                @click="selectAll"
                class="text-xs text-primary-600 hover:text-primary-800"
              >
                Select All
              </button>
              <span class="text-gray-300">|</span>
              <button
                data-testid="deselect-all-button"
                @click="deselectAll"
                class="text-xs text-primary-600 hover:text-primary-800"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div class="max-h-60 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
            <label
              v-for="board in boards"
              :key="board.id"
              :data-testid="`board-label-${board.id}`"
              class="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                :data-testid="`board-checkbox-${board.id}`"
                type="checkbox"
                :value="board.id"
                v-model="selectedBoardIds"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700">{{ board.displayName || board.name }}</span>
            </label>
          </div>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
        <button
          data-testid="cancel-filter-button"
          @click="$emit('cancel')"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          data-testid="save-filter-button"
          @click="save"
          :disabled="!canSave"
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  boards: {
    type: Array,
    required: true
  },
  filter: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['save', 'cancel'])

const name = ref(props.filter?.name || '')
const selectedBoardIds = ref(props.filter?.boardIds ? [...props.filter.boardIds] : [])

const canSave = computed(() => {
  return name.value.trim().length > 0 && selectedBoardIds.value.length > 0
})

function selectAll() {
  selectedBoardIds.value = props.boards.map(b => b.id)
}

function deselectAll() {
  selectedBoardIds.value = []
}

function save() {
  emit('save', {
    name: name.value.trim(),
    boardIds: [...selectedBoardIds.value].sort((a, b) => a - b)
  })
}
</script>
