<template>
  <div v-if="sprintState === 'closed'" class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
    <h3 class="text-lg font-semibold text-gray-900 mb-3">Sprint Completion</h3>

    <div class="mb-4">
      <div class="flex justify-between text-sm text-gray-700 mb-1">
        <span>{{ summary.completedPoints }}/{{ summary.totalPoints }} pts completed</span>
        <span class="font-medium">{{ completionPercent }}%</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-3">
        <div
          data-testid="completion-bar"
          class="bg-green-500 h-3 rounded-full transition-all"
          :style="{ width: completionPercent + '%' }"
        ></div>
      </div>
    </div>

    <div class="space-y-2">
      <div
        v-for="bucket in visibleBuckets"
        :key="bucket.key"
        class="flex justify-between text-sm"
      >
        <span class="text-gray-600">{{ bucket.label }}</span>
        <span class="text-gray-900 font-medium">{{ bucket.completedPoints }}/{{ bucket.points }} pts</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  summary: {
    type: Object,
    required: true
  },
  sprintState: {
    type: String,
    required: true
  }
})

const completionPercent = computed(() => {
  if (props.summary.totalPoints === 0) return 0
  return Math.round((props.summary.completedPoints / props.summary.totalPoints) * 100)
})

const bucketLabels = {
  'tech-debt-quality': 'Tech Debt & Quality',
  'new-features': 'New Features',
  'learning-enablement': 'Learning & Enablement',
  'uncategorized': 'Uncategorized'
}

const visibleBuckets = computed(() => {
  return Object.entries(props.summary.buckets)
    .filter(([, data]) => data.points > 0)
    .map(([key, data]) => ({
      key,
      label: bucketLabels[key] || key,
      points: data.points,
      completedPoints: data.completedPoints
    }))
})
</script>
