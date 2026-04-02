<template>
  <div class="w-full">
    <div v-if="totalPoints === 0" data-testid="no-data" class="h-6 bg-gray-100 rounded text-center text-xs text-gray-400 leading-6">
      No points
    </div>
    <div v-else class="relative h-6 rounded overflow-visible flex">
      <div
        v-if="techDebtPercent > 0"
        data-testid="segment-tech-debt-quality"
        class="group/seg relative bg-amber-400 h-full flex items-center justify-center text-xs font-medium text-amber-900 rounded-l cursor-default "
        :class="{ 'rounded-r': featurePercent === 0 && learningPercent === 0 && uncategorizedPercent === 0 }"
        :style="{ width: techDebtPercent + '%' }"
        :title="`Tech Debt & Quality: ${buckets['tech-debt-quality']?.points || 0} pts (${techDebtPercent}%)`"
      >
        <span v-if="techDebtPercent >= 10">{{ techDebtPercent }}%</span>
        <div data-testid="tooltip" class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-xs font-medium rounded shadow-lg whitespace-nowrap opacity-0 group-hover/seg:opacity-100 pointer-events-none transition-opacity z-10">
          Tech Debt & Quality: {{ techDebtPercent }}%
          <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
      <div
        v-if="featurePercent > 0"
        data-testid="segment-new-features"
        class="group/seg relative bg-blue-400 h-full flex items-center justify-center text-xs font-medium text-blue-900 cursor-default"
        :class="{ 'rounded-r': learningPercent === 0 && uncategorizedPercent === 0 }"
        :style="{ width: featurePercent + '%' }"
        :title="`New Features: ${buckets['new-features']?.points || 0} pts (${featurePercent}%)`"
      >
        <span v-if="featurePercent >= 10">{{ featurePercent }}%</span>
        <div data-testid="tooltip" class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-xs font-medium rounded shadow-lg whitespace-nowrap opacity-0 group-hover/seg:opacity-100 pointer-events-none transition-opacity z-10">
          New Features: {{ featurePercent }}%
          <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
      <div
        v-if="learningPercent > 0"
        data-testid="segment-learning-enablement"
        class="group/seg relative bg-green-400 h-full flex items-center justify-center text-xs font-medium text-green-900 cursor-default"
        :class="{ 'rounded-r': uncategorizedPercent === 0 }"
        :style="{ width: learningPercent + '%' }"
        :title="`Learning & Enablement: ${buckets['learning-enablement']?.points || 0} pts (${learningPercent}%)`"
      >
        <span v-if="learningPercent >= 10">{{ learningPercent }}%</span>
        <div data-testid="tooltip" class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-xs font-medium rounded shadow-lg whitespace-nowrap opacity-0 group-hover/seg:opacity-100 pointer-events-none transition-opacity z-10">
          Learning & Enablement: {{ learningPercent }}%
          <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
      <div
        v-if="uncategorizedPercent > 0"
        data-testid="segment-uncategorized"
        class="group/seg relative bg-gray-400 h-full flex items-center justify-center text-xs font-medium text-gray-900 rounded-r cursor-default"
        :style="{ width: uncategorizedPercent + '%' }"
        :title="`Uncategorized: ${buckets['uncategorized']?.points || 0} pts (${uncategorizedPercent}%)`"
      >
        <span v-if="uncategorizedPercent >= 10">{{ uncategorizedPercent }}%</span>
        <div data-testid="tooltip" class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-xs font-medium rounded shadow-lg whitespace-nowrap opacity-0 group-hover/seg:opacity-100 pointer-events-none transition-opacity z-10">
          Uncategorized: {{ uncategorizedPercent }}%
          <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>

      <!-- Target marker lines at 40% and 80% -->
      <div
        data-testid="target-marker"
        class="absolute top-0 bottom-0 w-px border-l border-dashed border-gray-600 opacity-50"
        style="left: 40%"
      ></div>
      <div
        data-testid="target-marker"
        class="absolute top-0 bottom-0 w-px border-l border-dashed border-gray-600 opacity-50"
        style="left: 80%"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  buckets: {
    type: Object,
    required: true
  },
  totalPoints: {
    type: Number,
    required: true
  }
})

const techDebtPercent = computed(() => {
  if (props.totalPoints === 0) return 0
  return Math.round((props.buckets['tech-debt-quality']?.points || 0) / props.totalPoints * 100)
})

const featurePercent = computed(() => {
  if (props.totalPoints === 0) return 0
  return Math.round((props.buckets['new-features']?.points || 0) / props.totalPoints * 100)
})

const learningPercent = computed(() => {
  if (props.totalPoints === 0) return 0
  return Math.round((props.buckets['learning-enablement']?.points || 0) / props.totalPoints * 100)
})

const uncategorizedPercent = computed(() => {
  if (props.totalPoints === 0) return 0
  return Math.round((props.buckets['uncategorized']?.points || 0) / props.totalPoints * 100)
})
</script>
