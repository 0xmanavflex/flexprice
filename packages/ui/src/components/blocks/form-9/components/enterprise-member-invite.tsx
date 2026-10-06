// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import {
  Fragment,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { Badge } from "@ui/components/reui/badge"
import { cn } from "cn"
import { toast } from "sonner"

import { Button } from "@ui/components/primitives/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ui/components/primitives/card"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@ui/components/primitives/combobox"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@ui/components/primitives/empty"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@ui/components/primitives/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@ui/components/primitives/input-group"
import {
  RadioGroup,
  RadioGroupItem,
} from "@ui/components/primitives/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/components/primitives/select"
import { Separator } from "@ui/components/primitives/separator"
import { Switch } from "@ui/components/primitives/switch"
import { Textarea } from "@ui/components/primitives/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ui/components/primitives/tooltip"
import {
  DEFAULT_INVITEES,
  DEFAULT_SELECTED_ROLE_IDS,
  INVITE_EXPIRY_OPTIONS,
  INVITEES,
  MEMBER_TYPE_OPTIONS,
  ROLE_GROUPS,
  WORKSPACE_OPTIONS,
  type Invitee,
  type InviteExpiryOption,
  type MemberTypeOption,
  type RoleGroup as RoleGroupType,
  type WorkspaceOption,
} from "./data"
import { RoleTree } from "./role-tree"
import { UsersIcon, CircleCheckIcon, XIcon, MessageSquareTextIcon, SaveIcon, SendIcon, InfoIcon, ShieldCheckIcon, SearchIcon, SearchXIcon } from "lucide-react"

const FORM_ID = "form-9-enterprise-member-invite"

function getDefaultOpenGroupIds() {
  return ROLE_GROUPS.filter((group) => group.defaultOpen).map(
    (group) => group.id
  )
}

function filterRoleGroups(query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return ROLE_GROUPS
  }

  return ROLE_GROUPS.map((group) => {
    const groupMatches =
      group.label.toLowerCase().includes(normalizedQuery) ||
      group.description.toLowerCase().includes(normalizedQuery)

    if (groupMatches) {
      return group
    }

    const roles = group.roles.filter(
      (role) =>
        role.label.toLowerCase().includes(normalizedQuery) ||
        role.description.toLowerCase().includes(normalizedQuery) ||
        role.badges?.some((badge) =>
          badge.label.toLowerCase().includes(normalizedQuery)
        )
    )

    return roles.length ? { ...group, roles } : null
  }).filter((group): group is RoleGroupType => Boolean(group))
}

type MemberInviteToastKind = "success" | "info"

function getToastIcon(kind: MemberInviteToastKind) {
  if (kind === "info") {
    return (
      <UsersIcon className="text-info-foreground size-4 shrink-0" aria-hidden="true" />
    )
  }

  return (
    <CircleCheckIcon className="text-success size-4 shrink-0" aria-hidden="true" />
  )
}

function ToastTitle({ icon, children }: { icon: ReactNode; children: string }) {
  return (
    <span className="flex items-center gap-2">
      {icon}
      <span className="min-w-0">{children}</span>
    </span>
  )
}

function ToastDescription({ children }: { children: string }) {
  return (
    <span className="grid grid-cols-[1rem_1fr] gap-2">
      <span aria-hidden="true" />
      <span>{children}</span>
    </span>
  )
}

function showMemberInviteToast(
  title: string,
  description: string,
  kind: MemberInviteToastKind = "success"
) {
  const toastTitle = <ToastTitle icon={getToastIcon(kind)}>{title}</ToastTitle>
  const options = {
    description: <ToastDescription>{description}</ToastDescription>,
    icon: null,
  }

  if (kind === "info") {
    toast.message(toastTitle, options)
    return
  }

  toast.success(toastTitle, options)
}

