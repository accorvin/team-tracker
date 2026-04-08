<template>
  <div class="space-y-6">
    <!-- AI SDLC Docs -->
    <h2 class="text-lg font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">AI SDLC Docs</h2>

    <!-- RFE Review Enablement -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">RFE Review Enablement</h3>
      <div class="flex flex-wrap gap-4">
        <a
          v-for="link in rfeLinks"
          :key="link.label"
          :href="link.url"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200"
        >
          <component :is="link.icon" :size="18" :stroke-width="1.7" class="flex-shrink-0 text-gray-500 dark:text-gray-400" />
          <span>{{ link.label }}</span>
          <ExternalLink :size="14" class="flex-shrink-0 text-gray-400 dark:text-gray-500" />
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Video, Presentation, StickyNote, Play, ExternalLink } from 'lucide-vue-next'

const rfeLinks = [
  { label: 'Enablement Recording', icon: Video, url: 'https://drive.google.com/file/d/1qZomlB-TK2FODtmvjzpMeH_g5qpuAOh-/view?usp=sharing' },
  { label: 'Enablement Slides', icon: Presentation, url: 'https://docs.google.com/presentation/d/1O-F8naJxAfYtcXjTJHySYjeLtrKfb1OHhtyhoItya0s/edit?usp=sharing' },
  { label: 'Enablement Notes', icon: StickyNote, url: 'https://docs.google.com/document/d/1pTpIvKkYns2aG5g0ueOxy6P8j1m_yNnD13XBB35NgWQ/edit?usp=sharing' },
  { label: 'Demo', icon: Play, url: 'https://drive.google.com/file/d/1ANaZOeUorSMqlFm3WzfK1xRPvld2TGM-/view' }
]
</script>
