'use strict'

const { registerComponentArchitecturesFetcher, STORAGE_KEY } = require('./fetcher')

/**
 * @param {import('express').Router} router
 * @param {object} context
 */
function registerComponentArchitecturesRoutes(router, context) {
  const { storage, requireAuth, requireScope } = context
  const { readFromStorage } = storage

  registerComponentArchitecturesFetcher(router, context)

  /**
   * @openapi
   * /api/modules/releases/component-architectures:
   *   get:
   *     summary: Get cached component architecture data
   *     tags: [Releases - Component Architectures]
   *     parameters:
   *       - in: query
   *         name: branch
   *         schema: { type: string }
   *         description: Filter to a single release branch
   *     responses:
   *       200:
   *         description: Component architecture matrix data
   *       404:
   *         description: No cached data available
   */
  router.get('/', requireAuth, requireScope('releases:read'), async function (req, res) {
    try {
      const data = await readFromStorage(STORAGE_KEY)
      if (!data) {
        return res.status(404).json({ error: 'No cached data. Trigger a refresh first.' })
      }

      if (req.query.branch && data.branches) {
        const branch = data.branches[req.query.branch]
        if (!branch) {
          return res.status(404).json({ error: `Branch ${req.query.branch} not found` })
        }
        return res.json({ ...data, branches: { [req.query.branch]: branch } })
      }

      res.json(data)
    } catch (err) {
      console.error('[component-architectures] GET error:', err.message)
      res.status(500).json({ error: err.message })
    }
  })
}

module.exports = registerComponentArchitecturesRoutes
