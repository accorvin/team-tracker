import { computed } from 'vue'

/** Per-release component breakdown computation. */
export function useComponentBreakdown(data, releaseData) {
  const releaseComponentBreakdown = computed(() => {
    if (!releaseData.value || !data.value) return []

    const allFeatures = [
      ...releaseData.value.aligned_on_time.map(f => ({ ...f, category: 'aligned_on_time' })),
      ...releaseData.value.aligned_late.map(f => ({ ...f, category: 'aligned_late' })),
      ...releaseData.value.tv_only.map(f => ({ ...f, category: 'tv_only' })),
      ...releaseData.value.fv_only.map(f => ({ ...f, category: 'fv_only' })),
      ...releaseData.value.misaligned.map(f => ({ ...f, category: 'misaligned' })),
    ]

    const compMap = {}
    for (const feat of allFeatures) {
      const comps = Array.isArray(feat.components)
        ? feat.components
        : (feat.component ? feat.component.split(', ').map(c => c.trim()).filter(Boolean) : [])
      for (const comp of comps) {
        if (!compMap[comp]) {
          compMap[comp] = {
            component: comp, total: 0, aligned_on_time: 0, aligned_late: 0,
            tv_only: 0, fv_only: 0, misaligned: 0, keys: new Set(),
          }
        }
        if (!compMap[comp].keys.has(feat.key)) {
          compMap[comp].keys.add(feat.key)
          compMap[comp].total++
          compMap[comp][feat.category]++
        }
      }
    }

    const allComponentNames = data.value.metadata?.all_components || []

    let compList
    if (allComponentNames.length > 0) {
      compList = allComponentNames.map(compName => {
        const c = compMap[compName]
        if (!c) {
          return { component: compName, total: 0, aligned_on_time: 0, aligned_late: 0, tv_only: 0, fv_only: 0, misaligned: 0, alignment_pct: 0 }
        }
        return {
          component: compName, total: c.total, aligned_on_time: c.aligned_on_time, aligned_late: c.aligned_late,
          tv_only: c.tv_only, fv_only: c.fv_only, misaligned: c.misaligned,
          alignment_pct: c.total ? Math.round(1000 * (c.aligned_on_time + c.aligned_late) / c.total) / 10 : 0,
        }
      })
    } else {
      compList = Object.values(compMap).map(c => ({
        component: c.component, total: c.total, aligned_on_time: c.aligned_on_time, aligned_late: c.aligned_late, tv_only: c.tv_only, fv_only: c.fv_only, misaligned: c.misaligned,
        alignment_pct: c.total ? Math.round(1000 * (c.aligned_on_time + c.aligned_late) / c.total) / 10 : 0,
      }))
    }

    return compList.sort((a, b) => b.total - a.total || a.component.localeCompare(b.component))
  })

  return { releaseComponentBreakdown }
}
