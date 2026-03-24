<template>
  <div
    v-if="!isConfigured && !loading"
    class="bg-amber-50 border-b border-amber-200"
  >
    <div class="px-6 lg:px-8 py-3 flex items-center justify-between">
      <div class="flex items-center gap-2 text-sm text-amber-800">
        <svg class="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span>
          Roster sync is not configured. Set up org roots to automatically populate the team roster from LDAP.
        </span>
      </div>
      <button
        @click="$emit('go-settings')"
        class="px-3 py-1 text-sm font-medium text-amber-800 bg-amber-200 rounded-md hover:bg-amber-300 transition-colors whitespace-nowrap"
      >
        Go to Settings
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { isRosterSyncConfigured } from '@shared/client/services/api'

defineEmits(['go-settings'])

const isConfigured = ref(true)
const loading = ref(true)

onMounted(async () => {
  try {
    const data = await isRosterSyncConfigured()
    isConfigured.value = data.configured === true
  } catch {
    // If the check fails, don't show the banner
    isConfigured.value = true
  } finally {
    loading.value = false
  }
})
</script>
