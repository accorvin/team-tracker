<template>
  <div class="relative" style="height: 240px;">
    <Doughnut v-if="hasData" :data="chartData" :options="chartOptions" ref="chartRef" />
    <div v-if="hasData" class="absolute inset-0 flex items-center justify-center pointer-events-none" style="z-index: 1;">
      <div class="text-center bg-white dark:bg-gray-800 rounded-full px-4 py-2 shadow-sm">
        <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ overallPct }}%</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">TFA Complete</p>
      </div>
    </div>
    <!-- External HTML tooltip -->
    <div v-if="tooltip.visible" class="absolute bg-gray-900 text-white rounded-lg shadow-xl pointer-events-none" style="z-index: 10; min-width: 200px;" :style="tooltipStyle">
      <div class="px-3 py-2 border-b border-gray-700">
        <p class="font-bold text-sm">{{ tooltip.title }}</p>
      </div>
      <div class="px-3 py-2 space-y-1.5 text-xs">
        <div class="flex justify-between gap-4">
          <span class="text-gray-400">Sign-offs</span>
          <span class="font-medium">{{ tooltip.signoffs }}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-gray-400">Completion</span>
          <span class="font-medium">{{ tooltip.pct }}%</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-gray-400">Failed open</span>
          <span class="font-medium" :class="tooltip.failedOpen > 0 ? 'text-red-400' : ''">{{ tooltip.failedOpen }}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-gray-400">Risk</span>
          <span class="font-medium" :class="tooltip.riskColor">{{ tooltip.riskLabel }}</span>
        </div>
      </div>
      <div class="px-3 py-1.5 border-t border-gray-700 text-center text-gray-500 text-xs">Click to expand</div>
    </div>
    <div v-if="!hasData" class="flex items-center justify-center h-full">
      <p class="text-sm text-gray-400 dark:text-gray-500">No TFA data</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, reactive } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip)

var PILLAR_PALETTE = [
  { bg: 'rgba(59, 130, 246, 0.75)', border: 'rgb(59, 130, 246)' },
  { bg: 'rgba(139, 92, 246, 0.75)', border: 'rgb(139, 92, 246)' },
  { bg: 'rgba(20, 184, 166, 0.75)', border: 'rgb(20, 184, 166)' },
  { bg: 'rgba(245, 158, 11, 0.75)', border: 'rgb(245, 158, 11)' },
  { bg: 'rgba(236, 72, 153, 0.75)', border: 'rgb(236, 72, 153)' },
  { bg: 'rgba(16, 185, 129, 0.75)', border: 'rgb(16, 185, 129)' },
  { bg: 'rgba(239, 68, 68, 0.75)', border: 'rgb(239, 68, 68)' },
  { bg: 'rgba(107, 114, 128, 0.75)', border: 'rgb(107, 114, 128)' }
]

var RISK_LABELS = {
  green: 'On Track',
  yellow: 'At Risk',
  red: 'Likely Blocker'
}

var RISK_COLORS = {
  green: 'text-emerald-400',
  yellow: 'text-amber-400',
  red: 'text-red-400'
}

var props = defineProps({
  pillarData: { type: Array, required: true },
  overallPct: { type: Number, required: true },
  selectedPillar: { type: String, default: null },
  thresholds: { type: Object, default: function () { return { green: 80, yellow: 50 } } }
})

var emit = defineEmits(['select-pillar'])

var chartRef = ref(null)
var tooltip = reactive({
  visible: false, title: '', signoffs: '', pct: 0,
  failedOpen: 0, riskLabel: '', riskColor: '', x: 0, y: 0
})

var tooltipStyle = computed(function () {
  return {
    left: tooltip.x + 'px',
    top: Math.max(0, tooltip.y - 12) + 'px',
    transform: 'translate(-50%, -100%)'
  }
})

var hasData = computed(function () {
  return props.pillarData && props.pillarData.length > 0
})

var chartData = computed(function () {
  var labels = []
  var data = []
  var bgColors = []
  var borderColors = []
  var hoverBgColors = []

  for (var i = 0; i < props.pillarData.length; i++) {
    var p = props.pillarData[i]
    labels.push(p.pillarName)
    data.push(p.total || 1)
    var palette = PILLAR_PALETTE[i % PILLAR_PALETTE.length]
    var isSelected = props.selectedPillar === p.pillarName
    bgColors.push(isSelected ? palette.border : palette.bg)
    borderColors.push(palette.border)
    hoverBgColors.push(palette.border)
  }

  return {
    labels: labels,
    datasets: [{
      data: data,
      backgroundColor: bgColors,
      borderColor: borderColors,
      hoverBackgroundColor: hoverBgColors,
      borderWidth: 2,
      hoverOffset: 8
    }]
  }
})

var chartOptions = computed(function () {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    onHover: function (event, elements) {
      var canvas = event.native && event.native.target
      if (canvas) canvas.style.cursor = elements.length > 0 ? 'pointer' : 'default'
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: function (context) {
          var model = context.tooltip
          if (model.opacity === 0) {
            tooltip.visible = false
            return
          }
          var idx = model.dataPoints && model.dataPoints[0] ? model.dataPoints[0].dataIndex : -1
          var p = props.pillarData[idx]
          if (!p) {
            tooltip.visible = false
            return
          }
          tooltip.title = p.pillarName
          tooltip.signoffs = p.done + ' / ' + p.total
          tooltip.pct = p.pct
          tooltip.failedOpen = p.failedOpen
          tooltip.riskLabel = RISK_LABELS[p.riskLevel] || 'Unknown'
          tooltip.riskColor = RISK_COLORS[p.riskLevel] || ''
          tooltip.x = model.caretX
          tooltip.y = model.caretY
          tooltip.visible = true
        }
      }
    },
    onClick: function (event, elements) {
      if (elements && elements.length > 0) {
        var idx = elements[0].index
        var pillarName = props.pillarData[idx] ? props.pillarData[idx].pillarName : null
        if (pillarName === props.selectedPillar) {
          emit('select-pillar', null)
        } else {
          emit('select-pillar', pillarName)
        }
      }
    }
  }
})
</script>
