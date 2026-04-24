import { defineAsyncComponent } from 'vue'

const AIImpactView = defineAsyncComponent(() => import('./views/AIImpactView.vue'))

export const routes = {
  'main': AIImpactView,
  'rfe-review': AIImpactView,
  'feature-review': AIImpactView,
  'autofix': AIImpactView,
  'pull-requests': AIImpactView,
}
