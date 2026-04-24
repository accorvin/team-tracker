<script setup>
import { computed } from 'vue'

const props = defineProps({
  metrics: { type: Object, required: true }
})

function formatCycleTime(hours) {
  if (!hours || hours === 0) return '0h'
  if (hours < 24) return `${Math.round(hours)}h`
  const days = Math.round(hours / 24 * 10) / 10
  return `${days}d`
}

function cycleTimeDelta(current, prior) {
  if (!prior || prior === 0) return null
  const diff = current - prior
  const pct = Math.round((diff / prior) * 100)
  return { diff, pct, improved: diff < 0 }
}

function medianColorClass(hours) {
  if (!hours || hours === 0) return 'text-gray-900 dark:text-gray-100'
  if (hours < 24) return 'text-green-600 dark:text-green-400'
  if (hours < 72) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function p90ColorClass(hours) {
  if (!hours || hours === 0) return 'text-gray-900 dark:text-gray-100'
  if (hours < 48) return 'text-green-600 dark:text-green-400'
  if (hours < 96) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function aiReviewDelta(current, prior) {
  if (prior == null) return null
  const diff = current - prior
  if (diff === 0) return null
  return { diff, improved: diff > 0 }
}

const medianDelta = computed(() => cycleTimeDelta(props.metrics.medianCycleTimeHours, props.metrics.priorMedianCycleTimeHours))
const p90Delta = computed(() => cycleTimeDelta(props.metrics.p90CycleTimeHours, props.metrics.priorP90CycleTimeHours))
const aiDelta = computed(() => aiReviewDelta(props.metrics.aiReviewPct, props.metrics.priorAiReviewPct))
const humanPct = computed(() => props.metrics.aiReviewPct != null ? 100 - props.metrics.aiReviewPct : 0)
const priorHumanPct = computed(() => props.metrics.priorAiReviewPct != null ? 100 - props.metrics.priorAiReviewPct : 0)
const humanDelta = computed(() => aiReviewDelta(humanPct.value, priorHumanPct.value))
</script>

<template>
  <div class="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
    <!-- Median Cycle Time -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
      <div class="text-2xl font-bold" :class="medianColorClass(metrics.medianCycleTimeHours)">
        {{ formatCycleTime(metrics.medianCycleTimeHours) }}
      </div>
      <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">Median Cycle Time</div>
      <div class="text-[10px] mt-0.5 flex items-center justify-center gap-1">
        <template v-if="metrics.hasSufficientHistory && medianDelta">
          <svg
            v-if="medianDelta.improved"
            class="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"
          ><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          <svg
            v-else
            class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"
          ><path stroke-linecap="round" stroke-linejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
          <span :class="medianDelta.improved ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
            {{ medianDelta.improved ? '−' : '+' }}{{ Math.abs(medianDelta.pct) }}%
          </span>
        </template>
        <span v-else>&nbsp;</span>
      </div>
    </div>

    <!-- P90 Cycle Time -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
      <div class="text-2xl font-bold" :class="p90ColorClass(metrics.p90CycleTimeHours)">
        {{ formatCycleTime(metrics.p90CycleTimeHours) }}
      </div>
      <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">P90 Cycle Time</div>
      <div class="text-[10px] mt-0.5 flex items-center justify-center gap-1">
        <template v-if="metrics.hasSufficientHistory && p90Delta">
          <svg
            v-if="p90Delta.improved"
            class="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"
          ><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          <svg
            v-else
            class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"
          ><path stroke-linecap="round" stroke-linejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
          <span :class="p90Delta.improved ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
            {{ p90Delta.improved ? '−' : '+' }}{{ Math.abs(p90Delta.pct) }}%
          </span>
        </template>
        <span v-else>&nbsp;</span>
      </div>
    </div>

    <!-- PRs Merged -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
      <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{{ metrics.mergedCount }}</div>
      <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">Merged PRs</div>
      <div class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">&nbsp;</div>
    </div>

    <!-- AI Reviews -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
      <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">
        {{ metrics.aiThreadCount }} <span class="text-lg">({{ metrics.aiReviewPct }}%)</span>
      </div>
      <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">AI Reviews</div>
      <div class="text-[10px] mt-0.5 flex items-center justify-center gap-1">
        <template v-if="metrics.hasSufficientHistory && aiDelta">
          <svg
            v-if="aiDelta.improved"
            class="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"
          ><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          <svg
            v-else
            class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"
          ><path stroke-linecap="round" stroke-linejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
          <span :class="aiDelta.improved ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
            {{ aiDelta.improved ? '+' : '−' }}{{ Math.abs(aiDelta.diff) }}pp
          </span>
        </template>
        <span v-else class="text-gray-400 dark:text-gray-500">of {{ metrics.aiThreadCount + metrics.humanThreadCount }} threads</span>
      </div>
    </div>

    <!-- Human Reviews -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
      <div class="text-2xl font-bold text-sky-600 dark:text-sky-400">
        {{ metrics.humanThreadCount }} <span class="text-lg">({{ humanPct }}%)</span>
      </div>
      <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">Human Reviews</div>
      <div class="text-[10px] mt-0.5 flex items-center justify-center gap-1">
        <template v-if="metrics.hasSufficientHistory && humanDelta">
          <svg
            v-if="humanDelta.improved"
            class="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"
          ><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          <svg
            v-else
            class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"
          ><path stroke-linecap="round" stroke-linejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
          <span :class="humanDelta.improved ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
            {{ humanDelta.improved ? '+' : '−' }}{{ Math.abs(humanDelta.diff) }}pp
          </span>
        </template>
        <span v-else class="text-gray-400 dark:text-gray-500">of {{ metrics.aiThreadCount + metrics.humanThreadCount }} threads</span>
      </div>
    </div>
  </div>
</template>
