module.exports = function registerRoutes(router, context) {
  const { storage: _storage } = context

  router.get('/hello', function(req, res) {
    res.json({ message: 'Hello from my module!' })
  })
}
