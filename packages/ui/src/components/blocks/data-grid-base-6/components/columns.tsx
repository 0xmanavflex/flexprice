// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { type DataGridFeatures } from "@ui/components/reui/data-grid/data-grid"
import { DataGridColumnHeader } from "@ui/components/reui/data-grid/data-grid-column-header"
import { type ColumnDef } from "@tanstack/react-table"
import { cn } from "cn"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@ui/components/primitives/avatar"
import { Button } from "@ui/components/primitives/button"
import { type MemberBillingStatus, type MemberRecord } from "./data"
import { EyeIcon, PencilIcon, Trash2Icon } from "lucide-react"

export type MemberRowAction = "view" | "edit" | "delete"

const billingStatusDotClass: Record<MemberBillingStatus, string> = {
  Active: "bg-emerald-500",
  "Pending invoice": "bg-sky-500",
  "Manual review": "bg-amber-500",
  "Past due": "bg-rose-500",
}

function MemberRowActions({
  member,
  onAction,
}: {
  member: MemberRecord
  onAction: (action: MemberRowAction, member: MemberRecord) => void
}) {
  return (
    <div className="pointer-events-none flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-focus-within/member-row:pointer-events-auto group-focus-within/member-row:opacity-100 group-hover/member-row:pointer-events-auto group-hover/member-row:opacity-100">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`View ${member.fullName}`}
        onClick={(event) => {
          event.stopPropagation()
          onAction("view", member)
        }}
      >
        <EyeIcon aria-hidden="true" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`Edit ${member.fullName}`}
        onClick={(event) => {
          event.stopPropagation()
          onAction("edit", member)
        }}
      >
        <PencilIcon aria-hidden="true" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="hover:text-destructive"
        aria-label={`Delete ${member.fullName}`}
        onClick={(event) => {
          event.stopPropagation()
          onAction("delete", member)
        }}
      >
        <Trash2Icon aria-hidden="true" />
      </Button>
    </div>
  )
}

function MemberCell({
  member,
  onAction,
}: {
  member: MemberRecord
  onAction: (action: MemberRowAction, member: MemberRecord) => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={member.avatarSrc} alt={member.fullName} />
        <AvatarFallback>{member.initials}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{member.fullName}</div>
        <div className="text-muted-foreground truncate text-sm">
          {member.displayName}
        </div>
      </div>

      {/* Actions */}
      <MemberRowActions member={member} onAction={onAction} />
    </div>
  )
}

function BillingStatusCell({
  billingStatus,
}: {
  billingStatus: MemberBillingStatus
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          billingStatusDotClass[billingStatus]
        )}
        aria-hidden="true"
      />
      <span className="truncate text-sm">{billingStatus}</span>
    </div>
  )
}

export function createMembersGridColumns({
  onAction,
}: {
  onAction: (action: MemberRowAction, member: MemberRecord) => void
}): ColumnDef<DataGridFeatures, MemberRecord>[] {
  return [
    {
      accessorKey: "fullName",
      id: "fullName",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) => (
        <MemberCell member={row.original} onAction={onAction} />
      ),
      size: 255,
      enableSorting: true,
      enableHiding: false,
      enableResizing: false,
      meta: {
        headerTitle: "Member",
      },
    },
    {
      accessorKey: "email",
      id: "email",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) => (
        <a
          href={`mailto:${row.original.email}`}
          className="hover:text-primary block truncate text-sm transition-colors hover:underline"
          title={row.original.email}
        >
          {row.original.email}
        </a>
      ),
      size: 220,
      enableSorting: true,
      enableHiding: false,
      enableResizing: false,
      meta: {
        headerTitle: "Email",
      },
    },
    {
      accessorKey: "role",
      id: "role",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) => (
        <span className="block truncate text-sm">{row.original.role}</span>
      ),
      size: 120,
      enableSorting: true,
      enableHiding: false,
      enableResizing: false,
      meta: {
        headerTitle: "Role",
      },
    },
    {
      accessorKey: "billingStatus",
      id: "billingStatus",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) => (
        <BillingStatusCell billingStatus={row.original.billingStatus} />
      ),
      size: 150,
      enableSorting: true,
      enableHiding: false,
      enableResizing: false,
      meta: {
        headerTitle: "Billing status",
      },
    },
    {
      accessorKey: "authProvider",
      id: "authProvider",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) => (
        <span className="block truncate text-sm">
          {row.original.authProvider}
        </span>
      ),
      size: 130,
      enableSorting: true,
      enableHiding: false,
      enableResizing: false,
      meta: {
        headerTitle: "Authentication",
      },
    },
    {
      accessorKey: "joinedAt",
      id: "joinedAt",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground block truncate text-sm tabular-nums">
          {row.original.joinedAt}
        </span>
      ),
      sortFn: (rowA, rowB) =>
        new Date(rowA.original.joinedAt).getTime() -
        new Date(rowB.original.joinedAt).getTime(),
      size: 130,
      enableSorting: true,
      enableHiding: false,
      enableResizing: false,
      meta: {
        headerTitle: "Joining date",
      },
    },
  ]
}