#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const MODULES_DIR = path.join(__dirname, '..', 'modules')
const REQUIRED_FIELDS = ['name', 'slug', 'description', 'icon']

let errors = 0

function error(msg) {
  console.error(`  ERROR: ${msg}`)
  errors++
}

function warn(msg) {
  console.warn(`  WARN: ${msg}`)
}

function validate() {
  if (!fs.existsSync(MODULES_DIR)) {
    console.log('No modules/ directory found — nothing to validate.')
    return
  }

  const dirs = fs.readdirSync(MODULES_DIR).filter(d => {
    if (d.startsWith('.') || d.startsWith('_')) return false
    return fs.statSync(path.join(MODULES_DIR, d)).isDirectory()
  })

  if (dirs.length === 0) {
    console.log('No module directories found — nothing to validate.')
    return
  }

  const slugs = new Set()

  for (const dir of dirs) {
    console.log(`\nValidating module: ${dir}`)
    const manifestPath = path.join(MODULES_DIR, dir, 'module.json')

    if (!fs.existsSync(manifestPath)) {
      error(`Missing module.json in modules/${dir}/`)
      continue
    }

    let manifest
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    } catch (e) {
      error(`Invalid JSON in module.json: ${e.message}`)
      continue
    }

    // Required fields
    for (const field of REQUIRED_FIELDS) {
      if (!manifest[field]) {
        error(`Missing required field "${field}" in module.json`)
      }
    }

    // Slug must match directory name
    if (manifest.slug && manifest.slug !== dir) {
      error(`Slug "${manifest.slug}" does not match directory name "${dir}"`)
    }

    // Unique slugs
    if (manifest.slug) {
      if (slugs.has(manifest.slug)) {
        error(`Duplicate slug "${manifest.slug}"`)
      }
      slugs.add(manifest.slug)
    }

    // Client entry exists
    if (manifest.client?.entry) {
      const entryPath = path.join(MODULES_DIR, dir, manifest.client.entry)
      if (!fs.existsSync(entryPath)) {
        error(`Client entry "${manifest.client.entry}" not found`)
      }
    }

    // Server entry exists
    if (manifest.server?.entry) {
      const entryPath = path.join(MODULES_DIR, dir, manifest.server.entry)
      if (!fs.existsSync(entryPath)) {
        error(`Server entry "${manifest.server.entry}" not found`)
      }
    }

    // Settings component exists
    if (manifest.client?.settingsComponent) {
      const settingsPath = path.join(MODULES_DIR, dir, manifest.client.settingsComponent)
      if (!fs.existsSync(settingsPath)) {
        error(`Settings component "${manifest.client.settingsComponent}" not found`)
      }
    }

    // NavItem IDs unique within module
    if (manifest.client?.navItems) {
      const navIds = new Set()
      for (const item of manifest.client.navItems) {
        if (!item.id) {
          error('NavItem missing "id" field')
        } else if (navIds.has(item.id)) {
          error(`Duplicate navItem id "${item.id}"`)
        } else {
          navIds.add(item.id)
        }
        if (!item.label) warn(`NavItem "${item.id}" missing "label"`)
        if (!item.icon) warn(`NavItem "${item.id}" missing "icon"`)
      }
    }
  }

  console.log('')
  if (errors > 0) {
    console.error(`Validation failed with ${errors} error(s).`)
    process.exit(1)
  } else {
    console.log('All modules validated successfully.')
  }
}

validate()
