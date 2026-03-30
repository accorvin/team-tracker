<script setup>
import PipelineTimeline from './PipelineTimeline.vue'

defineProps({
  rfe: { type: Object, required: true },
  phases: { type: Array, required: true },
  jiraHost: { type: String, default: null }
})

const emit = defineEmits(['close'])

function getInvolvementLabel(involvement) {
  switch (involvement) {
    case 'both': return 'Created & Assessed'
    case 'created': return 'AI Created'
    case 'assessed': return 'AI Assessed'
    default: return 'No AI'
  }
}

function getInvolvementClass(involvement) {
  switch (involvement) {
    case 'both': return 'bg-blue-500 text-white'
    case 'created': return 'bg-green-500 text-white'
    case 'assessed': return 'bg-amber-500 text-white'
    default: return 'bg-gray-200 text-gray-600'
  }
}
</script>

<template>
  <aside class="w-96 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 flex flex-col transition-transform">
    <header class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <h3 class="font-semibold dark:text-gray-100">RFE Details</h3>
      <button @click="emit('close')" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
        <svg class="h-4 w-4 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </header>

    <div class="flex-1 overflow-auto p-4">
      <div class="mb-4">
        <div class="flex items-center gap-2">
          <a
            v-if="jiraHost"
            :href="`${jiraHost}/browse/${rfe.key}`"
            target="_blank"
            rel="noopener noreferrer"
            class="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {{ rfe.key }}
          </a>
          <span v-else class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ rfe.key }}</span>
        </div>
        <h4 class="font-medium mt-1 dark:text-gray-200">{{ rfe.summary }}</h4>
      </div>

      <div class="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Author</p>
          <p class="font-medium dark:text-gray-200">{{ rfe.creatorDisplayName }}</p>
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Created</p>
          <p class="font-medium dark:text-gray-200">{{ new Date(rfe.created).toLocaleDateString() }}</p>
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Priority</p>
          <span class="inline-flex items-center px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-xs capitalize dark:text-gray-300">
            {{ rfe.priority }}
          </span>
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">AI Involvement</p>
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :class="getInvolvementClass(rfe.aiInvolvement)"
          >
            {{ getInvolvementLabel(rfe.aiInvolvement) }}
          </span>
        </div>
      </div>

      <PipelineTimeline :rfe="rfe" :phases="phases" :jiraHost="jiraHost" />
    </div>
  </aside>
</template>
