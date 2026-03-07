import { ref, watch } from 'vue'

const STORAGE_KEY = 'teamTrackerViewPreference'

const viewPreference = ref(localStorage.getItem(STORAGE_KEY) || 'table')

watch(viewPreference, (val) => {
  localStorage.setItem(STORAGE_KEY, val)
})

export function useViewPreference() {
  return { viewPreference }
}
