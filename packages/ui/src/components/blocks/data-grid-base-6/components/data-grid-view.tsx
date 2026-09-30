// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { useCallback, useMemo, useState } from "react"
import { Badge } from "@ui/components/reui/badge"
import {
  DataGrid,
  dataGridFeatures,
} from "@ui/components/reui/data-grid/data-grid"
import { DataGridPagination } from "@ui/components/reui/data-grid/data-grid-pagination"
import { DataGridScrollArea } from "@ui/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@ui/components/reui/data-grid/data-grid-table"
import {
  useTable,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table"
import { toast } from "sonner"

import { Button } from "@ui/components/primitives/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/components/primitives/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@ui/components/primitives/input-group"
import { Separator } from "@ui/components/primitives/separator"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@ui/components/primitives/tabs"
import { createMembersGridColumns, type MemberRowAction } from "./columns"
import {
  MEMBER_AUTH_PROVIDER_OPTIONS,
  MEMBER_BILLING_STATUS_OPTIONS,
  MEMBER_RECORDS,
  MEMBER_ROLE_OPTIONS,
  type FilterOption,
  type MemberAuthProvider,
  type MemberBillingStatus,
  type MemberRecord,
  type MemberRole,
} from "./data"
import { SearchIcon, XIcon, ChevronDownIcon } from "lucide-react"

type FilterTabContentProps<T extends string> = {
  options: readonly FilterOption<T>[]
  selectedValues: T[]
  onToggle: (value: T, checked: boolean) => void
}

function getMemberSearchBlob(member: MemberRecord) {
  return [
    member.fullName,
    member.displayName,
    member.email,
    member.role,
    member.billingStatus,
    member.authProvider,
    member.joinedAt,
  ]
    .join(" ")
    .toLowerCase()
}

function toggleFilterValue<T extends string>(
  current: T[],
  value: T,
  checked: boolean
) {
  if (checked) {
    return current.includes(value) ? current : [...current, value]
  }

  return current.filter((item) => item !== value)
}

function FilterTabContent<T extends string>({
  options,
  selectedValues,
  onToggle,
}: FilterTabContentProps<T>) {
  return (
    <DropdownMenuGroup>
      {options.map((option) => (
        <DropdownMenuCheckboxItem
          key={option.value}
          checked={selectedValues.includes(option.value)}
          closeOnClick={false}
          onCheckedChange={(checked) =>
            onToggle(option.value, checked === true)
          }
        >
          {option.label}
        </DropdownMenuCheckboxItem>
      ))}
    </DropdownMenuGroup>
  )
}

export function MembersDataGridView() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: "fullName", desc: false },
  ])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRoles, setSelectedRoles] = useState<MemberRole[]>([])
  const [selectedBillingStatuses, setSelectedBillingStatuses] = useState<
    MemberBillingStatus[]
  >([])
  const [selectedAuthProviders, setSelectedAuthProviders] = useState<
    MemberAuthProvider[]
  >([])

  const filteredData = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase()

    return MEMBER_RECORDS.filter((member) => {
      const matchesSearch =
        normalizedSearchQuery.length === 0 ||
        getMemberSearchBlob(member).includes(normalizedSearchQuery)
      const matchesRole =
        selectedRoles.length === 0 || selectedRoles.includes(member.role)
      const matchesBillingStatus =
        selectedBillingStatuses.length === 0 ||
        selectedBillingStatuses.includes(member.billingStatus)
      const matchesAuthProvider =
        selectedAuthProviders.length === 0 ||
        selectedAuthProviders.includes(member.authProvider)

      return (
        matchesSearch &&
        matchesRole &&
        matchesBillingStatus &&
        matchesAuthProvider
      )
    })
  }, [
    searchQuery,
    selectedAuthProviders,
    selectedBillingStatuses,
    selectedRoles,
  ])

  const activeFilterCount =
    selectedRoles.length +
    selectedBillingStatuses.length +
    selectedAuthProviders.length

  const handleMemberAction = useCallback(
    (action: MemberRowAction, member: MemberRecord) => {
      if (action === "view") {
        toast.info("Open member", {
          description: `Review ${member.fullName}'s profile and recent activity.`,
        })
        return
      }

      if (action === "edit") {
        toast.message("Edit member", {
          description: `Open the access and profile editor for ${member.fullName}.`,
        })
        return
      }

      toast.message("Delete member", {
        description: `Wire this action to your member removal flow for ${member.fullName}.`,
      })
    },
    []
  )

  const columns = useMemo(
    () => createMembersGridColumns({ onAction: handleMemberAction }),
    [handleMemberAction]
  )

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: filteredData,
    pageCount: Math.ceil(filteredData.length / pagination.pageSize),
    getRowId: (row) => row.id,
    state: {
      pagination,
      sorting,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  })

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setPagination((current) => ({
      ...current,
      pageIndex: 0,
    }))
  }

  const handleRoleToggle = (value: MemberRole, checked: boolean) => {
    setSelectedRoles((current) => toggleFilterValue(current, value, checked))
    setPagination((current) => ({
      ...current,
      pageIndex: 0,
    }))
  }

  const handleBillingStatusToggle = (
    value: MemberBillingStatus,
    checked: boolean
  ) => {
    setSelectedBillingStatuses((current) =>
      toggleFilterValue(current, value, checked)
    )
    setPagination((current) => ({
      ...current,
      pageIndex: 0,
    }))
  }

  const handleAuthProviderToggle = (
    value: MemberAuthProvider,
    checked: boolean
  ) => {
    setSelectedAuthProviders((current) =>
      toggleFilterValue(current, value, checked)
    )
    setPagination((current) => ({
      ...current,
      pageIndex: 0,
    }))
  }

  const handleResetFilters = () => {
    setSelectedRoles([])
    setSelectedBillingStatuses([])
    setSelectedAuthProviders([])
    setPagination((current) => ({
      ...current,
      pageIndex: 0,
    }))
  }

  const handleImport = () => {
    toast.message("Import members", {
      description:
        "Connect this button to your CSV import, directory sync, or SCIM provisioning flow.",
    })
  }

  const handleAddMember = () => {
    toast.message("Add member", {
      description:
        "Open your invite drawer or provisioning dialog from this primary action.",
    })
  }

  return (
    <DataGrid
      table={table}
      recordCount={filteredData.length}
      emptyMessage={
        filteredData.length === 0
          ? "No members match your current search or filters."
          : undefined
      }
      tableLayout={{
        dense: true,
        headerSticky: false,
        columnsVisibility: false,
        columnsResizable: false,
        columnsMovable: false,
      }}
      tableClassNames={{
        bodyRow: "group/member-row",
      }}
    >
      {/* Heading */}
      <div className="flex w-full flex-col">
        <div className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <h2 className="truncate text-2xl font-semibold tracking-tight">
              Members
            </h2>
            <Badge variant="outline" size="sm" radius="full">
              {filteredData.length}
            </Badge>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto lg:flex-nowrap lg:justify-end">
            <InputGroup className="w-full sm:w-72">
              <InputGroupAddon align="inline-start">
                <SearchIcon aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search..."
                aria-label="Search members"
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
              />
              {searchQuery.length > 0 ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    aria-label="Clear search"
                    size="icon-xs"
                    onClick={() => handleSearchChange("")}
                  >
                    <XIcon aria-hidden="true" />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Filter members"
                  >
                    Filters
                    {activeFilterCount > 0 ? (
                      <Badge variant="outline" size="sm" radius="full">
                        {activeFilterCount}
                      </Badge>
                    ) : null}
                    <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-64">
                <Tabs defaultValue="role" className="w-full">
                  <div className="p-1">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="role">Role</TabsTrigger>
                      <TabsTrigger value="billing">Billing</TabsTrigger>
                      <TabsTrigger value="authentication">Auth</TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="role" className="m-0 px-0.5 pb-1">
                    <FilterTabContent
                      options={MEMBER_ROLE_OPTIONS}
                      selectedValues={selectedRoles}
                      onToggle={handleRoleToggle}
                    />
                  </TabsContent>
                  <TabsContent value="billing" className="m-0 px-0.5 pb-1">
                    <FilterTabContent
                      options={MEMBER_BILLING_STATUS_OPTIONS}
                      selectedValues={selectedBillingStatuses}
                      onToggle={handleBillingStatusToggle}
                    />
                  </TabsContent>
                  <TabsContent
                    value="authentication"
                    className="m-0 px-0.5 pb-1"
                  >
                    <FilterTabContent
                      options={MEMBER_AUTH_PROVIDER_OPTIONS}
                      selectedValues={selectedAuthProviders}
                      onToggle={handleAuthProviderToggle}
                    />
                  </TabsContent>
                </Tabs>
                {activeFilterCount > 0 ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      closeOnClick={false}
                      onClick={handleResetFilters}
                    >
                      Reset filters
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button type="button" variant="outline" onClick={handleImport}>
              Import
            </Button>

            <Button type="button" onClick={handleAddMember}>
              Add member
            </Button>
          </div>
        </div>

        <Separator />

        <DataGridScrollArea>
          <DataGridTable />
        </DataGridScrollArea>

        <Separator />

        <div className="py-3">
          {filteredData.length > 0 ? (
            <DataGridPagination
              sizes={[5, 10, 20]}
              info="{from} - {to} of {count} members"
              className="py-0"
            />
          ) : (
            <p className="text-muted-foreground text-sm">0 members</p>
          )}
        </div>
      </div>
    </DataGrid>
  )
}