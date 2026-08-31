import { describe, it, expect } from 'vitest'

var { extractFirstInProgressAt, extractAdfText, extractCustomersFromComments } = require('../../../server/planning/bu-feedback-issue')

describe('extractFirstInProgressAt', function() {
  it('returns null for null changelog', function() {
    expect(extractFirstInProgressAt(null)).toBeNull()
  })

  it('returns null for empty histories', function() {
    expect(extractFirstInProgressAt({ histories: [] })).toBeNull()
  })

  it('returns null when no in-progress transition exists', function() {
    var changelog = {
      histories: [
        {
          created: '2026-06-01T12:00:00.000Z',
          items: [{ field: 'status', toString: 'New' }]
        },
        {
          created: '2026-06-02T12:00:00.000Z',
          items: [{ field: 'status', toString: 'Closed' }]
        }
      ]
    }
    expect(extractFirstInProgressAt(changelog)).toBeNull()
  })

  it('returns the first In Progress transition timestamp', function() {
    var changelog = {
      histories: [
        {
          created: '2026-06-01T12:00:00.000Z',
          items: [{ field: 'status', toString: 'New' }]
        },
        {
          created: '2026-06-05T12:00:00.000Z',
          items: [{ field: 'status', toString: 'In Progress' }]
        },
        {
          created: '2026-06-10T12:00:00.000Z',
          items: [{ field: 'status', toString: 'In Review' }]
        }
      ]
    }
    expect(extractFirstInProgressAt(changelog)).toBe('2026-06-05T12:00:00.000Z')
  })

  it('handles unsorted histories and picks the earliest', function() {
    var changelog = {
      histories: [
        {
          created: '2026-06-10T12:00:00.000Z',
          items: [{ field: 'status', toString: 'In Review' }]
        },
        {
          created: '2026-06-03T12:00:00.000Z',
          items: [{ field: 'status', toString: 'In Progress' }]
        }
      ]
    }
    expect(extractFirstInProgressAt(changelog)).toBe('2026-06-03T12:00:00.000Z')
  })

  it('is case-insensitive on status names', function() {
    var changelog = {
      histories: [
        {
          created: '2026-06-01T12:00:00.000Z',
          items: [{ field: 'status', toString: 'IN PROGRESS' }]
        }
      ]
    }
    expect(extractFirstInProgressAt(changelog)).toBe('2026-06-01T12:00:00.000Z')
  })

  it('recognises QA, Testing, Development, Coding statuses', function() {
    var names = ['QA', 'Testing', 'Development', 'Coding']
    for (var i = 0; i < names.length; i++) {
      var changelog = {
        histories: [
          {
            created: '2026-06-01T12:00:00.000Z',
            items: [{ field: 'status', toString: names[i] }]
          }
        ]
      }
      expect(extractFirstInProgressAt(changelog)).toBe('2026-06-01T12:00:00.000Z')
    }
  })

  it('ignores non-status field changes', function() {
    var changelog = {
      histories: [
        {
          created: '2026-06-01T12:00:00.000Z',
          items: [{ field: 'assignee', toString: 'In Progress' }]
        }
      ]
    }
    expect(extractFirstInProgressAt(changelog)).toBeNull()
  })
})

function adfParagraph(text) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: text }] }] }
}

function adfMultiLine(lines) {
  var content = []
  for (var i = 0; i < lines.length; i++) {
    if (i > 0) content.push({ type: 'hardBreak' })
    content.push({ type: 'text', text: lines[i] })
  }
  return { type: 'doc', content: [{ type: 'paragraph', content: content }] }
}

describe('extractAdfText', function() {
  it('returns empty string for null', function() {
    expect(extractAdfText(null)).toBe('')
  })

  it('extracts text from a simple paragraph', function() {
    expect(extractAdfText(adfParagraph('Hello world'))).toBe('Hello world')
  })

  it('separates paragraphs with newlines', function() {
    var adf = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Line 1' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Line 2' }] }
      ]
    }
    expect(extractAdfText(adf)).toBe('Line 1\nLine 2')
  })

  it('converts hardBreak to newline', function() {
    var adf = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'before' },
          { type: 'hardBreak' },
          { type: 'text', text: 'after' }
        ]
      }]
    }
    expect(extractAdfText(adf)).toBe('before\nafter')
  })
})

describe('extractCustomersFromComments', function() {
  it('returns empty string for null input', function() {
    expect(extractCustomersFromComments(null)).toBe('')
  })

  it('returns empty string when comments array is missing', function() {
    expect(extractCustomersFromComments({})).toBe('')
  })

  it('returns empty string when no comments match', function() {
    var field = { comments: [{ body: adfParagraph('Just a regular comment') }] }
    expect(extractCustomersFromComments(field)).toBe('')
  })

  it('extracts a single customer name', function() {
    var field = {
      comments: [{ body: adfMultiLine(['affected customer', 'customer: Aramco', 'case: https://example.com']) }]
    }
    expect(extractCustomersFromComments(field)).toBe('Aramco')
  })

  it('extracts multiple customers from different comments', function() {
    var field = {
      comments: [
        { body: adfParagraph('customer: Aramco') },
        { body: adfParagraph('customer: IBM') }
      ]
    }
    expect(extractCustomersFromComments(field)).toBe('Aramco, IBM')
  })

  it('deduplicates customer names case-insensitively', function() {
    var field = {
      comments: [
        { body: adfParagraph('customer: Aramco') },
        { body: adfParagraph('Customer: ARAMCO') }
      ]
    }
    expect(extractCustomersFromComments(field)).toBe('Aramco')
  })

  it('matches case-insensitively (Customer:, CUSTOMER:, customer:)', function() {
    var field = {
      comments: [
        { body: adfParagraph('Customer: Alpha') },
        { body: adfParagraph('CUSTOMER: Beta') },
        { body: adfParagraph('customer: Gamma') }
      ]
    }
    expect(extractCustomersFromComments(field)).toBe('Alpha, Beta, Gamma')
  })

  it('captures multi-word customer names to end of line', function() {
    var field = {
      comments: [{ body: adfParagraph('customer: Saudi Aramco') }]
    }
    expect(extractCustomersFromComments(field)).toBe('Saudi Aramco')
  })

  it('handles multiple customer lines in a single comment', function() {
    var field = {
      comments: [{
        body: adfMultiLine(['customer: Aramco', 'customer: IBM'])
      }]
    }
    expect(extractCustomersFromComments(field)).toBe('Aramco, IBM')
  })

  it('skips comments with no body', function() {
    var field = {
      comments: [
        { body: null },
        { body: adfParagraph('customer: Aramco') }
      ]
    }
    expect(extractCustomersFromComments(field)).toBe('Aramco')
  })

  it('handles real-world ADF with separate paragraphs for customer and case', function() {
    var field = {
      comments: [{
        body: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'affected customer' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'customer: Aramco' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'case: https://access.redhat.com/support/cases/#/case/04528409' }] }
          ]
        }
      }]
    }
    expect(extractCustomersFromComments(field)).toBe('Aramco')
  })

  it('splits comma-separated customers from a single line', function() {
    var field = {
      comments: [{ body: adfParagraph('customer: Aramco, Cisco, Bank of America') }]
    }
    expect(extractCustomersFromComments(field)).toBe('Aramco, Cisco, Bank of America')
  })

  it('deduplicates across comma-separated and separate comments', function() {
    var field = {
      comments: [
        { body: adfParagraph('customer: Aramco, Cisco') },
        { body: adfParagraph('customer: Aramco') }
      ]
    }
    expect(extractCustomersFromComments(field)).toBe('Aramco, Cisco')
  })
})
