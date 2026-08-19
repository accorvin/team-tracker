var PRODUCT_COLORS = {
  rhoai: { bg: 'bg-violet-50 dark:bg-violet-900/15', border: 'border-l-violet-500', badge: 'bg-violet-100 dark:bg-violet-800/40 text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  rhelai: { bg: 'bg-teal-50 dark:bg-teal-900/15', border: 'border-l-teal-500', badge: 'bg-teal-100 dark:bg-teal-800/40 text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
  rhaii: { bg: 'bg-sky-50 dark:bg-sky-900/15', border: 'border-l-sky-500', badge: 'bg-sky-100 dark:bg-sky-800/40 text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' }
}

var DEFAULT_COLORS = { bg: 'bg-gray-50 dark:bg-gray-800/50', border: 'border-l-gray-400', badge: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300', dot: 'bg-gray-400' }

var PRODUCT_HEX = {
  rhoai: '#8b5cf6',
  rhelai: '#14b8a6',
  rhaii: '#0ea5e9'
}
var DEFAULT_HEX = '#9ca3af'

function productColors(product) {
  return PRODUCT_COLORS[product] || DEFAULT_COLORS
}

export { PRODUCT_COLORS, DEFAULT_COLORS, PRODUCT_HEX, DEFAULT_HEX, productColors }
