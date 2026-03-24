import { defineAsyncComponent } from 'vue'

const manifestModules = import.meta.glob('/modules/*/module.json', { eager: true })
const clientEntries = import.meta.glob('/modules/*/client/index.js')

export function loadModuleManifests() {
  const modules = []
  for (const [path, manifest] of Object.entries(manifestModules)) {
    const slug = path.split('/')[2]
    modules.push({ ...manifest.default || manifest, slug })
  }
  return modules.sort((a, b) => (a.order || 100) - (b.order || 100))
}

export async function loadModuleClient(slug) {
  if (slug.includes('..') || slug.includes('/')) return null
  const loader = clientEntries[`/modules/${slug}/client/index.js`]
  if (!loader) return null
  return loader()
}

export function loadModuleSettingsComponent(slug, settingsPath) {
  // Prevent path traversal in settings component path
  if (settingsPath.includes('..')) {
    throw new Error(`Invalid settings path for module "${slug}": path traversal not allowed`)
  }
  return defineAsyncComponent(() =>
    import(`/modules/${slug}/${settingsPath}`)
  )
}
