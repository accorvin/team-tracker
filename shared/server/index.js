const storage = require('./storage')
const demoStorage = require('./demo-storage')
const { createAuthMiddleware } = require('./auth')

module.exports = {
  storage,
  demoStorage,
  createAuthMiddleware
}
