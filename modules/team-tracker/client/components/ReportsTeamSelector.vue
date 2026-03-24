<template>
  <div>
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Teams</h3>
      <div class="flex gap-2 text-xs">
        <button @click="selectAll" class="text-primary-600 hover:text-primary-800">All</button>
        <button @click="selectNone" class="text-primary-600 hover:text-primary-800">None</button>
      </div>
    </div>
    <div class="max-h-64 overflow-y-auto space-y-1">
      <label
        v-for="team in teams"
        :key="team.key"
        class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
      >
        <input
          type="checkbox"
          :value="team.key"
          :checked="modelValue.includes(team.key)"
          @change="toggle(team.key)"
          class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <span class="text-sm text-gray-700 truncate">{{ team.displayName }}</span>
        <span class="text-xs text-gray-400 ml-auto shrink-0">{{ team.members.length }}</span>
      </label>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  teams: { type: Array, required: true },
  modelValue: { type: Array, required: true }
})
const emit = defineEmits(['update:modelValue'])

function toggle(key) {
  const current = [...props.modelValue]
  const idx = current.indexOf(key)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(key)
  }
  emit('update:modelValue', current)
}

function selectAll() {
  emit('update:modelValue', props.teams.map(t => t.key))
}

function selectNone() {
  emit('update:modelValue', [])
}
</script>
