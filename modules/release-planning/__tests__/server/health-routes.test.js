import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../server/config', () => ({
  getConfig: vi.fn().mockReturnValue({
    healthConfig: {},
    customFieldIds: {}
  })
}))

vi.mock('../../server/health/health-pipeline', () => ({
  runHealthPipeline: vi.fn().mockResolvedValue({
    version: '3.5',
    cachedAt: new Date().toISOString(),
    features: [],
    summary: { totalFeatures: 0, byRisk: { green: 0, yellow: 0, red: 0 }, dorCompletionRate: 0, averageRiceScore: null },
    milestones: null,
    enrichmentStatus: { jiraQueriesRun: 0, featuresEnriched: 0, warnings: [] }
  })
}))

vi.mock('../../../../shared/server/jira', () => ({
  jiraRequest: vi.fn(),
  fetchAllJqlResults: vi.fn()
}))

const healthRoutes = require('../../server/health/health-routes')

function makeStorage(data) {
  var store = {}
  if (data) {
    for (var k in data) store[k] = data[k]
  }
  return {
    readFromStorage: function(key) {
      return store[key] ? JSON.parse(JSON.stringify(store[key])) : null
    },
    writeToStorage: function(key, value) {
      store[key] = value
    },
    _store: store
  }
}

function makeRouter() {
  var routes = {}
  function reg(method) {
    return function(path) {
      var handlers = Array.prototype.slice.call(arguments, 1)
      routes[method + ' ' + path] = handlers
    }
  }
  return {
    get: vi.fn(reg('GET')),
    post: vi.fn(reg('POST')),
    put: vi.fn(reg('PUT')),
    delete: vi.fn(reg('DELETE')),
    use: vi.fn(),
    _routes: routes
  }
}

function makeRes() {
  var res = {
    _status: 200,
    _json: null,
    _headers: {},
    status: function(code) { res._status = code; return res },
    json: function(data) { res._json = data; return res },
    set: function(key, value) { res._headers[key] = value; return res },
    end: function() { return res },
    send: function(body) {
      if (typeof body === 'string') {
        try { res._json = JSON.parse(body) } catch { res._json = body }
      } else {
        res._json = body
      }
      return res
    }
  }
  return res
}

function makeReq(overrides) {
  return Object.assign({
    isAdmin: true,
    userEmail: 'admin@test.com',
    body: {},
    params: {},
    query: {},
    headers: {}
  }, overrides)
}

function callRoute(routes, method, path, req) {
  var key = method + ' ' + path
  var handlers = routes[key]
  if (!handlers) throw new Error('No route registered: ' + key)
  var handler = handlers[handlers.length - 1]
  var res = makeRes()
  var result = handler(req || makeReq(), res)
  if (result && typeof result.then === 'function') {
    return result.then(function() { return res })
  }
  return res
}

function freshCache(version, overrides) {
  return Object.assign({
    version: version,
    cachedAt: new Date().toISOString(),
    milestones: null,
    summary: { totalFeatures: 2, byRisk: { green: 1, yellow: 1, red: 0 }, dorCompletionRate: 50, averageRiceScore: null },
    features: [
      { key: 'T-1', summary: 'Feature 1', risk: { level: 'green', flags: [] }, dor: { checkedCount: 10, totalCount: 13, completionPct: 77, items: [] } },
      { key: 'T-2', summary: 'Feature 2', risk: { level: 'yellow', flags: [{ category: 'UNESTIMATED' }] }, dor: { checkedCount: 5, totalCount: 13, completionPct: 38, items: [] } }
    ],
    enrichmentStatus: { jiraQueriesRun: 1, featuresEnriched: 2, warnings: [] }
  }, overrides)
}

