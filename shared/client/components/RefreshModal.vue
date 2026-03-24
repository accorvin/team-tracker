<template>
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="$emit('cancel')"
  >
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">Refresh Data</h2>
        <button @click="$emit('cancel')" class="text-gray-400 hover:text-gray-600">
          <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="px-6 py-5 space-y-4">
        <p class="text-sm text-gray-600">
          {{ scopeLabel }}
        </p>

        <p class="text-sm text-gray-500">
          By default, only new data since the last refresh will be fetched.
        </p>

        <!-- Data sources -->
        <div>
          <p class="text-sm font-medium text-gray-700 mb-2">Data sources:</p>
          <div class="space-y-2">
            <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" v-model="localSources.jira" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Jira metrics
            </label>
            <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" v-model="localSources.github" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              GitHub contributions
            </label>
            <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" v-model="localSources.gitlab" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              GitLab contributions
            </label>
          </div>
        </div>

        <!-- Force refresh -->
        <label class="flex items-start gap-2 text-sm text-gray-700 cursor-pointer pt-2 border-t border-gray-100">
          <input type="checkbox" v-model="forceRefresh" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mt-0.5" />
          <span>
            Force full refresh
            <span class="text-gray-500 block text-xs">Re-fetch all history, ignoring cache</span>
          </span>
        </label>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
        <button
          @click="$emit('cancel')"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          @click="handleConfirm"
          :disabled="!anySourceSelected"
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

defineProps({
  scopeLabel: { type: String, required: true }
})

const emit = defineEmits(['confirm', 'cancel'])

const forceRefresh = ref(false)
const localSources = ref({
  jira: true,
  github: true,
  gitlab: true
})

const anySourceSelected = computed(() =>
  localSources.value.jira || localSources.value.github || localSources.value.gitlab
)

function handleConfirm() {
  emit('confirm', {
    force: forceRefresh.value,
    sources: { ...localSources.value }
  })
}
</script>
