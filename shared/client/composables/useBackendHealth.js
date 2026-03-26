import { ref, onUnmounted } from 'vue'

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || '/api'
const CHECK_INTERVAL = 5000
const FAILURE_THRESHOLD = 2
const EXTENDED_OUTAGE_MS = 2 * 60 * 1000

const isBackendDown = ref(false)
const isExtendedOutage = ref(false)

let consecutiveFailures = 0
let _outageStartedAt = null
let pollTimer = null
let extendedTimer = null
let started = false

async function checkHealth() {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${API_ENDPOINT}/healthz`, { signal: controller.signal })
    clearTimeout(timeout)

    if (res.ok) {
      consecutiveFailures = 0
      isBackendDown.value = false
      isExtendedOutage.value = false
      _outageStartedAt = null
      if (extendedTimer) {
        clearTimeout(extendedTimer)
        extendedTimer = null
      }
    } else {
      handleFailure()
    }
  } catch {
    handleFailure()
  }
}

function handleFailure() {
  consecutiveFailures++
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    if (!isBackendDown.value) {
      isBackendDown.value = true
      _outageStartedAt = Date.now()
      extendedTimer = setTimeout(() => {
        if (isBackendDown.value) {
          isExtendedOutage.value = true
        }
      }, EXTENDED_OUTAGE_MS)
    }
  }
}

export function useBackendHealth() {
  if (!started) {
    started = true
    checkHealth()
    pollTimer = setInterval(checkHealth, CHECK_INTERVAL)
  }

  onUnmounted(() => {
    // Don't stop polling — this is global state.
    // Only the last consumer unmounting would be an app teardown.
  })

  return {
    isBackendDown,
    isExtendedOutage
  }
}

// Exported for testing
export { checkHealth, handleFailure, CHECK_INTERVAL, FAILURE_THRESHOLD, EXTENDED_OUTAGE_MS }

export function _resetForTesting() {
  consecutiveFailures = 0
  _outageStartedAt = null
  isBackendDown.value = false
  isExtendedOutage.value = false
  started = false
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  if (extendedTimer) { clearTimeout(extendedTimer); extendedTimer = null }
}
