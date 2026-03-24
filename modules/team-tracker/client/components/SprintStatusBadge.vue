<template>
  <span :class="badgeClasses" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium">
    {{ capitalizedState }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  state: { type: String, required: true }
})

const capitalizedState = computed(() =>
  props.state.charAt(0).toUpperCase() + props.state.slice(1)
)

const badgeClasses = computed(() => {
  switch (props.state) {
    case 'active': return 'bg-green-100 text-green-800'
    case 'closed': return 'bg-gray-100 text-gray-800'
    case 'future': return 'bg-blue-100 text-blue-800'
    default: return 'bg-gray-100 text-gray-800'
  }
})
</script>
