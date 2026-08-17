<template>
  <div
    class="fixed inset-0 bg-gray-900/10 dark:bg-black/20 flex items-center justify-center z-50"
    data-testid="allocation-settings-modal"
    @click.self="close"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl ring-1 ring-black/10 dark:ring-white/10 w-full max-w-md mx-4">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Allocation settings</h2>
        <button
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
          :disabled="saving"
          aria-label="Close"
          @click="close"
        >
          <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="px-6 py-5 space-y-4">
        <div>
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Calculate allocation by</p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Sets how this team's work is weighted across categories — everywhere allocation is
            summarized, including the org report.
          </p>

          <p
            v-if="isFirstTime"
            data-testid="allocation-settings-firsttime"
            class="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 mb-3"
          >
            This team hasn't been configured yet. Pick a basis so it's counted correctly in org reports.
          </p>

          <div class="space-y-2">
            <label class="flex items-start gap-2 text-sm cursor-pointer p-2 rounded-md border"
              :class="selectedMode === 'points' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700'">
              <input type="radio" value="points" v-model="selectedMode" class="mt-0.5 text-primary-600 focus:ring-primary-500" />
              <span>
                <span class="font-medium text-gray-900 dark:text-gray-100">Story Points</span>
                <span class="block text-xs text-gray-500 dark:text-gray-400">Weight by estimate — a 5-point issue counts more than a 1-point one. Unestimated issues are excluded.</span>
              </span>
            </label>
            <label class="flex items-start gap-2 text-sm cursor-pointer p-2 rounded-md border"
              :class="selectedMode === 'counts' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700'">
              <input type="radio" value="counts" v-model="selectedMode" class="mt-0.5 text-primary-600 focus:ring-primary-500" />
              <span>
                <span class="font-medium text-gray-900 dark:text-gray-100">Issue Count</span>
                <span class="block text-xs text-gray-500 dark:text-gray-400">Weight every issue equally, regardless of estimate.</span>
              </span>
            </label>
          </div>
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
          Saving re-runs this team's allocation so the change takes effect right away.
        </p>

        <p v-if="error" class="text-sm text-red-600 dark:text-red-400" data-testid="allocation-settings-error">{{ error }}</p>
        <p v-else-if="saving && progressMessage" class="text-sm text-gray-500 dark:text-gray-400" data-testid="allocation-settings-progress">{{ progressMessage }}</p>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
        <button
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          :disabled="saving"
          @click="close"
        >
          Cancel
        </button>
        <button
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
          :disabled="saving || selectedMode === currentMode"
          data-testid="allocation-settings-save"
          @click="save"
        >
          <svg v-if="saving" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          {{ saving ? 'Saving…' : 'Save changes' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { updateTeamAllocationSettings } from '../services/allocation-api'
import { useAllocationRefresh } from '../composables/useAllocationRefresh'

const props = defineProps({
  teamId: { type: String, required: true },
  // null/absent means the team has never been configured — the modal then
  // requires an explicit choice before Save enables.
  currentMode: { type: String, default: null }
})

const emit = defineEmits(['close', 'saved'])

const isFirstTime = computed(() => props.currentMode !== 'points' && props.currentMode !== 'counts')
const selectedMode = ref(isFirstTime.value ? null : props.currentMode)
const saving = ref(false)
const error = ref('')

const { message: progressMessage, triggerRefresh } = useAllocationRefresh()

function close() {
  if (saving.value) return
  emit('close')
}

async function save() {
  if (selectedMode.value === props.currentMode) return
  saving.value = true
  error.value = ''
  try {
    await updateTeamAllocationSettings(props.teamId, selectedMode.value)
    // Re-run this team's allocation so summaries reflect the new basis.
    await triggerRefresh({ teamId: props.teamId })
    emit('saved', selectedMode.value)
  } catch (e) {
    error.value = e?.status === 403
      ? "You don't have permission to change this team's settings."
      : 'Could not save settings. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>
