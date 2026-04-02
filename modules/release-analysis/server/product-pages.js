/**
 * Product Pages OAuth token manager and API client.
 *
 * Auth modes (auto-detected):
 * 1. OAuth client credentials: PRODUCT_PAGES_CLIENT_ID + PRODUCT_PAGES_CLIENT_SECRET
 * 2. Personal token fallback: PRODUCT_PAGES_TOKEN
 * 3. No auth: returns null, callers skip API calls
 */

let cachedToken = { token: null, expiresAt: 0 }
let pendingTokenRequest = null

let productsCache = { products: null, expiresAt: 0 }

/**
 * Returns a Bearer token string, or null if no auth is configured.
 * Caches OAuth tokens in memory and deduplicates concurrent requests.
 */
async function getProductPagesToken(config) {
  const clientId = process.env.PRODUCT_PAGES_CLIENT_ID || ''
  const clientSecret = process.env.PRODUCT_PAGES_CLIENT_SECRET || ''
  const personalToken = process.env.PRODUCT_PAGES_TOKEN || ''

  // OAuth client credentials flow
  if (clientId && clientSecret) {
    if (cachedToken.token && cachedToken.expiresAt > Date.now()) {
      return cachedToken.token
    }
    if (pendingTokenRequest) {
      return pendingTokenRequest
    }

    pendingTokenRequest = (async () => {
      const tokenUrl = config?.productPagesTokenUrl ||
        'https://auth.redhat.com/auth/realms/EmployeeIDP/protocol/openid-connect/token'
      try {
        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret
          }),
          signal: AbortSignal.timeout(15000)
        })

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          if (response.status === 401) {
            console.error(`[product-pages] SSO credential failure (HTTP 401): invalid_client. Verify PRODUCT_PAGES_CLIENT_ID. Body: ${body}`)
          } else {
            console.error(`[product-pages] SSO token endpoint error (HTTP ${response.status}): ${body}`)
          }
          throw new Error(`SSO token request failed (${response.status})`)
        }

        const data = await response.json()
        const expiresIn = data.expires_in || 300
        cachedToken = {
          token: data.access_token,
          expiresAt: Date.now() + (expiresIn - 30) * 1000
        }
        return cachedToken.token
      } finally {
        pendingTokenRequest = null
      }
    })()

    return pendingTokenRequest
  }

  // Personal token fallback
  if (personalToken) {
    return personalToken
  }

  // No auth configured
  return null
}

/**
 * Extracts the GA date from a Product Pages release object.
 * Priority: ga_date field > all_ga_tasks with main:true > all_ga_tasks matching /\bGA\b/ > null
 */
function extractGaDate(release) {
  if (release.ga_date) return release.ga_date

  const tasks = release.all_ga_tasks
  if (!Array.isArray(tasks) || tasks.length === 0) return null

  // Priority 1: entry with main: true
  const mainTask = tasks.find(t => t.main === true)
  if (mainTask?.date_finish) return mainTask.date_finish

  // Priority 2: entry whose name matches /\bGA\b/
  const gaPattern = /\bGA\b/
  let lastGaTask = null
  for (const t of tasks) {
    if (gaPattern.test(t.name || '')) {
      lastGaTask = t
    }
  }
  if (lastGaTask?.date_finish) return lastGaTask.date_finish

  // Priority 3: last task's date_finish (covers releases that label GA as "Release")
  const lastTask = tasks[tasks.length - 1]
  if (lastTask?.date_finish) return lastTask.date_finish

  return null
}

/**
 * Returns the auth status string for the settings UI badge.
 */
function getAuthStatus() {
  const clientId = process.env.PRODUCT_PAGES_CLIENT_ID || ''
  const clientSecret = process.env.PRODUCT_PAGES_CLIENT_SECRET || ''
  const personalToken = process.env.PRODUCT_PAGES_TOKEN || ''

  if (clientId && clientSecret) return 'oauth'
  if (personalToken) return 'token'
  return 'none'
}

// Exclude phases where the release is already shipped or end-of-life
const EXCLUDED_PHASES = new Set([600, 1000]) // Maintenance, Unsupported

/**
 * Fetches releases for given product shortnames from Product Pages API.
 * Makes one request per shortname with server-side filtering.
 * Returns normalized release objects: { productName, releaseNumber, dueDate }
 */
async function fetchProductsByShortname(shortnames, config) {
  let token = await getProductPagesToken(config)
  if (!token) {
    console.warn('[product-pages] No auth configured, skipping Product Pages API calls')
    return []
  }

  const baseUrl = (config.productPagesBaseUrl || 'https://productpages.redhat.com').replace(/\/+$/, '')
  const releases = []

  for (let i = 0; i < shortnames.length; i++) {
    const shortname = shortnames[i]
    try {
      const url = `${baseUrl}/api/v7/releases/?product__shortname=${encodeURIComponent(shortname)}`
      let response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        },
        signal: AbortSignal.timeout(30000)
      })

      // Retry once on 401 — token may have expired mid-loop
      if (response.status === 401) {
        cachedToken = { token: null, expiresAt: 0 }
        token = await getProductPagesToken(config)
        if (!token) break
        response = await fetch(url, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          },
          signal: AbortSignal.timeout(30000)
        })
      }

      if (!response.ok) {
        console.error(`[product-pages] API error for product "${shortname}" (HTTP ${response.status})`)
        continue
      }

      const payload = await response.json()
      const rows = Array.isArray(payload) ? payload : (payload.releases || payload.items || [])

      for (const r of rows) {
        if (r.canceled) continue
        if (EXCLUDED_PHASES.has(r.phase)) continue

        const gaDate = extractGaDate(r)
        if (!gaDate) continue

        releases.push({
          productName: r.product_name || r.product_shortname || shortname,
          releaseNumber: r.shortname || r.name || '',
          dueDate: gaDate
        })
      }
    } catch (err) {
      console.error(`[product-pages] Failed to fetch releases for "${shortname}":`, err.message)
    }

    // Small delay between requests to avoid rate limiting
    if (i < shortnames.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  return releases
}

/**
 * Fetches the full product list from Product Pages for settings UI autocomplete.
 * Cached in memory for 1 hour.
 */
async function fetchAllProducts(config) {
  if (productsCache.products && productsCache.expiresAt > Date.now()) {
    return productsCache.products
  }

  const token = await getProductPagesToken(config)
  if (!token) {
    return []
  }

  const baseUrl = (config.productPagesBaseUrl || 'https://productpages.redhat.com').replace(/\/+$/, '')
  try {
    const response = await fetch(`${baseUrl}/api/v7/products/`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      },
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      console.error(`[product-pages] Products API error (HTTP ${response.status})`)
      return []
    }

    const payload = await response.json()
    const rows = Array.isArray(payload) ? payload : (payload.products || payload.items || [])
    const products = rows
      .map(p => ({ shortname: p.shortname || '', name: p.name || '' }))
      .filter(p => p.shortname)
      .sort((a, b) => a.shortname.localeCompare(b.shortname))

    productsCache = {
      products,
      expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour
    }

    return products
  } catch (err) {
    console.error('[product-pages] Failed to fetch products:', err.message)
    return []
  }
}

function _resetForTesting() {
  cachedToken = { token: null, expiresAt: 0 }
  pendingTokenRequest = null
  productsCache = { products: null, expiresAt: 0 }
}

module.exports = {
  getProductPagesToken,
  fetchProductsByShortname,
  fetchAllProducts,
  getAuthStatus,
  extractGaDate,
  _resetForTesting
}