describe('health routes', function() {
  var router, storage, context, refreshStates

  beforeEach(function() {
    vi.clearAllMocks()
    refreshStates = new Map()
    storage = makeStorage({})
    router = makeRouter()
    context = {
      storage: storage,
      requireAuth: function(req, res, next) { next() },
      requirePM: function(req, res, next) { next() },
      refreshStates: refreshStates,
      MAX_CONCURRENT_REFRESHES: 2,
      sendJsonWithETag: function(req, res, data, statusCode) {
        if (statusCode) res.status(statusCode)
        res.json(data)
      }
    }
    healthRoutes(router, context)
  })

  // ─── Route Registration ───

  describe('route registration', function() {
    it('registers all expected health routes', function() {
      var expected = [
        'GET /releases/:version/health',
        'GET /releases/:version/health/summary',
        'GET /releases/:version/health/feature/:key',
        'PUT /releases/:version/health/dor/:featureKey',
        'PUT /releases/:version/health/override/:featureKey',
        'DELETE /releases/:version/health/override/:featureKey',
        'POST /releases/:version/health/refresh',
        'GET /releases/:version/health/refresh/status'
      ]
      for (var i = 0; i < expected.length; i++) {
        expect(router._routes[expected[i]]).toBeDefined()
      }
    })
  })

  // ─── GET /releases/:version/health ───

  describe('GET /releases/:version/health', function() {
    it('returns 400 for invalid version', function() {
      var res = callRoute(router._routes, 'GET', '/releases/:version/health',
        makeReq({ params: { version: '../evil' } }))
      expect(res._status).toBe(400)
      expect(res._json.error).toContain('Invalid version')
    })

    it('returns 400 for __proto__ version', function() {
      var res = callRoute(router._routes, 'GET', '/releases/:version/health',
        makeReq({ params: { version: '__proto__' } }))
      expect(res._status).toBe(400)
    })

    it('returns 202 with _noCache when no cache exists', function() {
      var res = callRoute(router._routes, 'GET', '/releases/:version/health',
        makeReq({ params: { version: '3.5' } }))
      expect(res._status).toBe(202)
      expect(res._json._noCache).toBe(true)
      expect(res._json.features).toEqual([])
    })

    it('returns cached data when available', function() {
      var cached = freshCache('3.5')
      storage._store['release-planning/health-cache-3.5-all.json'] = cached
      var res = callRoute(router._routes, 'GET', '/releases/:version/health',
        makeReq({ params: { version: '3.5' } }))
      expect(res._status).toBe(200)
      expect(res._json.version).toBe('3.5')
      expect(res._json.features).toHaveLength(2)
    })

    it('sets _cacheStale true for old cache', function() {
      var cached = freshCache('3.5', { cachedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString() })
      storage._store['release-planning/health-cache-3.5-all.json'] = cached
      var res = callRoute(router._routes, 'GET', '/releases/:version/health',
        makeReq({ params: { version: '3.5' } }))
      expect(res._json._cacheStale).toBe(true)
    })

    it('sets _cacheStale false for fresh cache', function() {
      var cached = freshCache('3.5')
      storage._store['release-planning/health-cache-3.5-all.json'] = cached
      var res = callRoute(router._routes, 'GET', '/releases/:version/health',
        makeReq({ params: { version: '3.5' } }))
      expect(res._json._cacheStale).toBe(false)
    })
  })

  // ─── Phase validation ───

  describe('phase query param validation', function() {
    it('returns 400 for invalid phase on GET health', function() {
      var res = callRoute(router._routes, 'GET', '/releases/:version/health',
        makeReq({ params: { version: '3.5' }, query: { phase: 'INVALID' } }))
      expect(res._status).toBe(400)
      expect(res._json.error).toContain('phase')
    })

    it('accepts valid EA1 phase on GET health', function() {
      storage._store['release-planning/health-cache-3.5-EA1.json'] = freshCache('3.5')
      var res = callRoute(router._routes, 'GET', '/releases/:version/health',
        makeReq({ params: { version: '3.5' }, query: { phase: 'EA1' } }))
      expect(res._status).toBe(200)
    })

    it('accepts valid EA2 phase on GET health', function() {
      storage._store['release-planning/health-cache-3.5-EA2.json'] = freshCache('3.5')
      var res = callRoute(router._routes, 'GET', '/releases/:version/health',
        makeReq({ params: { version: '3.5' }, query: { phase: 'EA2' } }))
      expect(res._status).toBe(200)
    })

    it('accepts valid GA phase on GET health', function() {
      storage._store['release-planning/health-cache-3.5-GA.json'] = freshCache('3.5')
      var res = callRoute(router._routes, 'GET', '/releases/:version/health',
        makeReq({ params: { version: '3.5' }, query: { phase: 'GA' } }))
      expect(res._status).toBe(200)
    })

    it('uses phase-specific cache key', function() {
      storage._store['release-planning/health-cache-3.5-EA2.json'] = freshCache('3.5')
      var res = callRoute(router._routes, 'GET', '/releases/:version/health',
        makeReq({ params: { version: '3.5' }, query: { phase: 'EA2' } }))
      expect(res._status).toBe(200)
      expect(res._json.features).toHaveLength(2)
    })

    it('returns 202 when phase-specific cache does not exist', function() {
      storage._store['release-planning/health-cache-3.5-all.json'] = freshCache('3.5')
      var res = callRoute(router._routes, 'GET', '/releases/:version/health',
        makeReq({ params: { version: '3.5' }, query: { phase: 'EA1' } }))
      expect(res._status).toBe(202)
      expect(res._json._noCache).toBe(true)
    })

    it('returns 400 for invalid phase on GET summary', function() {
      var res = callRoute(router._routes, 'GET', '/releases/:version/health/summary',
        makeReq({ params: { version: '3.5' }, query: { phase: 'WRONG' } }))
      expect(res._status).toBe(400)
    })

    it('returns 400 for invalid phase on POST refresh', function() {
      var res = callRoute(router._routes, 'POST', '/releases/:version/health/refresh',
        makeReq({ params: { version: '3.5' }, query: { phase: 'BAD' } }))
      expect(res._status).toBe(400)
    })

    it('returns 400 for invalid phase on GET refresh status', function() {
      var res = callRoute(router._routes, 'GET', '/releases/:version/health/refresh/status',
        makeReq({ params: { version: '3.5' }, query: { phase: 'XYZ' } }))
      expect(res._status).toBe(400)
    })

    it('uses phase-specific refresh state key', function() {
      refreshStates.set('health:3.5:EA1', { running: true, startedAt: '2026-04-26T12:00:00Z', lastResult: null })
      var res = callRoute(router._routes, 'GET', '/releases/:version/health/refresh/status',
        makeReq({ params: { version: '3.5' }, query: { phase: 'EA1' } }))
      expect(res._json.running).toBe(true)
    })
  })

  // ─── GET /releases/:version/health/summary ───

  describe('GET /releases/:version/health/summary', function() {
    it('returns 400 for invalid version', function() {
      var res = callRoute(router._routes, 'GET', '/releases/:version/health/summary',
        makeReq({ params: { version: '!bad!' } }))
      expect(res._status).toBe(400)
    })

    it('returns 404 when no cache exists', function() {
      var res = callRoute(router._routes, 'GET', '/releases/:version/health/summary',
        makeReq({ params: { version: '3.5' } }))
      expect(res._status).toBe(404)
    })

    it('returns summary from cached data', function() {
      storage._store['release-planning/health-cache-3.5-all.json'] = freshCache('3.5')
      var res = callRoute(router._routes, 'GET', '/releases/:version/health/summary',
        makeReq({ params: { version: '3.5' } }))
      expect(res._status).toBe(200)
      expect(res._json.version).toBe('3.5')
      expect(res._json.summary).toBeDefined()
      expect(res._json.summary.totalFeatures).toBe(2)
      expect(res._json.milestones).toBeNull()
    })
  })

  // ─── GET /releases/:version/health/feature/:key ───

  describe('GET /releases/:version/health/feature/:key', function() {
    it('returns 400 for invalid version', function() {
      var res = callRoute(router._routes, 'GET', '/releases/:version/health/feature/:key',
        makeReq({ params: { version: '!bad', key: 'T-1' } }))
      expect(res._status).toBe(400)
    })

    it('returns 400 for invalid feature key', function() {
      var res = callRoute(router._routes, 'GET', '/releases/:version/health/feature/:key',
        makeReq({ params: { version: '3.5', key: 'not-valid' } }))
      expect(res._status).toBe(400)
      expect(res._json.error).toContain('Invalid feature key')
    })

    it('returns 404 when no cache exists', function() {
      var res = callRoute(router._routes, 'GET', '/releases/:version/health/feature/:key',
        makeReq({ params: { version: '3.5', key: 'T-1' } }))
      expect(res._status).toBe(404)
    })

    it('returns 404 when feature not found in cache', function() {
      storage._store['release-planning/health-cache-3.5-all.json'] = freshCache('3.5')
      var res = callRoute(router._routes, 'GET', '/releases/:version/health/feature/:key',
        makeReq({ params: { version: '3.5', key: 'T-999' } }))
      expect(res._status).toBe(404)
      expect(res._json.error).toContain('T-999')
    })

    it('returns feature data when found', function() {
      storage._store['release-planning/health-cache-3.5-all.json'] = freshCache('3.5')
      var res = callRoute(router._routes, 'GET', '/releases/:version/health/feature/:key',
        makeReq({ params: { version: '3.5', key: 'T-1' } }))
      expect(res._status).toBe(200)
      expect(res._json.key).toBe('T-1')
      expect(res._json.summary).toBe('Feature 1')
    })
  })

  // ─── PUT /releases/:version/health/dor/:featureKey ───

  describe('PUT /releases/:version/health/dor/:featureKey', function() {
    it('returns 400 for invalid version', function() {
      var res = callRoute(router._routes, 'PUT', '/releases/:version/health/dor/:featureKey',
        makeReq({ params: { version: '!bad', featureKey: 'T-1' }, body: { items: {} } }))
      expect(res._status).toBe(400)
    })

    it('returns 400 for invalid feature key', function() {
      var res = callRoute(router._routes, 'PUT', '/releases/:version/health/dor/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'bad' }, body: { items: {} } }))
      expect(res._status).toBe(400)
    })

    it('returns 400 when items is missing', function() {
      var res = callRoute(router._routes, 'PUT', '/releases/:version/health/dor/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' }, body: {} }))
      expect(res._status).toBe(400)
      expect(res._json.error).toContain('items must be an object')
    })

    it('returns 400 when items is an array', function() {
      var res = callRoute(router._routes, 'PUT', '/releases/:version/health/dor/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' }, body: { items: [] } }))
      expect(res._status).toBe(400)
    })

    it('returns 400 for unknown DoR item ID', function() {
      var res = callRoute(router._routes, 'PUT', '/releases/:version/health/dor/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' }, body: { items: { 'F-999': true } } }))
      expect(res._status).toBe(400)
      expect(res._json.error).toContain('Unknown DoR item ID')
    })

    it('returns 400 for automated DoR item', function() {
      var res = callRoute(router._routes, 'PUT', '/releases/:version/health/dor/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' }, body: { items: { 'F-1': true } } }))
      expect(res._status).toBe(400)
      expect(res._json.error).toContain('automated')
    })

    it('returns 400 for non-boolean item value', function() {
      var res = callRoute(router._routes, 'PUT', '/releases/:version/health/dor/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' }, body: { items: { 'F-3': 'yes' } } }))
      expect(res._status).toBe(400)
      expect(res._json.error).toContain('booleans')
    })

    it('returns 400 for notes exceeding max length', function() {
      var longNotes = 'x'.repeat(2001)
      var res = callRoute(router._routes, 'PUT', '/releases/:version/health/dor/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' }, body: { items: { 'F-3': true }, notes: longNotes } }))
      expect(res._status).toBe(400)
      expect(res._json.error).toContain('2000')
    })

    it('writes DoR state and returns completion info on success', function() {
      var res = callRoute(router._routes, 'PUT', '/releases/:version/health/dor/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' }, body: { items: { 'F-3': true, 'F-9': false }, notes: 'Test note' } }))
      expect(res._status).toBe(200)
      expect(res._json.featureKey).toBe('T-1')
      expect(res._json.dor).toBeDefined()
      expect(res._json.dor.totalCount).toBe(13)
      expect(res._json.updatedBy).toBe('admin@test.com')

      var dorState = storage._store['release-planning/dor-state-3.5.json']
      expect(dorState).toBeDefined()
      expect(dorState.features['T-1'].manualChecks['F-3'].checked).toBe(true)
      expect(dorState.features['T-1'].manualChecks['F-9'].checked).toBe(false)
      expect(dorState.features['T-1'].notes).toBe('Test note')
    })

    it('writes audit log entry', function() {
      callRoute(router._routes, 'PUT', '/releases/:version/health/dor/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' }, body: { items: { 'F-3': true } } }))
      var auditLog = storage._store['release-planning/audit-log.json']
      expect(auditLog).toBeDefined()
      expect(auditLog.entries).toBeDefined()
      var entry = auditLog.entries[auditLog.entries.length - 1]
      expect(entry.action).toBe('update_dor')
      expect(entry.summary).toContain('T-1')
    })
  })

  // ─── PUT /releases/:version/health/override/:featureKey ───

  describe('PUT /releases/:version/health/override/:featureKey', function() {
    it('returns 400 for invalid risk level', function() {
      var res = callRoute(router._routes, 'PUT', '/releases/:version/health/override/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' }, body: { riskOverride: 'purple', reason: 'test' } }))
      expect(res._status).toBe(400)
      expect(res._json.error).toContain('riskOverride')
    })

    it('returns 400 when reason is missing', function() {
      var res = callRoute(router._routes, 'PUT', '/releases/:version/health/override/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' }, body: { riskOverride: 'green' } }))
      expect(res._status).toBe(400)
      expect(res._json.error).toContain('reason')
    })

    it('returns 400 when reason is empty string', function() {
      var res = callRoute(router._routes, 'PUT', '/releases/:version/health/override/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' }, body: { riskOverride: 'green', reason: '   ' } }))
      expect(res._status).toBe(400)
    })

    it('returns 400 when reason exceeds max length', function() {
      var res = callRoute(router._routes, 'PUT', '/releases/:version/health/override/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' }, body: { riskOverride: 'green', reason: 'x'.repeat(501) } }))
      expect(res._status).toBe(400)
      expect(res._json.error).toContain('500')
    })

    it('writes override and returns confirmation on success', function() {
      var res = callRoute(router._routes, 'PUT', '/releases/:version/health/override/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' }, body: { riskOverride: 'green', reason: 'PM verified' } }))
      expect(res._status).toBe(200)
      expect(res._json.featureKey).toBe('T-1')
      expect(res._json.riskOverride).toBe('green')
      expect(res._json.reason).toBe('PM verified')

      var overrides = storage._store['release-planning/health-overrides-3.5.json']
      expect(overrides.overrides['T-1'].riskOverride).toBe('green')
      expect(overrides.overrides['T-1'].reason).toBe('PM verified')
    })

    it('writes audit log entry', function() {
      callRoute(router._routes, 'PUT', '/releases/:version/health/override/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' }, body: { riskOverride: 'yellow', reason: 'Under review' } }))
      var auditLog = storage._store['release-planning/audit-log.json']
      expect(auditLog).toBeDefined()
      var entry = auditLog.entries[auditLog.entries.length - 1]
      expect(entry.action).toBe('set_risk_override')
      expect(entry.summary).toContain('yellow')
    })
  })

  // ─── DELETE /releases/:version/health/override/:featureKey ───

  describe('DELETE /releases/:version/health/override/:featureKey', function() {
    it('returns 400 for invalid version', function() {
      var res = callRoute(router._routes, 'DELETE', '/releases/:version/health/override/:featureKey',
        makeReq({ params: { version: '!bad', featureKey: 'T-1' } }))
      expect(res._status).toBe(400)
    })

    it('returns 404 when no override exists', function() {
      var res = callRoute(router._routes, 'DELETE', '/releases/:version/health/override/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' } }))
      expect(res._status).toBe(404)
    })

    it('removes override and returns confirmation', function() {
      storage._store['release-planning/health-overrides-3.5.json'] = {
        version: '3.5',
        overrides: { 'T-1': { riskOverride: 'green', reason: 'old reason' } }
      }
      var res = callRoute(router._routes, 'DELETE', '/releases/:version/health/override/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' } }))
      expect(res._status).toBe(200)
      expect(res._json.removed).toBe(true)

      var overrides = storage._store['release-planning/health-overrides-3.5.json']
      expect(overrides.overrides['T-1']).toBeUndefined()
    })

    it('writes audit log entry', function() {
      storage._store['release-planning/health-overrides-3.5.json'] = {
        version: '3.5',
        overrides: { 'T-1': { riskOverride: 'green', reason: 'test' } }
      }
      callRoute(router._routes, 'DELETE', '/releases/:version/health/override/:featureKey',
        makeReq({ params: { version: '3.5', featureKey: 'T-1' } }))
      var auditLog = storage._store['release-planning/audit-log.json']
      expect(auditLog).toBeDefined()
      var entry = auditLog.entries[auditLog.entries.length - 1]
      expect(entry.action).toBe('remove_risk_override')
    })
  })

  // ─── POST /releases/:version/health/refresh ───

  describe('POST /releases/:version/health/refresh', function() {
    it('returns 400 for invalid version', function() {
      var res = callRoute(router._routes, 'POST', '/releases/:version/health/refresh',
        makeReq({ params: { version: '../bad' } }))
      expect(res._status).toBe(400)
    })

    it('returns already_running when refresh in progress', function() {
      refreshStates.set('health:3.5:all', { running: true, startedAt: new Date().toISOString() })
      var res = callRoute(router._routes, 'POST', '/releases/:version/health/refresh',
        makeReq({ params: { version: '3.5' } }))
      expect(res._json.status).toBe('already_running')
    })

    it('returns 429 when max concurrent refreshes reached', function() {
      refreshStates.set('health:3.4:all', { running: true })
      refreshStates.set('health:3.3:all', { running: true })
      var res = callRoute(router._routes, 'POST', '/releases/:version/health/refresh',
        makeReq({ params: { version: '3.5' } }))
      expect(res._status).toBe(429)
    })

    it('returns started on success', function() {
      var res = callRoute(router._routes, 'POST', '/releases/:version/health/refresh',
        makeReq({ params: { version: '3.5' } }))
      expect(res._json.status).toBe('started')
    })
  })

  // ─── GET /releases/:version/health/refresh/status ───

  describe('GET /releases/:version/health/refresh/status', function() {
    it('returns 400 for invalid version', function() {
      var res = callRoute(router._routes, 'GET', '/releases/:version/health/refresh/status',
        makeReq({ params: { version: '!bad' } }))
      expect(res._status).toBe(400)
    })

    it('returns initial state when no refresh has run', function() {
      var res = callRoute(router._routes, 'GET', '/releases/:version/health/refresh/status',
        makeReq({ params: { version: '3.5' } }))
      expect(res._status).toBe(200)
      expect(res._json.running).toBe(false)
      expect(res._json.lastResult).toBeNull()
    })

    it('returns running state during refresh', function() {
      refreshStates.set('health:3.5:all', { running: true, startedAt: '2026-04-26T12:00:00Z', lastResult: null })
      var res = callRoute(router._routes, 'GET', '/releases/:version/health/refresh/status',
        makeReq({ params: { version: '3.5' } }))
      expect(res._json.running).toBe(true)
      expect(res._json.startedAt).toBe('2026-04-26T12:00:00Z')
    })
  })
})
