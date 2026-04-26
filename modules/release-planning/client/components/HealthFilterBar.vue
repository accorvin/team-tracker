<script setup>
defineProps({
  riskFilter: { type: String, default: '' },
  dorFilter: { type: String, default: '' },
  bigRockFilter: { type: String, default: '' },
  componentFilter: { type: String, default: '' },
  tierFilter: { type: String, default: '' },
  searchQuery: { type: String, default: '' },
  bigRocks: { type: Array, default: () => [] },
  components: { type: Array, default: () => [] },
  hasActiveFilters: { type: Boolean, default: false }
})

defineEmits([
  'update:riskFilter',
  'update:dorFilter',
  'update:bigRockFilter',
  'update:componentFilter',
  'update:tierFilter',
  'update:searchQuery',
  'clearFilters'
])

var selectClass = 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500'
</script>

<template>
  <div class="flex flex-wrap gap-3 items-center">
    <input
      :value="searchQuery"
      @input="$emit('update:searchQuery', $event.target.value)"
      type="text"
      placeholder="Search features..."
      aria-label="Search features"
      class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
    />

    <select
      :value="riskFilter"
      @change="$emit('update:riskFilter', $event.target.value)"
      :class="selectClass"
      aria-label="Filter by risk level"
    >
      <option value="">All Risk Levels</option>
      <option value="green">Green - On Track</option>
      <option value="yellow">Yellow - At Risk</option>
      <option value="red">Red - Critical</option>
    </select>

    <select
      :value="dorFilter"
      @change="$emit('update:dorFilter', $event.target.value)"
      :class="selectClass"
      aria-label="Filter by DoR status"
    >
      <option value="">All DoR Status</option>
      <option value="complete">DoR Complete (80%+)</option>
      <option value="partial">DoR Partial (50-79%)</option>
      <option value="incomplete">DoR Incomplete (&lt;50%)</option>
    </select>

    <select
      v-if="bigRocks.length > 0"
      :value="bigRockFilter"
      @change="$emit('update:bigRockFilter', $event.target.value)"
      :class="selectClass"
      aria-label="Filter by Big Rock"
    >
      <option value="">All Big Rocks</option>
      <option v-for="rock in bigRocks" :key="rock" :value="rock">{{ rock }}</option>
    </select>

    <select
      v-if="components.length > 0"
      :value="componentFilter"
      @change="$emit('update:componentFilter', $event.target.value)"
      :class="selectClass"
      aria-label="Filter by component"
    >
      <option value="">All Components</option>
      <option v-for="comp in components" :key="comp" :value="comp">{{ comp }}</option>
    </select>

    <select
      :value="tierFilter"
      @change="$emit('update:tierFilter', $event.target.value)"
      :class="selectClass"
      aria-label="Filter by tier"
    >
      <option value="">All Tiers</option>
      <option value="1">Tier 1</option>
      <option value="2">Tier 2</option>
      <option value="3">Tier 3</option>
    </select>

    <button
      v-if="hasActiveFilters"
      class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      @click="$emit('clearFilters')"
    >
      Clear Filters
    </button>
  </div>
</template>
