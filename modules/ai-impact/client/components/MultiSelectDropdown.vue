<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'All' },
  /** Optional test id on the open menu panel */
  testId: { type: String, default: null },
  menuClass: { type: String, default: 'w-56 max-h-56' },
  emptyText: { type: String, default: 'No options available' }
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const dropdownRef = ref(null)

const normalizedOptions = computed(() =>
  props.options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  )
)

const label = computed(() => {
  if (props.modelValue.length === 0) return props.placeholder
  if (props.modelValue.length === 1) {
    const opt = normalizedOptions.value.find(o => o.value === props.modelValue[0])
    return opt ? opt.label : props.modelValue[0]
  }
  return `${props.placeholder.replace(/^All\s+/i, '')} (${props.modelValue.length})`
})

function toggle(value) {
  const current = [...props.modelValue]
  const idx = current.indexOf(value)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(value)
  emit('update:modelValue', current)
}

function clearAll() {
  emit('update:modelValue', [])
}

function handleClickOutside(e) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside))
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <button
      type="button"
      class="text-sm border rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 inline-flex items-center justify-between gap-2 min-w-[8.5rem] focus:outline-none focus:ring-2 focus:ring-blue-500"
      :class="modelValue.length
        ? 'border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-300'
        : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'"
      @click.stop="open = !open"
    >
      <span class="truncate max-w-[10rem]">{{ label }}</span>
      <svg class="h-3.5 w-3.5 opacity-60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute z-20 mt-1 overflow-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg p-2 space-y-1"
      :class="menuClass"
      :data-testid="testId || undefined"
      @click.stop
    >
      <p v-if="!normalizedOptions.length" class="px-2 py-1 text-xs text-gray-400">{{ emptyText }}</p>
      <label
        v-for="opt in normalizedOptions"
        :key="opt.value"
        class="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer"
      >
        <input
          type="checkbox"
          :value="opt.value"
          :checked="modelValue.includes(opt.value)"
          class="rounded border-gray-300"
          @change="toggle(opt.value)"
        />
        {{ opt.label }}
      </label>
      <div class="sticky bottom-0 flex items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
        <button
          v-if="modelValue.length"
          type="button"
          class="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          @click="clearAll"
        >
          Clear
        </button>
        <button
          type="button"
          class="ml-auto px-2.5 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
          @click="open = false"
        >
          Done
        </button>
      </div>
    </div>
  </div>
</template>
