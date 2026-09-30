// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { useState } from "react"
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/components/primitives/select"

import { BILLING_PLANS, COUNTRIES } from "./data"
import { SettingRow } from "./setting-row"
import { SettingsCard } from "./settings-card"
import { SettingsFieldGroup } from "./settings-field-group"
import { createSelectValueHandler, getOptionLabel } from "./utils"

export function BillingTab() {
  const [country, setCountry] = useState("us")
  const handleCountryChange = createSelectValueHandler(setCountry)

  return (
    <div className="space-y-6">
      {/* Card */}
      <SettingsCard title="Plan and billing" description="Current subscription">
        <SettingsFieldGroup
          legend="Plan and billing"
          description="Review your current subscription and plan options."
        >
          {BILLING_PLANS.map((plan, index) => (
            <SettingRow
              key={plan.id}
              title={plan.name}
              titleAddon={
                plan.current ? (
                  <Badge variant="info-light" size="sm">
                    Current
                  </Badge>
                ) : null
              }
              description={
                <>
                  <span className="text-foreground font-medium">
                    {plan.price}
                  </span>{" "}
                  / {plan.period} · {plan.features.join(", ")}
                </>
              }
              last={index === BILLING_PLANS.length - 1}
            >
              <Button variant={plan.current ? "outline" : "ghost"} size="sm">
                {plan.current ? "Manage" : "Switch"}
              </Button>
            </SettingRow>
          ))}
        </SettingsFieldGroup>
      </SettingsCard>

      <SettingsCard
        title="Billing details"
        description="Invoices and payments"
        footer={<Button>Update billing</Button>}
      >
        <SettingsFieldGroup
          legend="Billing details"
          description="Manage invoice contacts and payment details."
        >
          <SettingRow
            title="Billing email"
            description="Receives invoices and renewal notices."
            labelFor="settings-7-billing-email"
          >
            <Input
              id="settings-7-billing-email"
              defaultValue="billing@acme.dev"
              type="email"
            />
          </SettingRow>

          <SettingRow
            title="Invoice profile"
            description="Business details used on receipts and tax forms."
            contentClassName="@md/field-group:w-[22rem]"
          >
            <FieldSet className="w-full gap-3">
              <FieldLegend className="sr-only">Invoice profile</FieldLegend>
              <FieldDescription className="sr-only">
                Company identity used for invoices and tax documents.
              </FieldDescription>

              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="settings-7-company-name">
                    Company name
                  </FieldLabel>
                  <Input
                    id="settings-7-company-name"
                    defaultValue="Acme Labs"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="settings-7-billing-country">
                    Country
                  </FieldLabel>
                  <Select value={country} onValueChange={handleCountryChange}>
                    <SelectTrigger
                      id="settings-7-billing-country"
                      className="w-full"
                    >
                      <SelectValue>
                        {getOptionLabel(COUNTRIES, country)}
                      </SelectValue>
                    </SelectTrigger>

                    <SelectContent>
                      <SelectGroup>
                        {COUNTRIES.map((item) => (
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
            title="Tax ID"
            description="Optional number used for VAT or company invoices."
            labelFor="settings-7-tax-id"
          >
            <InputGroup className="w-full">
              <InputGroupAddon align="inline-start">
                <InputGroupText>VAT</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="settings-7-tax-id"
                defaultValue="US-2048-ACME"
              />
            </InputGroup>
          </SettingRow>

          <SettingRow
            title="Card on file"
            description="Used for monthly renewals."
            last
          >
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-muted-foreground text-sm">
                Visa ending in 4242
              </span>
              <Button variant="outline">Update</Button>
            </div>
          </SettingRow>
        </SettingsFieldGroup>
      </SettingsCard>
    </div>
  )
}