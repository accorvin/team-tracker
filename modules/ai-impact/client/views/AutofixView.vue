<script setup>
import { ref } from 'vue'
import { useAutofix } from '../composables/useAutofix.js'
import AutofixContent from '../components/AutofixContent.vue'

const timeWindow = ref('month')
const { autofixData, loading, error, load } = useAutofix(timeWindow)
</script>

<template>
  <div class="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
    <AutofixContent
      :loading="loading"
      :error="error"
      :autofixData="autofixData"
      :timeWindow="timeWindow"
      @update:timeWindow="timeWindow = $event"
      @retry="load"
    />
  </div>
</template>