function InviteToolbar({
  formId,
  canSendInvite,
  onClose,
  onFeedback,
  onSaveDraft,
}: {
  formId: string
  canSendInvite: boolean
  onClose: () => void
  onFeedback: () => void
  onSaveDraft: () => void
}) {
  return (
    <header className="border-border bg-background sticky top-0 z-20 flex min-h-14 w-full shrink-0 items-center justify-between gap-3 border-b px-4">
      <div className="flex min-w-0 items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="-ms-2 size-8 shrink-0"
          aria-label="Close member invite form"
          onClick={onClose}
        >
          <XIcon aria-hidden="true" />
        </Button>

        <Separator
          orientation="vertical"
          className="my-auto mr-4 ml-2 h-4 shrink-0"
        />

        <div className="flex min-w-0 flex-col">
          <h1 className="text-foreground truncate text-sm leading-5 font-medium sm:text-base">
            Invite Member
          </h1>
          <span className="text-muted-foreground hidden truncate text-xs sm:block">
            Enterprise access request
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className="hidden md:inline-flex"
          onClick={onFeedback}
        >
          <MessageSquareTextIcon data-icon="inline-start" aria-hidden="true" />
          Feedback
        </Button>
        <Button
          type="button"
          variant="outline"
          className="hidden sm:inline-flex"
          onClick={onSaveDraft}
        >
          <SaveIcon data-icon="inline-start" aria-hidden="true" />
          Save Draft
        </Button>
        <Button type="submit" form={formId} disabled={!canSendInvite}>
          <SendIcon data-icon="inline-start" aria-hidden="true" />
          Send Invite
        </Button>
      </div>
    </header>
  )
}

function InsetSeparator() {
  return (
    <div className="px-5 sm:px-6">
      <Separator className="border-t border-dashed bg-transparent" />
    </div>
  )
}

function FormHint({ label, children }: { label: string; children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label={label}
          />
        }
      >
        <InfoIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60 text-xs leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  )
}

function FormRow({
  title,
  description,
  hint,
  htmlFor,
  align = "center",
  children,
}: {
  title: string
  description: string
  hint?: string
  htmlFor?: string
  align?: "center" | "start"
  children: ReactNode
}) {
  return (
    <Field
      className={cn(
        "grid gap-3 px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]",
        align === "start" ? "md:items-start" : "md:items-center"
      )}
    >
      <FieldContent className="gap-0.5 md:pt-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {htmlFor ? (
            <FieldLabel htmlFor={htmlFor}>{title}</FieldLabel>
          ) : (
            <FieldTitle>{title}</FieldTitle>
          )}
          {hint ? <FormHint label={`${title} hint`}>{hint}</FormHint> : null}
        </div>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <div className="min-w-0">{children}</div>
    </Field>
  )
}

