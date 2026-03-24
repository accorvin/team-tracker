<template>
  <div class="relative inline-block">
    <button
      @mouseenter="show = true"
      @mouseleave="show = false"
      @click.stop="show = !show"
      class="text-gray-400 hover:text-gray-600 transition-colors"
      type="button"
    >
      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
    <div
      v-if="show"
      class="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg"
    >
      {{ text }}
      <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
        <div class="w-2 h-2 bg-gray-900 rotate-45"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  text: { type: String, required: true }
})

const show = ref(false)
</script>
