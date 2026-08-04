import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require2 = createRequire(import.meta.url)
const corePkg = require2.resolve('@org-pulse/core/package.json')
const coreDir = corePkg.replace(/\/package\.json$/, '')
const { _tryMatch: tryMatch } = require2(coreDir + '/shared/server/roster-sync/username-inference')

const person = {
  name: 'Jane Doe',
  email: 'jdoe@redhat.com',
}

describe('tryMatch strict mode (GitLab)', () => {
  it('does not match by email prefix in strict mode', () => {
    const result = tryMatch(person, [{ username: 'jdoe' }], { strict: true })
    expect(result).toBeNull()
  })

  it('does not match by name patterns in strict mode', () => {
    for (const login of ['janedoe', 'jane-doe', 'jane.doe', 'jdoe']) {
      const result = tryMatch(person, [{ username: login }], { strict: true })
      expect(result).toBeNull()
    }
  })

  it('matches by profile name in strict mode', () => {
    const result = tryMatch(person, [{ username: 'gl-user-123', name: 'Jane Doe' }], { strict: true })
    expect(result).toBe('gl-user-123')
  })

  it('matches by profile email in strict mode', () => {
    const result = tryMatch(person, [{ username: 'gl-user-456', email: 'jdoe@redhat.com' }], { strict: true })
    expect(result).toBe('gl-user-456')
  })
})

describe('tryMatch normal mode (GitHub)', () => {
  it('matches by email prefix', () => {
    const result = tryMatch(person, [{ username: 'jdoe' }])
    expect(result).toBe('jdoe')
  })

  it('matches by name patterns', () => {
    expect(tryMatch(person, [{ username: 'janedoe' }])).toBe('janedoe')
    expect(tryMatch(person, [{ username: 'jane-doe' }])).toBe('jane-doe')
    expect(tryMatch(person, [{ username: 'jane.doe' }])).toBe('jane.doe')
  })

  it('matches by profile name', () => {
    const result = tryMatch(person, [{ username: 'whatever', name: 'Jane Doe' }])
    expect(result).toBe('whatever')
  })

  it('matches by profile email', () => {
    const result = tryMatch(person, [{ username: 'whatever', email: 'jdoe@redhat.com' }])
    expect(result).toBe('whatever')
  })
})
