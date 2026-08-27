<template>
  <div class="p-6">
    <ExecuteWorkspaceView
      :view-mode="viewMode"
      @update:viewMode="setViewMode"
    />
  </div>
</template>

<script setup>
import { ref, watch, nextTick, inject } from 'vue'
import ExecuteWorkspaceView from '../execute/views/ExecuteWorkspaceView.vue'

const nav = inject('moduleNav')

const TAB_TO_VIEW = {
  'feature-tracking': 'table',
  'feature-list': 'signals',
  'feature-status': 'board'
}

const tabs = [
  { id: 'table', label: 'Table' },
  { id: 'board', label: 'Kanban' },
  { id: 'signals', label: 'Signals' }
]

const VALID_VIEWS = tabs.map(t => t.id)
const DEFAULT_VIEW = 'table'

const viewMode = ref(DEFAULT_VIEW)

let updatingFromUrl = false

function resolveView(params) {
  const p = params || {}
  if (p.view && VALID_VIEWS.includes(p.view)) return p.view
  if (p.tab && VALID_VIEWS.includes(p.tab)) return p.tab
  if (p.tab && TAB_TO_VIEW[p.tab]) return TAB_TO_VIEW[p.tab]
  return DEFAULT_VIEW
}

function setViewMode(mode) {
  if (!VALID_VIEWS.includes(mode) || viewMode.value === mode) return
  viewMode.value = mode
}

function writeViewParam(mode) {
  if (updatingFromUrl) return
  var encoded = mode === DEFAULT_VIEW ? undefined : mode
  nav.updateParams({
    view: encoded,
    tab: encoded
  })
}

watch(viewMode, (mode) => {
  writeViewParam(mode)
})

watch(() => nav.params.value, (params) => {
  const next = resolveView(params)
  if (params && params.tab && TAB_TO_VIEW[params.tab]) {
    updatingFromUrl = true
    viewMode.value = next
    nextTick(() => {
      var encoded = next === DEFAULT_VIEW ? undefined : next
      nav.updateParams({
        view: encoded,
        tab: encoded
      })
      updatingFromUrl = false
    })
    return
  }
  if (viewMode.value !== next) {
    updatingFromUrl = true
    viewMode.value = next
    nextTick(() => { updatingFromUrl = false })
  }
}, { immediate: true })
</script>
