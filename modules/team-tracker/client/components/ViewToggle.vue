<template>
  <div class="inline-flex rounded-md shadow-sm">
    <button
      @click="$emit('update:modelValue', 'cards')"
      class="px-3 py-1.5 text-sm font-medium rounded-l-md border"
      :class="modelValue === 'cards'
        ? 'bg-primary-600 text-white border-primary-600'
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
    >
      <svg class="h-4 w-4 inline-block mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
      Cards
    </button>
    <button
      @click="$emit('update:modelValue', 'table')"
      class="px-3 py-1.5 text-sm font-medium rounded-r-md border border-l-0"
      :class="modelValue === 'table'
        ? 'bg-primary-600 text-white border-primary-600'
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
    >
      <svg class="h-4 w-4 inline-block mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
      Table
    </button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, required: true }
})
defineEmits(['update:modelValue'])
</script>
