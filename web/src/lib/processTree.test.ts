import { describe, expect, it } from 'vitest'
import type { ProcessNode } from '../api/types'
import { collapsibleIds, countNodes, defaultCollapsed, findPath, flattenTree, totalEventCount } from './processTree'

function node(id: string, children: ProcessNode[] = [], extra: Partial<ProcessNode> = {}): ProcessNode {
  return {
    entity_id: id,
    pid: id.length * 100,
    name: `${id}.exe`,
    alert_count: 0,
    event_counts: { network: 0, file: 0, registry: 0, dns: 0, library: 0 },
    children,
    ...extra,
  }
}

// winlogon → userinit → explorer → powershell(target) → [whoami, net → [net1], reg]
const tree = node('winlogon', [
  node('userinit', [
    node('explorer', [
      node(
        'powershell',
        [node('whoami'), node('net', [node('net1')]), node('reg')],
        { is_target: true, event_counts: { network: 2, file: 3, registry: 0, dns: 1, library: 0 } },
      ),
    ]),
  ]),
])

describe('flattenTree', () => {
  it('flattens in pre-order with depths and roles', () => {
    const rows = flattenTree(tree)
    expect(rows.map((r) => [r.node.entity_id, r.depth, r.role])).toEqual([
      ['winlogon', 0, 'ancestor'],
      ['userinit', 1, 'ancestor'],
      ['explorer', 2, 'ancestor'],
      ['powershell', 3, 'target'],
      ['whoami', 4, 'descendant'],
      ['net', 4, 'descendant'],
      ['net1', 5, 'descendant'],
      ['reg', 4, 'descendant'],
    ])
  })

  it('computes guide lines and last-child flags', () => {
    const rows = flattenTree(tree)
    const byId = Object.fromEntries(rows.map((r) => [r.node.entity_id, r]))
    expect(byId.winlogon.guides).toEqual([])
    expect(byId.userinit.guides).toEqual([])
    expect(byId.whoami.isLast).toBe(false)
    expect(byId.reg.isLast).toBe(true)
    // net1 sits under "net", which has a later sibling (reg), so net's column continues.
    expect(byId.net1.guides).toEqual([false, false, false, true])
    expect(byId.net1.guides.length).toBe(byId.net1.depth - 1)
    for (const r of rows) expect(r.guides.length).toBe(Math.max(0, r.depth - 1))
  })

  it('skips collapsed subtrees and reports how much is hidden', () => {
    const rows = flattenTree(tree, new Set(['powershell']))
    expect(rows.map((r) => r.node.entity_id)).toEqual(['winlogon', 'userinit', 'explorer', 'powershell'])
    const ps = rows[3]
    expect(ps.collapsed).toBe(true)
    expect(ps.hiddenCount).toBe(4)
  })

  it('ignores collapse state on leaves', () => {
    const rows = flattenTree(tree, new Set(['whoami']))
    expect(rows.find((r) => r.node.entity_id === 'whoami')?.collapsed).toBe(false)
  })

  it('falls back to targetId when no node is flagged', () => {
    const plain = node('a', [node('b', [node('c')]), node('d')])
    const rows = flattenTree(plain, new Set(), 'b')
    expect(rows.map((r) => r.role)).toEqual(['ancestor', 'target', 'descendant', 'related'])
  })
})

describe('tree helpers', () => {
  it('finds the path to a node', () => {
    expect(findPath(tree, 'net1')?.map((n) => n.entity_id)).toEqual(['winlogon', 'userinit', 'explorer', 'powershell', 'net', 'net1'])
    expect(findPath(tree, 'missing')).toBeNull()
  })

  it('counts nodes and collapsible nodes', () => {
    expect(countNodes(tree)).toBe(8)
    expect(collapsibleIds(tree)).toEqual(['winlogon', 'userinit', 'explorer', 'powershell', 'net'])
  })

  it('collapses deep descendants by default but keeps the path open', () => {
    expect([...defaultCollapsed(tree, 1)]).toEqual(['net'])
    expect([...defaultCollapsed(tree, 2)]).toEqual([])
  })

  it('sums event counts', () => {
    expect(totalEventCount(tree.children[0].children[0].children[0])).toBe(6)
  })
})
