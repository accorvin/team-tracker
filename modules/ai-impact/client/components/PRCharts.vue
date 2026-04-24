<script setup>
import { computed, ref } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  Filler,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, BarController, Filler, Tooltip, Legend)

const props = defineProps({
  metrics: { type: Object, required: true },
  trendData: { type: Array, default: () => [] }
})

const chartsExpanded = ref(true)

// ─── Aging panel ───

const agingSegments = computed(() => {
  const a = props.metrics.aging
  if (!a) return []
  return [
    { label: '< 1d', count: a.best || 0, color: 'bg-green-500', textClass: 'text-green-600 dark:text-green-400' },
    { label: '1d – 2d', count: a.green || 0, color: 'bg-lime-500', textClass: 'text-lime-600 dark:text-lime-400' },
    { label: '2d – 1w', count: a.yellow || 0, color: 'bg-amber-500', textClass: 'text-amber-600 dark:text-amber-400' },
    { label: '1w – 2w', count: a.orange || 0, color: 'bg-orange-500', textClass: 'text-orange-600 dark:text-orange-400' },
    { label: '> 2w', count: a.red || 0, color: 'bg-red-500', textClass: 'text-red-600 dark:text-red-400' }
  ]
})

const agingTotal = computed(() => agingSegments.value.reduce((s, v) => s + v.count, 0))

// ─── Velocity chart (combo: line + bars) ───

const BUCKET_COLORS = {
  XS: { line: '#22c55e', label: 'XS (<50)' },
  S: { line: '#84cc16', label: 'S (50-199)' },
  M: { line: '#f59e0b', label: 'M (200-999)' },
  L: { line: '#f97316', label: 'L (1k-2.5k)' },
  XL: { line: '#ef4444', label: 'XL (2.5k+)' }
}

const hasVelocityData = computed(() => props.trendData.some(p => p.mergedCount > 0 || p.openedCount > 0 || p.closedCount > 0))

const velocityChartData = computed(() => {
  const labels = props.trendData.map(p => p.weekEnding)
  const datasets = [
    {
      label: 'Merged PRs',
      data: props.trendData.map(p => p.mergedCount),
      backgroundColor: 'rgba(99, 102, 241, 0.6)',
      type: 'bar',
      yAxisID: 'yPRs',
      order: 2
    },
    {
      label: 'Opened PRs',
      data: props.trendData.map(p => p.openedCount || 0),
      backgroundColor: 'rgba(148, 163, 184, 0.5)',
      type: 'bar',
      yAxisID: 'yPRs',
      order: 2
    },
    {
      label: 'PRs Closed',
      data: props.trendData.map(p => p.closedCount || 0),
      backgroundColor: 'rgba(185, 28, 28, 0.7)',
      type: 'bar',
      yAxisID: 'yPRs',
      order: 2
    },
    {
      label: 'Median Cycle Time',
      data: props.trendData.map(p => p.medianCycleTimeHours),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      fill: false,
      tension: 0.3,
      type: 'line',
      yAxisID: 'yCycleTime',
      pointRadius: 3,
      borderWidth: 2,
      order: 1
    }
  ]

  return { labels, datasets }
})

const velocityChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top', labels: { font: { size: 11 } } }
  },
  scales: {
    x: { ticks: { font: { size: 10 }, maxRotation: 0 } },
    yPRs: {
      beginAtZero: true,
      position: 'left',
      ticks: { font: { size: 10 }, precision: 0 },
      title: { display: true, text: 'PRs', font: { size: 11 } }
    },
    yCycleTime: {
      beginAtZero: true,
      position: 'right',
      grid: { drawOnChartArea: false },
      ticks: { font: { size: 10 } },
      title: { display: true, text: 'Cycle Time (h)', font: { size: 11 } }
    }
  }
}

// ─── Cycle Time by Size chart ───

const BUCKET_ORDER = ['XS', 'S', 'M', 'L', 'XL']

const hasSizeCycleData = computed(() =>
  props.trendData.some(p => p.sizeCycleTimes && Object.keys(p.sizeCycleTimes).length > 0)
)

const activeBuckets = computed(() => {
  const seen = new Set()
  for (const p of props.trendData) {
    if (p.sizeCycleTimes) {
      for (const k of Object.keys(p.sizeCycleTimes)) seen.add(k)
    }
  }
  return BUCKET_ORDER.filter(b => seen.has(b))
})

const sizeCycleChartData = computed(() => {
  const labels = props.trendData.map(p => p.weekEnding)
  const datasets = activeBuckets.value.map(bucket => ({
    label: BUCKET_COLORS[bucket]?.label || bucket,
    data: props.trendData.map(p => p.sizeCycleTimes?.[bucket] ?? null),
    borderColor: BUCKET_COLORS[bucket]?.line || '#9ca3af',
    backgroundColor: 'transparent',
    tension: 0.3,
    pointRadius: 3,
    borderWidth: 2,
    spanGaps: true
  }))
  return { labels, datasets }
})

const sizeCycleChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top', labels: { font: { size: 11 } } }
  },
  scales: {
    x: { ticks: { font: { size: 10 }, maxRotation: 0 } },
    y: {
      beginAtZero: true,
      ticks: { font: { size: 10 } },
      title: { display: true, text: 'Cycle Time (h)', font: { size: 11 } }
    }
  }
}

// ─── AI vs Human Reviews chart ───

const hasReviewTrendData = computed(() =>
  props.trendData.some(p => (p.aiThreadCount || 0) + (p.humanThreadCount || 0) > 0 || p.medianLinesChanged != null)
)

