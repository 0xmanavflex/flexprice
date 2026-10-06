// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { useMemo } from "react"
import { Badge } from "@ui/components/reui/badge"
import {
  Tree,
  TreeItem,
  TreeItemLabel,
} from "@ui/components/reui/tree"
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core"
import { useTree } from "@headless-tree/react"

import { Checkbox } from "@ui/components/primitives/checkbox"

import type { RoleBadge, RoleGroup as RoleGroupType } from "./data"

const ROOT_ID = "all-roles"
const INDENT = 20

// Folder ids are namespaced so a group id never collides with a role id of the
// same name (e.g. the "developer" group and its "developer" role).
const groupNodeId = (groupId: string) => `group:${groupId}`

interface RoleTreeNode {
  name: string
  children?: string[]
  badges?: RoleBadge[]
}

export function RoleTree({
  groups,
  expandedGroupIds,
  selectedRoleIds,
  onRoleChange,
}: {
  groups: RoleGroupType[]
  expandedGroupIds: string[]
  selectedRoleIds: ReadonlySet<string>
  onRoleChange: (roleId: string, checked: boolean) => void
}) {
  // Flatten the typed group data into the loader's id -> node map.
  const nodes = useMemo<Record<string, RoleTreeNode>>(() => {
    const map: Record<string, RoleTreeNode> = {
      [ROOT_ID]: {
        name: "All roles",
        children: groups.map((group) => groupNodeId(group.id)),
      },
    }

    for (const group of groups) {
      map[groupNodeId(group.id)] = {
        name: group.label,
        children: group.roles.map((role) => role.id),
      }
      for (const role of group.roles) {
        map[role.id] = { name: role.label, badges: role.badges }
      }
    }

    return map
  }, [groups])

  const tree = useTree<RoleTreeNode>({
    initialState: { expandedItems: expandedGroupIds.map(groupNodeId) },
    indent: INDENT,
    rootItemId: ROOT_ID,
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => (item.getItemData()?.children?.length ?? 0) > 0,
    dataLoader: {
      getItem: (itemId) => nodes[itemId],
      getChildren: (itemId) => nodes[itemId]?.children ?? [],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  })

  return (
    <Tree indent={INDENT} tree={tree} className="p-1.5">
      {tree.getItems().map((item) => {
        const id = item.getId()
        const node = item.getItemData()
        const isLeaf = !item.isFolder()

        return (
          // Leaves render as a clickable div: it hosts the checkbox (a button)
          // validly and toggles the role when the whole row is clicked.
          <TreeItem
            key={id}
            item={item}
            render={
              isLeaf ? (
                <div
                  className="cursor-pointer"
                  onClick={() => onRoleChange(id, !selectedRoleIds.has(id))}
                />
              ) : undefined
            }
          >
            <TreeItemLabel className="not-in-data-[folder=true]:ps-5">
              {isLeaf ? (
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <Checkbox
                    checked={selectedRoleIds.has(id)}
                    onCheckedChange={(checked) =>
                      onRoleChange(id, checked === true)
                    }
                    onClick={(event) => event.stopPropagation()}
                    aria-label={node.name}
                    className="size-3.5"
                  />
                  <span className="min-w-0 truncate">{node.name}</span>
                  {node.badges?.length ? (
                    <span className="ml-auto flex shrink-0 items-center gap-1.5">
                      {node.badges.map((badge) => (
                        <Badge key={badge.label} variant={badge.variant}>
                          {badge.label}
                        </Badge>
                      ))}
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="truncate font-medium">{node.name}</span>
              )}
            </TreeItemLabel>
          </TreeItem>
        )
      })}
    </Tree>
  )
}