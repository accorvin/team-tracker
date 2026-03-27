<template>
  <div class="space-y-6">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Snapshot Data</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Monthly metric snapshots are generated automatically for each team. Use this to delete all stored snapshots
        so they can be regenerated with the latest data.
      </p>

      <div class="flex items-center gap-3">
        <button
          @click="handleDelete"
          :disabled="deleting"
          class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ deleting ? 'Deleting...' : 'Delete All Snapshots' }}
        </button>
        <span v-if="message" class="text-sm" :class="isError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
          {{ message }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { deleteAllSnapshots } from '@shared/client/services/api'

const deleting = ref(false)
const message = ref(null)
const isError = ref(false)

async function handleDelete() {
  if (!confirm('Are you sure you want to delete all snapshots? They will be regenerated on the next view or scheduled sync.')) {
    return
  }

  deleting.value = true
  message.value = null
  isError.value = false

  try {
    const result = await deleteAllSnapshots()
    message.value = `Deleted ${result.deleted} snapshot file${result.deleted === 1 ? '' : 's'}.`
    setTimeout(() => { message.value = null }, 5000)
  } catch (err) {
    message.value = err.message
    isError.value = true
  } finally {
    deleting.value = false
  }
}
</script>