const reviewTrendChartData = computed(() => {
  const labels = props.trendData.map(p => p.weekEnding)
  return {
    labels,
    datasets: [
      {
        label: 'AI Reviews',
        data: props.trendData.map(p => p.aiThreadCount || 0),
        borderColor: '#9333ea',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        pointRadius: 3,
        borderWidth: 2,
        yAxisID: 'yThreads'
      },
      {
        label: 'Human Reviews',
        data: props.trendData.map(p => p.humanThreadCount || 0),
        borderColor: '#0ea5e9',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        pointRadius: 3,
        borderWidth: 2,
        yAxisID: 'yThreads'
      },
      {
        label: 'Median PR Size',
        data: props.trendData.map(p => p.medianLinesChanged),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: false,
        tension: 0.3,
        pointRadius: 3,
        borderWidth: 2,
        borderDash: [6, 3],
        yAxisID: 'ySize',
        spanGaps: true
      }
    ]
  }
})

const reviewTrendChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top', labels: { font: { size: 11 } } }
  },
  scales: {
    x: { ticks: { font: { size: 10 }, maxRotation: 0 } },
    yThreads: {
      beginAtZero: true,
      position: 'left',
      ticks: { font: { size: 10 }, precision: 0 },
      title: { display: true, text: 'Review Threads', font: { size: 11 } }
    },
    ySize: {
      beginAtZero: true,
      position: 'right',
      grid: { drawOnChartArea: false },
      ticks: { font: { size: 10 }, precision: 0 },
      title: { display: true, text: 'Median Lines Changed', font: { size: 11 } }
    }
  }
}
</script>

<template>
  <div class="px-6 pb-6">
    <!-- Toggle -->
    <button
      @click="chartsExpanded = !chartsExpanded"
      class="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-3"
    >
      <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': chartsExpanded }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      {{ chartsExpanded ? 'Hide Charts' : 'Show Charts' }}
    </button>

    <div v-if="chartsExpanded" class="space-y-6">
      <!-- Row 1: Velocity Over Time (full width) -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Velocity Over Time</h3>
          <div class="relative group">
            <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
              Bars show weekly PR counts: merged, opened, and closed (without merge). The line tracks median cycle time (hours from PR creation to merge). When opened bars exceed merged bars, the review backlog is growing.
            </div>
          </div>
        </div>
        <div class="h-[220px]" v-if="hasVelocityData">
          <Line :data="velocityChartData" :options="velocityChartOptions" />
        </div>
        <div v-else class="h-[220px] flex items-center justify-center">
          <p class="text-sm text-gray-400 dark:text-gray-500">No PR activity in this period</p>
        </div>
      </div>

      <!-- Row 2: Cycle Time by Size (full width) -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Cycle Time by Size</h3>
          <div class="relative group">
            <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
              Median hours from PR creation to merge, grouped by total lines changed. XS: &lt;50, S: 50-199, M: 200-999, L: 1k-2.5k, XL: 2.5k+. Downward trends indicate faster review cycles.
            </div>
          </div>
        </div>
        <div class="h-[220px]" v-if="hasSizeCycleData">
          <Line :data="sizeCycleChartData" :options="sizeCycleChartOptions" />
        </div>
        <div v-else class="h-[220px] flex items-center justify-center">
          <p class="text-sm text-gray-400 dark:text-gray-500">No cycle time data by size yet</p>
        </div>
      </div>

      <!-- Row 3: Review Activity + Open PR Age (50/50) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Review Activity -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Review Activity</h3>
            <div class="relative group">
              <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                Weekly review thread counts from merged PRs, split by AI (bot) vs human reviewers. The dashed line shows median PR size (lines changed) to reveal whether review volume tracks with PR size or diverges.
              </div>
            </div>
          </div>
          <div class="h-[200px]" v-if="hasReviewTrendData">
            <Line :data="reviewTrendChartData" :options="reviewTrendChartOptions" />
          </div>
          <div v-else class="h-[200px] flex items-center justify-center">
            <p class="text-sm text-gray-400 dark:text-gray-500">No review data in this period</p>
          </div>
        </div>

        <!-- Open PR Age -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Open PR Age</h3>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-400 dark:text-gray-500">{{ agingTotal }} open</span>
              <div class="relative group">
                <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                  How long open PRs have been waiting since creation. Green (&lt;1d) is fresh, lime (1d-2d) is recent, amber (2d-1w) needs attention, orange (1w-2w) is aging, red (&gt;2w) is stale.
                </div>
              </div>
            </div>
          </div>

          <div class="flex h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 mb-4" v-if="agingTotal > 0">
            <div
              v-for="seg in agingSegments"
              :key="seg.label"
              class="transition-all duration-500"
              :class="seg.color"
              :style="{ width: (seg.count / agingTotal * 100) + '%' }"
              :title="`${seg.label}: ${seg.count}`"
            />
          </div>
          <div v-else class="h-6 flex items-center justify-center mb-4">
            <span class="text-xs text-gray-400 dark:text-gray-500">No open PRs</span>
          </div>

          <div class="space-y-2.5">
            <div v-for="seg in agingSegments" :key="seg.label" class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-sm shrink-0" :class="seg.color" />
                <span class="text-sm text-gray-600 dark:text-gray-300">{{ seg.label }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold" :class="seg.textClass">{{ seg.count }}</span>
                <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-right">{{ agingTotal > 0 ? Math.round(seg.count / agingTotal * 100) : 0 }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
