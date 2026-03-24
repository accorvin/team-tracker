<template>
  <div class="relative" :style="{ height: height + 'px' }">
    <Doughnut :data="chartData" :options="chartOptions" @click="handleClick" ref="chartRef" />
  </div>
</template>

<script>
const DEFAULT_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
]
</script>

<script setup>
import { computed, ref } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps({
  labels: { type: Array, required: true },
  data: { type: Array, required: true },
  colors: { type: Array, default: () => DEFAULT_COLORS },
  height: { type: Number, default: 300 }
})

const emit = defineEmits(['slice-click'])

const chartRef = ref(null)

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [{
    data: props.data,
    backgroundColor: props.labels.map((_, i) => props.colors[i % props.colors.length]),
    borderWidth: 2,
    borderColor: '#fff'
  }]
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right',
      labels: {
        font: { size: 12 },
        padding: 12,
        usePointStyle: true,
        pointStyle: 'circle'
      }
    },
    tooltip: {
      callbacks: {
        label(context) {
          const total = context.dataset.data.reduce((sum, v) => sum + v, 0)
          const value = context.parsed
          const pct = total > 0 ? Math.round((value / total) * 100) : 0
          return `${context.label}: ${value} pts (${pct}%)`
        }
      }
    }
  },
  onClick(event, elements) {
    if (elements.length > 0) {
      const index = elements[0].index
      emit('slice-click', props.labels[index])
    }
  }
}))

function handleClick() {
  // Chart.js onClick is handled in chartOptions
}
</script>
