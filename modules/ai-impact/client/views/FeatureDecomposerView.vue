<script setup>
import { useDecomposer } from '../composables/useDecomposer.js'
import DecomposerContent from '../components/DecomposerContent.vue'

const { snapshot, loading, error, load } = useDecomposer()
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
    <DecomposerContent
      :snapshot="snapshot"
      :loading="loading"
      :error="error"
      @retry="load"
    />
  </div>
</template>
