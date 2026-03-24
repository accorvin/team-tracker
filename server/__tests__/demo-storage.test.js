import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'

// Test with DEMO_MODE enabled
process.env.DEMO_MODE = 'true'

// Import after setting env var
const { readFromStorage, writeToStorage, FIXTURES_DIR } = require('../../shared/server/demo-storage')

const testFixturePath = path.join(FIXTURES_DIR, 'test-fixture.json')

describe('demo-storage', () => {
  beforeAll(() => {
    // Create a test fixture file
    fs.mkdirSync(FIXTURES_DIR, { recursive: true })
    fs.writeFileSync(testFixturePath, JSON.stringify({ test: 'data' }))
  })

  afterAll(() => {
    // Clean up test fixture
    if (fs.existsSync(testFixturePath)) {
      fs.unlinkSync(testFixturePath)
    }
  })

  describe('readFromStorage', () => {
    it('reads JSON from fixtures directory', () => {
      const data = readFromStorage('test-fixture.json')
      expect(data).toEqual({ test: 'data' })
    })

    it('returns null for non-existent files', () => {
      const data = readFromStorage('non-existent.json')
      expect(data).toBeNull()
    })

    it('supports nested paths like people/name.json', () => {
      // Create nested fixture
      const nestedDir = path.join(FIXTURES_DIR, 'people')
      fs.mkdirSync(nestedDir, { recursive: true })
      const nestedPath = path.join(nestedDir, 'test-person.json')
      fs.writeFileSync(nestedPath, JSON.stringify({ name: 'Test Person' }))

      const data = readFromStorage('people/test-person.json')
      expect(data).toEqual({ name: 'Test Person' })

      // Cleanup
      fs.unlinkSync(nestedPath)
    })
  })

  describe('writeToStorage', () => {
    it('is a no-op that does not write files', () => {
      const nonExistentPath = path.join(FIXTURES_DIR, 'should-not-exist.json')

      // Ensure file doesn't exist before test
      if (fs.existsSync(nonExistentPath)) {
        fs.unlinkSync(nonExistentPath)
      }

      // Call writeToStorage
      writeToStorage('should-not-exist.json', { data: 'test' })

      // File should still not exist
      expect(fs.existsSync(nonExistentPath)).toBe(false)
    })
  })
})
