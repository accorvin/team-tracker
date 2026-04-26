<script setup>
import { computed } from 'vue'

const props = defineProps({
  summary: { type: Object, default: null }
})

const emit = defineEmits(['filterByRisk'])

const greenCount = computed(function() {
  if (!props.summary || !props.summary.byRisk) return 0
  return props.summary.byRisk.green || 0
})

const yellowCount = computed(function() {
  if (!props.summary || !props.summary.byRisk) return 0
  return props.summary.byRisk.yellow || 0
})

const redCount = computed(function() {
  if (!props.summary || !props.summary.byRisk) return 0
  return props.summary.byRisk.red || 0
})

const dorPct = computed(function() {
  if (!props.summary) return 0
  return props.summary.dorCompletionRate || 0
})

const planningDeadline = computed(function() {
  if (!props.summary || !props.summary.planningDeadline) return null
  return props.summary.planningDeadline
})

const deadlineColorClass = computed(function() {
  if (!planningDeadline.value) return ''
  var days = planningDeadline.value.daysRemaining
  if (days < 0) return 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400'
  if (days <= 14) return 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
  return 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400'
})

function handleCardClick(level) {
  emit('filterByRisk', level)
}
</script>

<template>
  <div v-if="summary" class="grid grid-cols-2 lg:grid-cols-5 gap-4">
    <!-- Green -->
    <button
      type="button"
      class="p-4 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-left hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors cursor-pointer"
      @click="handleCardClick('green')"
    >
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-green-500 dark:bg-green-400 flex-shrink-0"></span>
        <span class="text-sm font-semibold text-green-700 dark:text-green-400">On Track</span>
      </div>
      <div class="mt-2">
        <span class="text-2xl font-bold text-green-700 dark:text-green-400">{{ greenCount }}</span>
        <span class="text-xs text-green-600/70 dark:text-green-400/70 ml-1">feature{{ greenCount !== 1 ? 's' : '' }}</span>
      </div>
    </button>

    <!-- Yellow -->
    <button
      type="button"
      class="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 text-left hover:bg-yellow-100 dark:hover:bg-yellow-500/20 transition-colors cursor-pointer"
      @click="handleCardClick('yellow')"
    >
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-yellow-500 dark:bg-yellow-400 flex-shrink-0"></span>
        <span class="text-sm font-semibold text-yellow-700 dark:text-yellow-400">At Risk</span>
      </div>
      <div class="mt-2">
        <span class="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{{ yellowCount }}</span>
        <span class="text-xs text-yellow-600/70 dark:text-yellow-400/70 ml-1">feature{{ yellowCount !== 1 ? 's' : '' }}</span>
      </div>
    </button>

    <!-- Red -->
    <button
      type="button"
      class="p-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-left hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors cursor-pointer"
      @click="handleCardClick('red')"
    >
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-red-500 dark:bg-red-400 flex-shrink-0"></span>
        <span class="text-sm font-semibold text-red-700 dark:text-red-400">Critical</span>
      </div>
      <div class="mt-2">
        <span class="text-2xl font-bold text-red-700 dark:text-red-400">{{ redCount }}</span>
        <span class="text-xs text-red-600/70 dark:text-red-400/70 ml-1">feature{{ redCount !== 1 ? 's' : '' }}</span>
      </div>
    </button>

    <!-- DoR completion -->
    <div class="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30">
      <div class="text-sm font-semibold text-indigo-700 dark:text-indigo-400">Definition of Ready</div>
      <div class="mt-2">
        <span class="text-2xl font-bold text-indigo-700 dark:text-indigo-400">{{ dorPct }}%</span>
        <span class="text-xs text-indigo-600/70 dark:text-indigo-400/70 ml-1">complete</span>
      </div>
      <div class="mt-2 w-full bg-indigo-200 dark:bg-indigo-500/20 rounded-full h-1.5">
        <div
          class="h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 transition-all"
          :style="{ width: Math.min(dorPct, 100) + '%' }"
        ></div>
      </div>
    </div>

    <!-- Planning Deadline -->
    <div v-if="planningDeadline" class="p-4 rounded-lg border" :class="deadlineColorClass">
      <div class="text-sm font-semibold">Planning Deadline</div>
      <div class="mt-2">
        <span class="text-2xl font-bold">{{ planningDeadline.daysRemaining }}</span>
        <span class="text-xs ml-1">{{ planningDeadline.daysRemaining === 1 ? 'day' : 'days' }} {{ planningDeadline.daysRemaining >= 0 ? 'remaining' : 'overdue' }}</span>
      </div>
      <div class="mt-1 text-xs opacity-70">{{ planningDeadline.date }}</div>
    </div>
  </div>
</template>
