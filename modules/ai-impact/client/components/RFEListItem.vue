<script setup>
defineProps({
  rfe: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})

const emit = defineEmits(['select'])

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
  <div
    @click="emit('select', rfe)"
    class="p-4 rounded-lg border cursor-pointer transition-all"
    :class="{
      'border-primary-500 bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-500': selected,
      'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700': !selected
    }"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ rfe.key }}</span>
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :class="getInvolvementClass(rfe.aiInvolvement)"
          >
            {{ getInvolvementLabel(rfe.aiInvolvement) }}
          </span>
        </div>
        <h4 class="font-medium text-sm truncate dark:text-gray-200">{{ rfe.summary }}</h4>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ rfe.creatorDisplayName }} &bull; {{ new Date(rfe.created).toLocaleDateString() }}
        </p>
      </div>
      <span class="inline-flex items-center px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-xs capitalize shrink-0 dark:text-gray-300">
        {{ rfe.priority }}
      </span>
    </div>
  </div>
</template>
