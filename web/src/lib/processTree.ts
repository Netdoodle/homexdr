// Turning the nested ProcessNode tree from /api/process-tree into rows for an indented,
// collapsible list.

import type { ProcessNode } from '../api/types'

export type NodeRole = 'ancestor' | 'target' | 'descendant' | 'related'

export interface FlatRow {
  node: ProcessNode
  depth: number
  hasChildren: boolean
  collapsed: boolean
  role: NodeRole
  /** True for the last child of its parent (draws └ instead of ├). */
  isLast: boolean
  /**
   * Vertical guide lines to draw left of the connector, one per indent column
   * (length === max(depth - 1, 0)). guides[k] is true when the ancestor at depth k + 1
   * has later siblings, so its │ line continues through this row.
   */
  guides: boolean[]
  /** Number of nodes hidden below this row because it is collapsed. */
  hiddenCount: number
}

/** Returns the target node: the one flagged is_target, or the one with the given id. */
export function findTarget(root: ProcessNode, entityId?: string): ProcessNode | null {
  let found: ProcessNode | null = null
  walk(root, (n) => {
    if (!found && (n.is_target || (entityId !== undefined && n.entity_id === entityId))) found = n
  })
  return found
}

/** Path of nodes from the root down to (and including) the node with `entityId`. */
export function findPath(root: ProcessNode, entityId: string): ProcessNode[] | null {
  if (root.entity_id === entityId) return [root]
  for (const c of root.children ?? []) {
    const p = findPath(c, entityId)
    if (p) return [root, ...p]
  }
  return null
}

export function walk(root: ProcessNode, fn: (n: ProcessNode, depth: number) => void, depth = 0) {
  fn(root, depth)
  for (const c of root.children ?? []) walk(c, fn, depth + 1)
}

export function countNodes(root: ProcessNode): number {
  let n = 0
  walk(root, () => n++)
  return n
}

/** Number of nodes strictly below `node`. */
export function countDescendants(node: ProcessNode): number {
  return countNodes(node) - 1
}

/**
 * Flattens the tree in pre-order, skipping the subtrees of collapsed nodes. Roles are
 * computed relative to the target (is_target or `targetId`): nodes on the path above it
 * are ancestors, nodes beneath it are descendants, anything else is related.
 */
export function flattenTree(root: ProcessNode, collapsed: ReadonlySet<string> = new Set(), targetId?: string): FlatRow[] {
  const target = findTarget(root, targetId)
  const pathIds = new Set((target ? findPath(root, target.entity_id) : null)?.map((n) => n.entity_id) ?? [])
  const rows: FlatRow[] = []

  const visit = (node: ProcessNode, depth: number, guides: boolean[], isLast: boolean, underTarget: boolean) => {
    const isTarget = target !== null && node.entity_id === target.entity_id
    let role: NodeRole
    if (isTarget) role = 'target'
    else if (underTarget) role = 'descendant'
    else if (pathIds.has(node.entity_id)) role = 'ancestor'
    else role = 'related'

    const children = node.children ?? []
    const isCollapsed = children.length > 0 && collapsed.has(node.entity_id)
    rows.push({
      node,
      depth,
      hasChildren: children.length > 0,
      collapsed: isCollapsed,
      role,
      isLast,
      guides,
      hiddenCount: isCollapsed ? countDescendants(node) : 0,
    })
    if (isCollapsed) return
    // A child's guides are this node's guides plus this node's own column, which
    // continues while this node has later siblings. The root draws no column.
    const childGuides = depth === 0 ? [] : [...guides, !isLast]
    children.forEach((c, i) => {
      visit(c, depth + 1, childGuides, i === children.length - 1, underTarget || isTarget)
    })
  }

  visit(root, 0, [], true, false)
  return rows
}

/** IDs of every node with children, for "collapse all". */
export function collapsibleIds(root: ProcessNode): string[] {
  const ids: string[] = []
  walk(root, (n) => {
    if ((n.children ?? []).length > 0) ids.push(n.entity_id)
  })
  return ids
}

/**
 * Default collapse state: everything on the path to the target stays open, and
 * descendants deeper than `openDepthBelowTarget` levels under the target are collapsed.
 * Siblings of ancestors ("related") are collapsed.
 */
export function defaultCollapsed(root: ProcessNode, openDepthBelowTarget = 2, targetId?: string): Set<string> {
  const out = new Set<string>()
  const target = findTarget(root, targetId)
  if (!target) return out
  const path = new Set((findPath(root, target.entity_id) ?? []).map((n) => n.entity_id))
  const targetDepth = (findPath(root, target.entity_id) ?? []).length - 1
  const visit = (n: ProcessNode, depth: number, underTarget: boolean) => {
    const kids = n.children ?? []
    if (kids.length > 0) {
      if (underTarget && depth - targetDepth >= openDepthBelowTarget) out.add(n.entity_id)
      if (!underTarget && !path.has(n.entity_id)) out.add(n.entity_id)
    }
    for (const c of kids) visit(c, depth + 1, underTarget || n.entity_id === target.entity_id)
  }
  visit(root, 0, false)
  return out
}

/** Sum of a node's per-category event counts. */
export function totalEventCount(n: ProcessNode): number {
  return Object.values(n.event_counts ?? {}).reduce((a, b) => a + (b ?? 0), 0)
}
