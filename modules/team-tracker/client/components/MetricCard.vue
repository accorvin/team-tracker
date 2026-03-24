<template>
  <div
    class="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-primary-300 hover:shadow-sm transition-all"
    :class="{ 'border-amber-300 bg-amber-50': warning }"
    @click="$emit('click')"
  >
    <div class="flex items-center justify-between mb-1">
      <span class="text-sm text-gray-500">{{ label }}</span>
      <MethodologyInfo v-if="tooltip" :text="tooltip" />
    </div>
    <div class="flex items-baseline gap-2">
      <span class="text-2xl font-bold" :class="valueColorClass">{{ displayValue }}</span>
      <span v-if="unit" class="text-sm text-gray-500">{{ unit }}</span>
    </div>
    <p v-if="subtitle" class="text-xs text-gray-400 mt-1">{{ subtitle }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MethodologyInfo from './MethodologyInfo.vue'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], default: null },
  unit: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  tooltip: { type: String, default: '' },
  warning: { type: Boolean, default: false },
  colorThresholds: { type: Object, default: null }
})

defineEmits(['click'])

const displayValue = computed(() => {
  if (props.value == null || props.value === '') return '--'
  if (typeof props.value === 'number') {
    return props.unit === '%' ? Math.round(props.value) : props.value
  }
  return props.value
})

const valueColorClass = computed(() => {
  if (!props.colorThresholds || props.value == null) return 'text-gray-900'
  const { good, warn } = props.colorThresholds
  if (good != null && props.value >= good) return 'text-green-600'
  if (warn != null && props.value >= warn) return 'text-amber-600'
  return 'text-red-600'
})
</script>
