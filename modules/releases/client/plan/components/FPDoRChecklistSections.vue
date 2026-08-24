<script setup>
import { ref, computed } from 'vue'
import { partitionFpdorItemsForDisplay } from '../utils/fpdor-display.js'
import { fpdorItemSeverity, severityLabel } from '../utils/fpdor-severity.js'

var props = defineProps({
  items: { type: Array, required: true },
  compact: { type: Boolean, default: false }
})

var passedExpanded = ref(false)

var groups = computed(function() {
  return partitionFpdorItemsForDisplay(props.items)
})

var iconClass = computed(function() {
  return props.compact ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5'
})

var rowClass = computed(function() {
  return props.compact ? 'text-xs' : 'text-xs'
})

function itemNameClass(item) {
  if (item.pass === false) return 'text-gray-800 dark:text-gray-200 font-medium'
  if (item.state === 'not-applicable') return 'text-gray-500 dark:text-gray-400'
  if (item.pass === true) return 'text-gray-700 dark:text-gray-300'
  return 'text-gray-400 dark:text-gray-500'
}

function severityTitle(item) {
  if (item.pass !== false) return ''
  return severityLabel(fpdorItemSeverity(item.name)) + ' — ' + item.name
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="groups.failed.length">
      <p class="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-1">
        Needs attention ({{ groups.failed.length }})
      </p>
      <div class="space-y-1">
        <div
          v-for="item in groups.failed"
          :key="item.name"
          class="flex items-start gap-2"
          :class="rowClass"
          :title="severityTitle(item)"
        >
          <svg :class="iconClass + ' text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <div class="min-w-0 flex-1">
            <span :class="itemNameClass(item)">{{ item.name }}</span>
            <span class="ml-1 text-[10px] text-gray-400 dark:text-gray-500">({{ severityLabel(fpdorItemSeverity(item.name)) }})</span>
            <div v-if="item.detail" class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{{ item.detail }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="groups.notApplicable.length">
      <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
        Not applicable ({{ groups.notApplicable.length }})
      </p>
      <div class="space-y-1">
        <div v-for="item in groups.notApplicable" :key="item.name" class="flex items-start gap-2" :class="rowClass">
          <svg :class="iconClass + ' text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
          </svg>
          <div class="min-w-0">
            <span :class="itemNameClass(item)">{{ item.name }}</span>
            <div v-if="item.detail" class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{{ item.detail }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="groups.other.length">
      <div class="space-y-1">
        <div v-for="item in groups.other" :key="item.name" class="flex items-start gap-2" :class="rowClass">
          <svg :class="iconClass + ' text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
          </svg>
          <div class="min-w-0">
            <span :class="itemNameClass(item)">{{ item.name }}</span>
            <div v-if="item.detail" class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{{ item.detail }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="groups.passed.length">
      <button
        type="button"
        class="w-full flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        :aria-expanded="passedExpanded"
        @click="passedExpanded = !passedExpanded"
      >
        <span>Passed ({{ groups.passed.length }})</span>
        <svg
          class="w-3.5 h-3.5 transition-transform"
          :class="passedExpanded ? 'rotate-180' : ''"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div v-if="passedExpanded" class="space-y-1">
        <div v-for="item in groups.passed" :key="item.name" class="flex items-start gap-2" :class="rowClass">
          <svg :class="iconClass + ' text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <div class="min-w-0">
            <span :class="itemNameClass(item)">{{ item.name }}</span>
            <span v-if="item.humanVerified" class="inline-flex items-center ml-1 px-1 py-0 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" title="Human verified via strat-creator sign-off">Verified</span>
            <div v-if="item.detail" class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{{ item.detail }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
