/**
 * Map Feature Tracking Settings (gear config) into Execute picker options
 * and workspace load specs. The gear is the only source of versions/products
 * on the Execute workspace — not the release registry.
 */

export var PRODUCT_ORDER = ['rhoai', 'rhelai', 'rhaii']
export var STORAGE_KEY = 'tt_cache:execute-workspace-selection'

function splitList(value) {
  if (!value || typeof value !== 'string') return []
  return value.split(',').map(function (s) {
    return s.trim().toLowerCase()
  }).filter(Boolean)
}

function filledProducts(config, version) {
  var entry = config && config.releases && config.releases[version]
  if (!entry || !entry.products || typeof entry.products !== 'object') return []
  var byFamily = {}
  var keys = Object.keys(entry.products)
  for (var i = 0; i < keys.length; i++) {
    var family = String(keys[i]).toLowerCase()
    var name = (entry.products[keys[i]] || '').trim()
    if (!name) continue
    byFamily[family] = { family: family, jiraName: name }
  }
  var ordered = []
  for (var p = 0; p < PRODUCT_ORDER.length; p++) {
    var known = PRODUCT_ORDER[p]
    if (byFamily[known]) {
      ordered.push(byFamily[known])
      delete byFamily[known]
    }
  }
  var extras = Object.keys(byFamily).sort()
  for (var e = 0; e < extras.length; e++) ordered.push(byFamily[extras[e]])
  return ordered
}

export function listTrackingVersions(config) {
  var releases = (config && config.releases) || {}
  return Object.keys(releases)
    .filter(function (k) { return String(k).trim() })
    .sort(function (a, b) {
      return String(b).localeCompare(String(a), undefined, { numeric: true })
    })
}

export function productsForVersion(config, version) {
  return filledProducts(config, version)
}

function specsForVersion(config, version, productFilter) {
  var products = filledProducts(config, version)
  var filterSet = null
  if (productFilter && productFilter.length > 0) {
    filterSet = {}
    for (var i = 0; i < productFilter.length; i++) {
      filterSet[String(productFilter[i]).toLowerCase()] = true
    }
  }
  var specs = []
  for (var p = 0; p < products.length; p++) {
    if (filterSet && !filterSet[products[p].family]) continue
    specs.push({
      portfolioVersion: version,
      family: products[p].family,
      jiraName: products[p].jiraName
    })
  }
  if (specs.length === 0) {
    specs.push({ portfolioVersion: version, family: null, jiraName: null })
  }
  return specs
}

/**
 * @param {object} config tracking config `{ releases: { [version]: { products } } }`
 * @param {{ version?: string, products?: string[] }} selection
 * @returns {{ portfolioVersion: string, family: string|null, jiraName: string|null }[]}
 */
export function buildReleaseSpecs(config, selection) {
  var sel = selection || {}
  var versions = listTrackingVersions(config)
  var version = sel.version
  if (!version || versions.indexOf(version) < 0) return []
  return specsForVersion(config, version, sel.products)
}

export function parseProductsFromParams(productsParam, familiesParam) {
  var products = splitList(productsParam)
  if (products.length > 0) return products
  var families = splitList(familiesParam)
  var known = {}
  for (var i = 0; i < PRODUCT_ORDER.length; i++) known[PRODUCT_ORDER[i]] = true
  return families.filter(function (f) { return known[f] })
}

/**
 * Drop deleted versions / products and fill defaults from gear config.
 * @param {object} config
 * @param {{ version?: string, products?: string[] }} stored
 */
export function reconcileSelection(config, stored) {
  var versions = listTrackingVersions(config)
  stored = stored || {}
  if (versions.length === 0) {
    return { version: '', products: [] }
  }
  var version = stored.version && versions.indexOf(stored.version) >= 0
    ? stored.version
    : versions[0]
  var available = filledProducts(config, version).map(function (p) { return p.family })
  var requested = Array.isArray(stored.products) ? stored.products : []
  var products = []
  for (var i = 0; i < requested.length; i++) {
    var fam = String(requested[i] || '').toLowerCase()
    if (available.indexOf(fam) >= 0 && products.indexOf(fam) < 0) products.push(fam)
  }
  if (products.length === 0) products = available.slice()
  return {
    version: version,
    products: products
  }
}
