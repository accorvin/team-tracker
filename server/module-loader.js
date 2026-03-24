const fs = require('fs')
const path = require('path')
const express = require('express')

const MODULES_DIR = path.join(__dirname, '..', 'modules')

function discoverModules(modulesDir = MODULES_DIR) {
  const modules = []
  if (!fs.existsSync(modulesDir)) return modules
  for (const dir of fs.readdirSync(modulesDir)) {
    if (dir.startsWith('.') || dir.startsWith('_')) continue
    const manifestPath = path.join(modulesDir, dir, 'module.json')
    if (!fs.existsSync(manifestPath)) continue
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      modules.push({ ...manifest, slug: dir, _dir: path.join(modulesDir, dir) })
    } catch (err) {
      console.error(`[module-loader] Failed to load manifest for "${dir}":`, err.message)
    }
  }
  return modules
}

function createModuleRouters(modules, context) {
  const routers = {}
  for (const mod of modules) {
    if (!mod.server?.entry) continue
    // Validate entry path does not escape module directory
    const entryPath = path.join(mod._dir, mod.server.entry)
    if (!entryPath.startsWith(mod._dir + path.sep) && entryPath !== mod._dir) {
      console.error(`[module-loader] Refusing to load "${mod.slug}": server entry escapes module directory`)
      continue
    }
    const router = express.Router()
    try {
      require(entryPath)(router, context)
      routers[mod.slug] = router
      console.log(`[module-loader] Created router for "${mod.slug}"`)
    } catch (err) {
      console.error(`[module-loader] Failed to create router for "${mod.slug}":`, err.message)
    }
  }
  return routers
}

function mountModuleRouters(app, modules, routers) {
  for (const mod of modules) {
    if (!routers[mod.slug]) continue
    app.use(`/api/modules/${mod.slug}`, routers[mod.slug])
    console.log(`[module-loader] Mounted routes for "${mod.slug}" at /api/modules/${mod.slug}`)
  }
}

module.exports = {
  discoverModules,
  createModuleRouters,
  mountModuleRouters,
  MODULES_DIR
}
