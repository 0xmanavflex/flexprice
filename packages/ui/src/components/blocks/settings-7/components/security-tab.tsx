// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import { Fragment, useState } from "react"
import { Badge } from "@ui/components/reui/badge"

import { Button } from "@ui/components/primitives/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@ui/components/primitives/field"
import { Input } from "@ui/components/primitives/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@ui/components/primitives/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@ui/components/primitives/item"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/components/primitives/select"
import { Switch } from "@ui/components/primitives/switch"
import { RECOVERY_METHODS, SESSIONS } from "./data"
import { SettingRow } from "./setting-row"
import { SettingsCard } from "./settings-card"
import { SettingsFieldGroup } from "./settings-field-group"
import { createSelectValueHandler, getOptionLabel } from "./utils"
import { LogOutIcon } from "lucide-react"

export function SecurityTab() {
  const [recoveryMethod, setRecoveryMethod] = useState("authenticator")
  const handleRecoveryMethodChange = createSelectValueHandler(setRecoveryMethod)

  return (
    <div className="space-y-6">
      {/* Card */}
      <SettingsCard
        title="Change password"
        description="Access protection"
        footer={<Button>Update password</Button>}
      >
        <SettingsFieldGroup
          legend="Password settings"
          description="Update your password and keep your account protected."
        >
          <SettingRow
            title="Current password"
            description="Verify your identity before making changes."
            labelFor="settings-7-current-password"
          >
            <Input
              id="settings-7-current-password"
              type="password"
              placeholder="Enter current password"
            />
          </SettingRow>

          <SettingRow
            title="New password"
            description="Use at least 12 characters and a unique phrase."
            contentClassName="@md/field-group:w-[22rem]"
            last
          >
            <FieldSet className="w-full gap-3">
              <FieldLegend className="sr-only">New password</FieldLegend>
              <FieldDescription className="sr-only">
                Create and confirm the next password for this account.
              </FieldDescription>

              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="settings-7-new-password">
                    New password
                  </FieldLabel>
                  <Input
                    id="settings-7-new-password"
                    type="password"
                    placeholder="Create a new password"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="settings-7-confirm-password">
                    Confirm password
                  </FieldLabel>
                  <Input
                    id="settings-7-confirm-password"
                    type="password"
                    placeholder="Confirm the new password"
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
          </SettingRow>
        </SettingsFieldGroup>
      </SettingsCard>

      <SettingsCard
        title="Two-step verification"
        description="Extra sign-in checks"
      >
        <SettingsFieldGroup
          legend="Two-step verification"
          description="Add backup checks for future sign-ins."
        >
          <SettingRow
            title="Authenticator app"
            description="Use one-time codes from an app."
            labelFor="settings-7-authenticator-app"
            titleAddon={
              <Badge variant="info-light" size="sm">
                Recommended
              </Badge>
            }
          >
            <Switch id="settings-7-authenticator-app" defaultChecked />
          </SettingRow>

          <SettingRow
            title="Recovery phone"
            description="Used if you lose access to your authenticator app."
            labelFor="settings-7-recovery-phone"
          >
            <InputGroup className="w-full">
              <InputGroupAddon align="inline-start">
                <InputGroupText>+1</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="settings-7-recovery-phone"
                defaultValue="415 555 0148"
              />
            </InputGroup>
          </SettingRow>

          <SettingRow
            title="Delivery method"
            description="Choose how backup verification requests are delivered."
            labelFor="settings-7-recovery-method"
          >
            <Select
              value={recoveryMethod}
              onValueChange={handleRecoveryMethodChange}
            >
              <SelectTrigger id="settings-7-recovery-method" className="w-full">
                <SelectValue>
                  {getOptionLabel(RECOVERY_METHODS, recoveryMethod)}
                </SelectValue>
              </SelectTrigger>

              <SelectContent>
                <SelectGroup>
                  {RECOVERY_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow
            title="Trusted devices"
            description="Skip repeat prompts on known devices."
            labelFor="settings-7-trusted-devices"
            last
          >
            <Switch id="settings-7-trusted-devices" defaultChecked />
          </SettingRow>
        </SettingsFieldGroup>
      </SettingsCard>

      <SettingsCard title="Active sessions" description="Signed-in devices">
        <ItemGroup className="gap-0">
          {SESSIONS.map((session, index) => (
            <Fragment key={session.id}>
              {index > 0 ? <ItemSeparator className="my-0" /> : null}
              <Item className="min-h-0 items-center gap-4 px-5 py-3.5">
                <ItemMedia className="self-center!">
                  <Item className="bg-muted/60 border-background flex size-8 shrink-0 items-center justify-center border-2 p-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.14)] [&_svg]:size-4 [&_svg]:opacity-60">
                    {session.icon}
                  </Item>
                </ItemMedia>

                <ItemContent className="min-w-0 justify-center gap-0.5 self-center">
                  <ItemTitle className="gap-2 leading-5">
                    {session.browser} on {session.device}
                    {session.current ? (
                      <Badge variant="success-light" size="xs">
                        Current
                      </Badge>
                    ) : null}
                  </ItemTitle>
                  <ItemDescription className="leading-5">
                    {session.location} · {session.lastActive}
                  </ItemDescription>
                </ItemContent>

                <ItemActions className="w-28 shrink-0 justify-end self-center">
                  {session.current ? (
                    <Button variant="outline" size="sm">
                      This device
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm">
                      <LogOutIcon data-icon="inline-start" aria-hidden="true" />
                      Revoke
                    </Button>
                  )}
                </ItemActions>
              </Item>
            </Fragment>
          ))}
        </ItemGroup>
      </SettingsCard>

      <SettingsCard title="Delete account" description="Irreversible changes">
        <SettingsFieldGroup
          legend="Delete account"
          description="Review irreversible actions before deleting your account."
        >
          <SettingRow
            title="Close account"
            description="Permanently remove your account, sessions, and recovery settings."
            last
            contentClassName="@md/field-group:w-[22rem]"
          >
            <div className="flex w-full flex-col items-start gap-2 @md/field-group:items-end">
              <p className="text-muted-foreground text-xs leading-5">
                This action cannot be undone.
              </p>
              <Button variant="destructive">Delete account</Button>
            </div>
          </SettingRow>
        </SettingsFieldGroup>
      </SettingsCard>
    </div>
  )
}