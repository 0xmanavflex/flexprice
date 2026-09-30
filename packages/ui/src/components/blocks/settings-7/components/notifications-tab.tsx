// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { useState } from "react"

import { Button } from "@ui/components/primitives/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@ui/components/primitives/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/components/primitives/select"
import { Switch } from "@ui/components/primitives/switch"

import { DIGEST_CADENCE, QUIET_HOURS, QUIET_HOURS_END, TIMEOUTS } from "./data"
import { SettingRow } from "./setting-row"
import { SettingsCard } from "./settings-card"
import { SettingsFieldGroup } from "./settings-field-group"
import { createSelectValueHandler, getOptionLabel } from "./utils"

export function NotificationsTab() {
  const [autoDismiss, setAutoDismiss] = useState("10")
  const [quietStart, setQuietStart] = useState("20:00")
  const [quietEnd, setQuietEnd] = useState("08:00")
  const [digestCadence, setDigestCadence] = useState("weekly")
  const handleAutoDismissChange = createSelectValueHandler(setAutoDismiss)
  const handleQuietStartChange = createSelectValueHandler(setQuietStart)
  const handleQuietEndChange = createSelectValueHandler(setQuietEnd)
  const handleDigestCadenceChange = createSelectValueHandler(setDigestCadence)

  return (
    <div className="space-y-6">
      {/* Card */}
      <SettingsCard title="Activity alerts" description="Desktop and badge">
        <SettingsFieldGroup
          legend="Activity alerts"
          description="Control desktop, badge, and sound alerts."
        >
          <SettingRow
            title="Desktop notifications"
            description="Show alerts for mentions and approvals."
            labelFor="settings-7-desktop-notifications"
          >
            <Switch id="settings-7-desktop-notifications" defaultChecked />
          </SettingRow>

          <SettingRow
            title="Quiet hours"
            description="Hold non-urgent alerts outside your workday."
            contentClassName="@md/field-group:w-[22rem]"
          >
            <FieldSet className="w-full gap-3">
              <FieldLegend className="sr-only">Quiet hours</FieldLegend>
              <FieldDescription className="sr-only">
                Define when non-urgent activity should stay muted.
              </FieldDescription>

              <FieldGroup className="gap-3 sm:grid sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="settings-7-quiet-start">
                    Start
                  </FieldLabel>
                  <Select
                    value={quietStart}
                    onValueChange={handleQuietStartChange}
                  >
                    <SelectTrigger
                      id="settings-7-quiet-start"
                      className="w-full"
                    >
                      <SelectValue>
                        {getOptionLabel(QUIET_HOURS, quietStart)}
                      </SelectValue>
                    </SelectTrigger>

                    <SelectContent>
                      <SelectGroup>
                        {QUIET_HOURS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="settings-7-quiet-end">End</FieldLabel>
                  <Select value={quietEnd} onValueChange={handleQuietEndChange}>
                    <SelectTrigger id="settings-7-quiet-end" className="w-full">
                      <SelectValue>
                        {getOptionLabel(QUIET_HOURS_END, quietEnd)}
                      </SelectValue>
                    </SelectTrigger>

                    <SelectContent>
                      <SelectGroup>
                        {QUIET_HOURS_END.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
            </FieldSet>
          </SettingRow>

          <SettingRow
            title="Unread badge"
            description="Display a badge when new activity arrives."
            labelFor="settings-7-unread-badge"
          >
            <Switch id="settings-7-unread-badge" defaultChecked />
          </SettingRow>

          <SettingRow
            title="Auto dismiss"
            description="Choose how long alerts stay visible."
            labelFor="settings-7-auto-dismiss"
            last
          >
            <Select value={autoDismiss} onValueChange={handleAutoDismissChange}>
              <SelectTrigger id="settings-7-auto-dismiss" className="w-full">
                <SelectValue>
                  {getOptionLabel(TIMEOUTS, autoDismiss)}
                </SelectValue>
              </SelectTrigger>

              <SelectContent>
                <SelectGroup>
                  {TIMEOUTS.map((timeout) => (
                    <SelectItem key={timeout.value} value={timeout.value}>
                      {timeout.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>
        </SettingsFieldGroup>
      </SettingsCard>

      <SettingsCard
        title="Email updates"
        description="Inbox preferences"
        footer={
          <>
            <Button variant="outline">Reset</Button>
            <Button>Save preferences</Button>
          </>
        }
      >
        <SettingsFieldGroup
          legend="Email updates"
          description="Control which emails reach your inbox."
        >
          <SettingRow
            title="Team communication"
            description="Messages, approvals, and activity summaries."
            labelFor="settings-7-team-communication"
          >
            <Switch id="settings-7-team-communication" defaultChecked />
          </SettingRow>

          <SettingRow
            title="Product announcements"
            description="Releases, improvements, and launches."
            labelFor="settings-7-product-announcements"
          >
            <Switch id="settings-7-product-announcements" />
          </SettingRow>

          <SettingRow
            title="Weekly digest"
            description="A recap of workspaces, mentions, and tasks."
            labelFor="settings-7-weekly-digest"
          >
            <Switch id="settings-7-weekly-digest" defaultChecked />
          </SettingRow>

          <SettingRow
            title="Digest cadence"
            description="Set how often summary emails arrive."
            labelFor="settings-7-digest-cadence"
            last
          >
            <Select
              value={digestCadence}
              onValueChange={handleDigestCadenceChange}
            >
              <SelectTrigger id="settings-7-digest-cadence" className="w-full">
                <SelectValue>
                  {getOptionLabel(DIGEST_CADENCE, digestCadence)}
                </SelectValue>
              </SelectTrigger>

              <SelectContent>
                <SelectGroup>
                  {DIGEST_CADENCE.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingRow>
        </SettingsFieldGroup>
      </SettingsCard>
    </div>
  )
}