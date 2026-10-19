import { describe, expect, it } from 'vitest'
import { addTerm, compileQuery, formatQuery, formatTerm, parseQuery, quoteValue, resolvePath, validateQuery } from './query'

const ev = {
  '@timestamp': '2026-10-19T10:00:00Z',
  message: 'Failed password for root from 198.51.100.23',
  event: { category: ['process', 'file'], action: 'exec' },
  host: { name: 'DESKTOP-7QK2M4' },
  process: { name: 'powershell.exe', pid: 8844, command_line: 'powershell.exe -NoProfile -File C:\\Users\\alex\\x.ps1', user: { name: 'alex' } },
  destination: { port: 443, ip: '203.0.113.77' },
  file: { path: 'C:\\Users\\alex\\AppData\\Roaming\\helper.ps1' },
  data: { LogonType: '3', 'suricata.sid': 2001219 },
}

describe('parseQuery', () => {
  it('returns null for an empty query', () => {
    expect(parseQuery('   ')).toBeNull()
  })

  it('parses field terms, operators and precedence (AND binds tighter than OR)', () => {
    const n = parseQuery('a:1 OR b:2 AND NOT c:3')
    expect(n).toEqual({
      type: 'or',
      children: [
        { type: 'term', field: 'a', op: ':', value: '1', quoted: false },
        {
          type: 'and',
          children: [
            { type: 'term', field: 'b', op: ':', value: '2', quoted: false },
            { type: 'not', child: { type: 'term', field: 'c', op: ':', value: '3', quoted: false } },
          ],
        },
      ],
    })
  })

  it('treats adjacent terms as AND', () => {
    expect(formatQuery('process.name:cmd.exe user.name:alex')).toBe('process.name:cmd.exe AND user.name:alex')
  })

  it('parses comparisons and quoted values with escapes', () => {
    expect(parseQuery('destination.port:>=1024')).toMatchObject({ field: 'destination.port', op: '>=', value: '1024' })
    expect(parseQuery('file.path:"C:\\\\Program Files\\\\x \\"y\\""')).toMatchObject({
      field: 'file.path',
      value: 'C:\\Program Files\\x "y"',
      quoted: true,
    })
  })

  it('splits the field at the first colon so Windows paths survive', () => {
    expect(parseQuery('file.path:C:\\Windows\\*')).toMatchObject({ field: 'file.path', value: 'C:\\Windows\\*' })
  })

  it('reports syntax errors with positions', () => {
    expect(validateQuery('(a:1 OR b:2')?.message).toMatch(/closing parenthesis/)
    expect(validateQuery('a:1 OR')?.message).toMatch(/ends unexpectedly/)
    expect(validateQuery('a:1)')?.message).toMatch(/Unexpected closing/)
    expect(validateQuery('process.name:')?.message).toMatch(/Missing value/)
    expect(validateQuery('"unterminated')?.pos).toBe(0)
    expect(validateQuery('()')?.message).toMatch(/Empty parentheses/)
    expect(validateQuery('a:1 AND (b:2 OR c:3)')).toBeNull()
  })
})

describe('evaluate', () => {
  const m = (q: string) => compileQuery(q)(ev)

  it('matches exact values case-insensitively and array fields by any element', () => {
    expect(m('process.name:POWERSHELL.EXE')).toBe(true)
    expect(m('event.category:file')).toBe(true)
    expect(m('event.category:network')).toBe(false)
  })

  it('supports prefix, suffix and contains wildcards', () => {
    expect(m('process.name:power*')).toBe(true)
    expect(m('process.name:*shell.exe')).toBe(true)
    expect(m('process.name:*rshe*')).toBe(true)
    expect(m('process.name:cmd*')).toBe(false)
  })

  it('treats quoted values literally (no wildcard)', () => {
    expect(m('process.name:"power*"')).toBe(false)
  })

  it('compares numbers', () => {
    expect(m('destination.port:>=443')).toBe(true)
    expect(m('destination.port:<443')).toBe(false)
    expect(m('process.pid:8844')).toBe(true)
  })

  it('handles NOT, OR and parentheses', () => {
    expect(m('process.name:powershell.exe AND NOT user.name:SYSTEM')).toBe(true)
    expect(m('NOT (process.name:cmd.exe OR process.name:powershell.exe)')).toBe(false)
  })

  it('matches bare words against message, command line and file path', () => {
    expect(m('NoProfile')).toBe(true)
    expect(m('helper.ps1')).toBe(true)
    expect(m('198.51.100.23')).toBe(true)
    expect(m('mimikatz')).toBe(false)
  })

  it('resolves data.* keys that contain dots, case-insensitively', () => {
    expect(resolvePath(ev, 'data.suricata.sid')).toEqual([2001219])
    expect(m('data.logontype:3')).toBe(true)
  })

  it('matches everything for an empty query', () => {
    expect(m('')).toBe(true)
  })
})

describe('building queries', () => {
  it('quotes values that would not round-trip', () => {
    expect(quoteValue('powershell.exe')).toBe('powershell.exe')
    expect(quoteValue('C:\\Program Files\\x.exe')).toBe('"C:\\\\Program Files\\\\x.exe"')
    expect(quoteValue('a*b')).toBe('"a*b"')
    expect(quoteValue('OR')).toBe('"OR"')
    expect(quoteValue('')).toBe('""')
    expect(formatTerm('process.pid', 42)).toBe('process.pid:42')
  })

  it('round-trips quoted values through the parser', () => {
    const v = 'say "hi" (now) C:\\temp'
    const node = parseQuery(formatTerm('message', v))
    expect(node).toMatchObject({ field: 'message', value: v, quoted: true })
  })

  it('appends terms with AND and avoids duplicates', () => {
    expect(addTerm('', 'host.name', 'web01')).toBe('host.name:web01')
    expect(addTerm('event.category:process', 'host.name', 'web01')).toBe('event.category:process AND host.name:web01')
    expect(addTerm('host.name:web01', 'host.name', 'web01')).toBe('host.name:web01')
  })

  it('parenthesizes a top-level OR before appending', () => {
    expect(addTerm('a:1 OR b:2', 'c', '3')).toBe('(a:1 OR b:2) AND c:3')
  })

  it('supports negated terms', () => {
    expect(addTerm('a:1', 'user.name', 'SYSTEM', { negate: true })).toBe('a:1 AND NOT user.name:SYSTEM')
  })
})
