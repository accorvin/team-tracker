/**
 * Auth middleware extracted from dev-server.js.
 * Provides authentication and authorization for Express routes.
 */

function createAuthMiddleware(readFromStorage, writeToStorage) {
  function isAdmin(email) {
    const adminList = readFromStorage('allowlist.json')
    const result = adminList && adminList.emails && adminList.emails.includes(email)
    return result
  }

  function seedAdminList() {
    const existing = readFromStorage('allowlist.json')
    if (existing && existing.emails && existing.emails.length > 0) {
      console.log(`Admin list: ${existing.emails.length} admin(s) loaded`)
      return
    }

    const adminEmails = process.env.ADMIN_EMAILS
    if (!adminEmails) {
      console.log('Admin list: empty — first authenticated user will be auto-added as admin')
      return
    }

    const emails = adminEmails
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)

    writeToStorage('allowlist.json', { emails })
    console.log(`Admin list: seeded with ${emails.length} admin(s) from ADMIN_EMAILS`)
  }

  async function authMiddleware(req, res, next) {
    if (req.method === 'OPTIONS') return next()

    const email = req.headers['x-forwarded-email']
    if (email) {
      req.userEmail = email.toLowerCase()
    } else {
      req.userEmail = (process.env.ADMIN_EMAILS || 'local-dev@redhat.com').split(',')[0].trim().toLowerCase()
    }

    const adminList = readFromStorage('allowlist.json')
    if (!adminList || !adminList.emails || adminList.emails.length === 0) {
      const seeded = { emails: [req.userEmail] }
      writeToStorage('allowlist.json', seeded)
      console.log(`Admin list: auto-added first user ${req.userEmail}`)
    }

    req.isAdmin = isAdmin(req.userEmail)
    next()
  }

  function requireAdmin(req, res, next) {
    if (!req.isAdmin) {
      return res.status(403).json({ error: 'Admin access required.' })
    }
    next()
  }

  return { authMiddleware, requireAdmin, isAdmin, seedAdminList }
}

module.exports = { createAuthMiddleware }
