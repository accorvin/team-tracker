export const KNOWN_PRODUCTS = ['base-images', 'rhel-ai-container-disk-images', 'rhel-ai-disk-images', 'rhel-ai', 'rhaiis', 'rhoai', 'rhelai', 'rhaii']

const PRODUCT_TOKENS = ['rhaiis', 'rhoai', 'rhelai', 'rhaii']

export function extractProduct(releaseNumber) {
  const s = (releaseNumber || '').toLowerCase()
  for (const p of KNOWN_PRODUCTS) {
    if (s === p) return p
    if (s.startsWith(p + '-') && /\d/.test(s[p.length + 1])) return p
  }
  const m = s.match(/^(.+?)-(\d.*)$/)
  if (m) return m[1]
  // New convention: product name as a word within the string
  // e.g. "3.5 GA RHOAI RELEASE" → "rhoai"
  for (const p of PRODUCT_TOKENS) {
    if (new RegExp('\\b' + p + '\\b').test(s)) return p
  }
  return ''
}

export function extractVersion(releaseNumber) {
  const s = releaseNumber || ''
  const product = extractProduct(s)
  if (product) return s.slice(product.length + 1)
  return s
}

export function normalizeVersionKey(version) {
  return (version || '').replace(/[\s.]+/g, '.').toLowerCase()
}