function InviteeCombobox({
  invitees,
  onInviteesChange,
}: {
  invitees: Invitee[]
  onInviteesChange: (invitees: Invitee[]) => void
}) {
  const anchor = useComboboxAnchor()

  return (
    <Combobox
      multiple
      items={INVITEES}
      itemToStringValue={(invitee: Invitee) => invitee.email}
      value={invitees}
      onValueChange={onInviteesChange}
    >
      <ComboboxChips
        ref={anchor}
        className="min-h-10 has-data-[slot=combobox-chip]:pl-1"
      >
        <ComboboxValue>
          {(selectedInvitees: Invitee[]) => (
            <Fragment>
              {selectedInvitees.map((invitee) => (
                <ComboboxChip key={invitee.id} className="gap-1.5">
                  {invitee.email}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                id="form-9-member-emails"
                placeholder="Add email"
              />
            </Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent
        anchor={anchor}
        className="max-w-(--anchor-width) min-w-(--anchor-width)"
      >
        <ComboboxEmpty>No matching team members.</ComboboxEmpty>
        <ComboboxList>
          {(invitee: Invitee) => (
            <ComboboxItem key={invitee.id} value={invitee}>
              <span className="flex min-w-0 flex-col items-start gap-0.5">
                <span className="truncate text-sm font-medium">
                  {invitee.email}
                </span>
                <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1.5 text-xs">
                  <span className="truncate">{invitee.name}</span>
                  <span
                    className="inline-flex size-1 shrink-0 rounded-full bg-gray-400"
                    aria-hidden="true"
                  />
                  <span className="truncate">{invitee.department}</span>
                </span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function WorkspaceSelect({
  value,
  onValueChange,
}: {
  value: WorkspaceOption
  onValueChange: (value: WorkspaceOption) => void
}) {
  return (
    <Select
      value={value}
      onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}
      items={WORKSPACE_OPTIONS}
    >
      <SelectTrigger id="form-9-workspace" className="w-full [&_small]:hidden">
        <SelectValue>{(item: WorkspaceOption) => item?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {WORKSPACE_OPTIONS.map((workspace) => (
            <SelectItem key={workspace.value} value={workspace}>
              <span className="flex min-w-0 flex-col items-start gap-px">
                <span className="font-medium">{workspace.label}</span>
                <small className="text-muted-foreground line-clamp-1 text-[11px] leading-3.5">
                  {workspace.description}
                </small>
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function ExpirySelect({
  value,
  onValueChange,
}: {
  value: InviteExpiryOption
  onValueChange: (value: InviteExpiryOption) => void
}) {
  return (
    <Select
      value={value}
      onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}
      items={INVITE_EXPIRY_OPTIONS}
    >
      <SelectTrigger id="form-9-expiry" className="w-full [&_small]:hidden">
        <SelectValue>{(item: InviteExpiryOption) => item?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {INVITE_EXPIRY_OPTIONS.map((expiry) => (
            <SelectItem
              key={expiry.value}
              value={expiry}
              className="items-start"
            >
              <span className="flex max-w-[min(18rem,calc(100vw-4rem))] min-w-0 flex-col items-start gap-px pr-5 whitespace-normal">
                <span className="font-medium">{expiry.label}</span>
                <small className="text-muted-foreground line-clamp-2 text-xs leading-4 whitespace-normal">
                  {expiry.description}
                </small>
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function EnterpriseSwitch({
  id,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  id: string
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Field orientation="horizontal" className="items-center gap-3 py-1.5">
      <FieldContent className="min-w-0 gap-0.5">
        <FieldLabel htmlFor={id}>{title}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </Field>
  )
}

function MemberTypeField({
  value,
  onValueChange,
}: {
  value: MemberTypeOption["value"]
  onValueChange: (value: MemberTypeOption["value"]) => void
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(nextValue) =>
        onValueChange(nextValue as MemberTypeOption["value"])
      }
      className="grid gap-2"
    >
      {MEMBER_TYPE_OPTIONS.map((option) => (
        <Field
          key={option.value}
          orientation="horizontal"
          className="items-start gap-2.5 py-1.5"
        >
          <RadioGroupItem
            id={`form-9-member-type-${option.value}`}
            value={option.value}
          />
          <FieldContent className="min-w-0 gap-0.5">
            <FieldLabel htmlFor={`form-9-member-type-${option.value}`}>
              {option.label}
            </FieldLabel>
            <FieldDescription>{option.description}</FieldDescription>
          </FieldContent>
        </Field>
      ))}
    </RadioGroup>
  )
}

export function EnterpriseMemberInvite() {
  const [invitees, setInvitees] = useState<Invitee[]>(DEFAULT_INVITEES)
  const [workspace, setWorkspace] = useState<WorkspaceOption>(
    WORKSPACE_OPTIONS[0]
  )
  const [expiry, setExpiry] = useState<InviteExpiryOption>(
    INVITE_EXPIRY_OPTIONS[1]
  )
  const [memberType, setMemberType] =
    useState<MemberTypeOption["value"]>("employee")
  const [requireSso, setRequireSso] = useState(true)
  const [notifyManager, setNotifyManager] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(
    DEFAULT_SELECTED_ROLE_IDS
  )

  const selectedRoleIdSet = useMemo(
    () => new Set(selectedRoleIds),
    [selectedRoleIds]
  )
  const filteredRoleGroups = useMemo(
    () => filterRoleGroups(searchQuery),
    [searchQuery]
  )
  const searchActive = searchQuery.trim().length > 0
  const canSendInvite = invitees.length > 0 && selectedRoleIds.length > 0
  const selectedRoleLabel =
    selectedRoleIds.length === 1
      ? "1 selected role"
      : `${selectedRoleIds.length} selected roles`
  const inviteeLabel =
    invitees.length === 1 ? "1 member" : `${invitees.length} members`

  function handleRoleChange(roleId: string, checked: boolean) {
    setSelectedRoleIds((currentRoleIds) => {
      if (checked) {
        return currentRoleIds.includes(roleId)
          ? currentRoleIds
          : [...currentRoleIds, roleId]
      }

      return currentRoleIds.filter((currentRoleId) => currentRoleId !== roleId)
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSendInvite) {
      return
    }

    showMemberInviteToast(
      "Invite ready",
      `${inviteeLabel} will receive ${selectedRoleLabel} for ${workspace.label}.`
    )
  }

  return (
    <TooltipProvider delay={180}>
      <div className="bg-background flex min-h-svh w-full flex-col">
        <InviteToolbar
          formId={FORM_ID}
          canSendInvite={canSendInvite}
          onClose={() =>
            showMemberInviteToast(
              "Invite editor closed",
              "No member invites were sent from this demo form.",
              "info"
            )
          }
          onFeedback={() =>
            showMemberInviteToast(
              "Feedback panel opened",
              "Access notes are ready before sending this invite.",
              "info"
            )
          }
          onSaveDraft={() =>
            showMemberInviteToast(
              "Invite draft saved",
              "Recipients, access settings, and role selections were stored locally."
            )
          }
        />

        <main className="flex flex-1 justify-center px-4 py-7 sm:px-8 sm:py-9">
          <form
            id={FORM_ID}
            onSubmit={handleSubmit}
            className="w-full max-w-3xl"
          >
            <Card className="gap-0 p-0">
              <CardHeader className="gap-1 px-5 py-4 sm:px-6">
                <CardTitle>Member Access</CardTitle>
                <CardDescription>
                  Add people and assign scoped workspace roles.
                </CardDescription>
                <CardAction className="self-center">
                  <Badge variant="success-light">
                    <ShieldCheckIcon aria-hidden="true" />
                    Policy Checked
                  </Badge>
                </CardAction>
              </CardHeader>

              <InsetSeparator />

              <CardContent className="p-0">
                <FieldSet className="gap-0">
                  <FieldLegend className="sr-only">
                    Enterprise member invitation form
                  </FieldLegend>
                  <FieldDescription className="sr-only">
                    Add team members with managed identity, workspace routing,
                    and granular role assignments.
                  </FieldDescription>

                  <FieldGroup className="gap-0">
                    <FormRow
                      title="Recipients"
                      description="Directory email addresses."
                      hint="Invites can include multiple directory users; each address becomes one pending member."
                      htmlFor="form-9-member-emails"
                      align="start"
                    >
                      <InviteeCombobox
                        invitees={invitees}
                        onInviteesChange={setInvitees}
                      />
                    </FormRow>

                    <InsetSeparator />

                    <FormRow
                      title="Workspace"
                      description="Workspace and expiry window."
                      hint="Workspace and expiry define where access lands and when the invite link stops working."
                      align="start"
                    >
                      <FieldGroup className="grid gap-3 sm:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor="form-9-workspace">
                            Workspace
                          </FieldLabel>
                          <WorkspaceSelect
                            value={workspace}
                            onValueChange={setWorkspace}
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="form-9-expiry">
                            Invite Expires
                          </FieldLabel>
                          <ExpirySelect
                            value={expiry}
                            onValueChange={setExpiry}
                          />
                        </Field>
                      </FieldGroup>
                    </FormRow>

                    <InsetSeparator />

                    <FormRow
                      title="Member Type"
                      description="How the account is governed."
                      align="start"
                    >
                      <MemberTypeField
                        value={memberType}
                        onValueChange={setMemberType}
                      />
                    </FormRow>

                    <InsetSeparator />

                    <FormRow
                      title="Guardrails"
                      description="Sign-in and access-owner notice."
                      hint="Use these controls for high-trust workspaces that require managed login and owner visibility."
                      align="start"
                    >
                      <FieldGroup className="gap-2">
                        <EnterpriseSwitch
                          id="form-9-require-sso"
                          title="Require SSO"
                          description="Block password login."
                          checked={requireSso}
                          onCheckedChange={setRequireSso}
                        />
                        <EnterpriseSwitch
                          id="form-9-notify-manager"
                          title="Notify Manager"
                          description="Copy the access owner."
                          checked={notifyManager}
                          onCheckedChange={setNotifyManager}
                        />
                      </FieldGroup>
                    </FormRow>

                    <InsetSeparator />

                    <FormRow
                      title="Find Roles"
                      description="Function or risk hint."
                      htmlFor="form-9-role-search"
                      align="start"
                    >
                      <InputGroup>
                        <InputGroupAddon>
                          <InputGroupText>
                            <SearchIcon className="text-muted-foreground size-4" aria-hidden="true" />
                          </InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                          id="form-9-role-search"
                          value={searchQuery}
                          onChange={(event) =>
                            setSearchQuery(event.target.value)
                          }
                          placeholder="Search roles..."
                        />
                      </InputGroup>
                    </FormRow>

                    <InsetSeparator />

                    <FormRow
                      title="Permissions"
                      description="Choose minimum access."
                      hint="Start with the smallest role set; privileged badges mark access that should be reviewed."
                      align="start"
                    >
                      <Card className="gap-0 overflow-hidden p-0">
                        <div className="bg-muted/30 flex items-center justify-between gap-3 border-b px-3 py-1.5">
                          <div className="flex min-w-0 flex-col">
                            <span className="text-sm font-medium">
                              Role groups
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {filteredRoleGroups.length} groups available
                            </span>
                          </div>
                          <Badge variant="outline">{selectedRoleLabel}</Badge>
                        </div>
                        {filteredRoleGroups.length ? (
                          <RoleTree
                            key={
                              searchActive ? `search-${searchQuery}` : "browse"
                            }
                            groups={filteredRoleGroups}
                            expandedGroupIds={
                              searchActive
                                ? filteredRoleGroups.map((group) => group.id)
                                : getDefaultOpenGroupIds()
                            }
                            selectedRoleIds={selectedRoleIdSet}
                            onRoleChange={handleRoleChange}
                          />
                        ) : (
                          <Empty className="min-h-52 p-6">
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <SearchXIcon aria-hidden="true" />
                              </EmptyMedia>
                              <EmptyTitle>No Roles Found</EmptyTitle>
                              <EmptyDescription>
                                Try admin, finance, identity, or support.
                              </EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        )}
                      </Card>
                    </FormRow>

                    <InsetSeparator />

                    <FormRow
                      title="Internal Note"
                      description="Optional internal context."
                      hint="Stored for admins only and not shown in the invite email."
                      htmlFor="form-9-internal-note"
                      align="start"
                    >
                      <Textarea
                        id="form-9-internal-note"
                        defaultValue="Q2 onboarding batch. Confirm privileged role requests after SSO enrollment."
                      />
                    </FormRow>
                  </FieldGroup>
                </FieldSet>
              </CardContent>
            </Card>
          </form>
        </main>
      </div>
    </TooltipProvider>
  )
}