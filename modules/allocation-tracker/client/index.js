import { defineAsyncComponent } from 'vue'

export const routes = {
  'dashboard': defineAsyncComponent(() => import('./views/OrgDashboardView.vue')),
  'project': defineAsyncComponent(() => import('./views/ProjectDetailView.vue')),
  'team': defineAsyncComponent(() => import('./views/TeamDetailView.vue')),
}
