<script setup>
defineProps({
  phases: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' }
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="flex items-center gap-2">
    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Phase:</label>
    <select
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
      class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
    >
      <option value="">All Phases</option>
      <option v-for="p in phases" :key="p.value" :value="p.value">
        {{ p.label }}
      </option>
    </select>
  </div>
</template>
