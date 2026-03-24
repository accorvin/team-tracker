<template>
  <select
    :value="selectedSprintId"
    @change="$emit('select-sprint', Number($event.target.value))"
    class="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
  >
    <optgroup v-if="activeSprints.length" label="Active">
      <option v-for="sprint in activeSprints" :key="sprint.id" :value="sprint.id">
        {{ sprint.name }}
      </option>
    </optgroup>
    <optgroup v-if="closedSprints.length" label="Closed">
      <option v-for="sprint in closedSprints" :key="sprint.id" :value="sprint.id">
        {{ sprint.name }}
      </option>
    </optgroup>
  </select>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  sprints: { type: Array, required: true },
  selectedSprintId: { type: Number, default: null }
})

defineEmits(['select-sprint'])

const activeSprints = computed(() =>
  props.sprints.filter(s => s.state === 'active')
)

const closedSprints = computed(() =>
  props.sprints
    .filter(s => s.state === 'closed')
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
)
</script>
