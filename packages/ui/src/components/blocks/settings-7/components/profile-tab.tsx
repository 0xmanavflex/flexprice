// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { useState } from "react"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@ui/components/reui/alert"
import { Badge } from "@ui/components/reui/badge"

import { Button } from "@ui/primitives/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@ui/primitives/field"
import { Input } from "@ui/primitives/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@ui/primitives/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/primitives/select"
import { Textarea } from "@ui/primitives/textarea"
import { ROLES, TIMEZONES } from "./data"
import { ProfileAvatarUpload } from "./profile-avatar-upload"
import { SettingRow } from "./setting-row"
import { SettingsCard } from "./settings-card"
import { SettingsFieldGroup } from "./settings-field-group"
import { createSelectValueHandler, getOptionLabel } from "./utils"
import { UserIcon } from "lucide-react"

export function ProfileTab() {
  const [role, setRole] = useState("engineering-lead")
  const [timezone, setTimezone] = useState("utc-8")
  const handleRoleChange = createSelectValueHandler(setRole)
  const handleTimezoneChange = createSelectValueHandler(setTimezone)

  return (
    <div className="space-y-6">
      <Alert variant="warning">
        <UserIcon aria-hidden="true" />
        <AlertTitle>Complete your profile.</AlertTitle>
        <AlertDescription>
          Add a photo and keep your role and timezone current.
        </AlertDescription>
        <AlertAction>
          <Button type="button" variant="outline" size="xs">
            Dismiss
          </Button>
          <Button type="button" size="xs">
            Update
          </Button>
        </AlertAction>
      </Alert>

      {/* Card */}
      <SettingsCard
        title="My profile"
        description="Public account details"
        footer={
          <>
            <Button variant="outline">Cancel</Button>
            <Button>Save changes</Button>
          </>
        }
      >
        <SettingsFieldGroup
          legend="Profile fields"
          description="Update your personal profile details."
        >
          <SettingRow
            title="Photo"
            description="Shown in comments and mentions."
          >
            <ProfileAvatarUpload
              defaultAvatar="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80"
              alt="Alex Morgan"
              inputId="settings-7-profile-photo"
            />
          </SettingRow>

          <SettingRow
            title="Full name"
            description="Used across the workspace."
            labelFor="settings-7-full-name"
          >
            <Input id="settings-7-full-name" defaultValue="Alex Morgan" />
          </SettingRow>

          <SettingRow
            title="Email address"
            description="Primary sign-in email."
            labelFor="settings-7-email"
            titleAddon={<Badge variant="success-light">Verified</Badge>}
          >
            <Input
              id="settings-7-email"
              defaultValue="alex@acme.dev"
              type="email"
            />
          </SettingRow>

          <SettingRow
            title="Username"
            description="Visible in mentions and links."
            labelFor="settings-7-username"
          >
            <InputGroup className="w-full">
              <InputGroupAddon align="inline-start">
                <InputGroupText>@</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="settings-7-username"
                defaultValue="alexmorgan"
              />
            </InputGroup>
          </SettingRow>

          <SettingRow
            title="Profile details"
            description="Public details shared across the workspace."
            contentClassName="@md/field-group:w-[22rem]"
          >
            <FieldSet className="w-full gap-3">
              <FieldLegend className="sr-only">Profile details</FieldLegend>
              <FieldDescription className="sr-only">
                Public profile and workspace defaults.
              </FieldDescription>

              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="settings-7-role">Role</FieldLabel>
                  <Select value={role} onValueChange={handleRoleChange}>
                    <SelectTrigger id="settings-7-role" className="w-full">
                      <SelectValue>{getOptionLabel(ROLES, role)}</SelectValue>
                    </SelectTrigger>

                    <SelectContent>
                      <SelectGroup>
                        {ROLES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="settings-7-timezone">
                    Time zone
                  </FieldLabel>
                  <Select value={timezone} onValueChange={handleTimezoneChange}>
                    <SelectTrigger id="settings-7-timezone" className="w-full">
                      <SelectValue>
                        {getOptionLabel(TIMEZONES, timezone)}
                      </SelectValue>
                    </SelectTrigger>

                    <SelectContent>
                      <SelectGroup>
                        {TIMEZONES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="settings-7-website">Website</FieldLabel>
                  <InputGroup className="w-full">
                    <InputGroupAddon align="inline-start">
                      <InputGroupText>https://</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="settings-7-website"
                      defaultValue="alexmorgan.dev"
                    />
                  </InputGroup>
                </Field>
              </FieldGroup>
            </FieldSet>
          </SettingRow>

          <SettingRow
            title="Bio"
            description="Short profile summary."
            labelFor="settings-7-bio"
            last
          >
            <Textarea
              id="settings-7-bio"
              defaultValue="Building developer tools at Acme. Previously at Vercel and Stripe."
              rows={4}
              className="min-h-24 resize-none"
            />
          </SettingRow>
        </SettingsFieldGroup>
      </SettingsCard>
    </div>
  )
}