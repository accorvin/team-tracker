<template>
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">{{ assigneeName }}</h2>
          <p class="text-sm text-gray-500">{{ sprintName }}</p>
        </div>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
          <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Annotations list -->
      <div class="overflow-auto flex-1 px-6 py-4">
        <div v-if="annotations.length === 0" class="text-sm text-gray-400 italic text-center py-4">
          No annotations yet
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="annotation in annotations"
            :key="annotation.id"
            class="bg-gray-50 rounded-lg p-3 group"
          >
            <p class="text-sm text-gray-900">{{ annotation.text }}</p>
            <div class="flex items-center justify-between mt-2">
              <span class="text-xs text-gray-500">
                {{ annotation.author }} &middot; {{ formatTimestamp(annotation.createdAt) }}
              </span>
              <button
                @click="$emit('delete', annotation.id)"
                class="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Add annotation -->
      <div class="px-6 py-4 border-t border-gray-200 flex-shrink-0">
        <div class="flex gap-2">
          <input
            v-model="newText"
            type="text"
            placeholder="Add a note (e.g., PTO, ramp-up, team change)..."
            class="flex-1 text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            @keyup.enter="handleSave"
          />
          <button
            @click="handleSave"
            :disabled="!newText.trim()"
            class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Note
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  sprintName: { type: String, default: '' },
  assigneeName: { type: String, default: '' },
  annotations: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'save', 'delete'])

const newText = ref('')

function handleSave() {
  const text = newText.value.trim()
  if (!text) return
  emit('save', { text })
  newText.value = ''
}

function formatTimestamp(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
</script>
