<template>
  <span v-if="direction !== 0" class="ml-1 text-xs" :class="colorClass">{{ arrow }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  current: { type: Number, default: null },
  previous: { type: Number, default: null }
})

const direction = computed(() => {
  if (props.current == null || props.previous == null) return 0
  if (props.current > props.previous) return 1
  if (props.current < props.previous) return -1
  return 0
})

const arrow = computed(() => direction.value > 0 ? '\u25B2' : '\u25BC')

const colorClass = computed(() =>
  direction.value > 0 ? 'text-green-600' : 'text-red-500'
)
</script>
