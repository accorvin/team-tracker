<template>
  <div
    v-if="isBackendDown"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
  >
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 text-center">
      <!-- Spinner -->
      <div class="flex justify-center mb-5">
        <div class="h-10 w-10 rounded-full border-4 border-gray-200 dark:border-gray-600 border-t-primary-500 animate-spin"></div>
      </div>

      <!-- Title -->
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        ⏳ Reconnecting to the server…
      </h2>

      <!-- Body -->
      <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        This usually means a deployment is in progress. Things should be back in a minute or two — we'll reconnect automatically.
      </p>

      <!-- Extended outage message -->
      <p
        v-if="isExtendedOutage"
        class="mt-4 text-sm text-gray-400 dark:text-gray-500"
      >
        Still trying… if this persists, check with your admin.
      </p>
    </div>
  </div>
</template>

<script setup>
import { useBackendHealth } from '@shared/client/composables/useBackendHealth'

const { isBackendDown, isExtendedOutage } = useBackendHealth()
</script>
