"use client"

import { SaveIcon } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

import { Button } from "@ui/primitives/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/primitives/dialog"
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@ui/primitives/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@ui/primitives/input-group"
import { Switch } from "@ui/primitives/switch"
import { Tabs, TabsList, TabsTrigger } from "@ui/primitives/tabs"

import { intervalOptions, type BillingInterval } from "./data"

export interface EditablePlanDetails {
  name: string
  monthlyPrice: number
  annualPrice: number
  perSeat: boolean
  interval: BillingInterval
}

interface EditPlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  details: EditablePlanDetails
  onSave: (details: EditablePlanDetails) => void
}

function getPriceValue(value: number) {
  return Number.isFinite(value) ? String(value) : ""
}

export function EditPlanDialog({
  open,
  onOpenChange,
  planId,
  details,
  onSave,
}: EditPlanDialogProps) {
  const formId = React.useId()
  const [name, setName] = React.useState(details.name)
  const [monthlyPrice, setMonthlyPrice] = React.useState(
    getPriceValue(details.monthlyPrice)
  )
  const [annualPrice, setAnnualPrice] = React.useState(
    getPriceValue(details.annualPrice)
  )
  const [perSeat, setPerSeat] = React.useState(details.perSeat)
  const [interval, setInterval] = React.useState<BillingInterval>(
    details.interval
  )

  React.useEffect(() => {
    if (!open) {
      return
    }

    setName(details.name)
    setMonthlyPrice(getPriceValue(details.monthlyPrice))
    setAnnualPrice(getPriceValue(details.annualPrice))
    setPerSeat(details.perSeat)
    setInterval(details.interval)
  }, [details, open])

  const canSave =
    name.trim().length > 0 &&
    monthlyPrice.trim().length > 0 &&
    annualPrice.trim().length > 0

  function handleSave() {
    const nextMonthlyPrice = Number(monthlyPrice)
    const nextAnnualPrice = Number(annualPrice)

    if (
      !canSave ||
      !Number.isFinite(nextMonthlyPrice) ||
      !Number.isFinite(nextAnnualPrice) ||
      nextMonthlyPrice < 0 ||
      nextAnnualPrice < 0
    ) {
      toast.error("Check plan details", {
        description: "Plan name, monthly price, and annual price are required.",
      })
      return
    }

    onSave({
      name: name.trim(),
      monthlyPrice: nextMonthlyPrice,
      annualPrice: nextAnnualPrice,
      perSeat,
      interval,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Plan</DialogTitle>
          <DialogDescription>
            Update pricing, billing model, and catalog display for {planId}.
          </DialogDescription>
        </DialogHeader>

        <form
          id={formId}
          className="contents"
          onSubmit={(event) => {
            event.preventDefault()
            handleSave()
          }}
        >
          <FieldGroup className="gap-4">
            <Field className="gap-2">
              <FieldLabel htmlFor={`${formId}-name`}>Plan name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id={`${formId}-name`}
                  value={name}
                  placeholder="Scale"
                  onChange={(event) => setName(event.target.value)}
                />
              </InputGroup>
            </Field>

            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field className="gap-2">
                <FieldLabel htmlFor={`${formId}-monthly-price`}>
                  Monthly price
                </FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText className="text-muted-foreground">
                      $
                    </InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id={`${formId}-monthly-price`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={monthlyPrice}
                    placeholder="249"
                    onChange={(event) => setMonthlyPrice(event.target.value)}
                  />
                </InputGroup>
              </Field>

              <Field className="gap-2">
                <FieldLabel htmlFor={`${formId}-annual-price`}>
                  Annual price
                </FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText className="text-muted-foreground">
                      $
                    </InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id={`${formId}-annual-price`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={annualPrice}
                    placeholder="2490"
                    onChange={(event) => setAnnualPrice(event.target.value)}
                  />
                </InputGroup>
              </Field>
            </FieldGroup>

            <Field className="gap-2">
              <FieldLabel>Display interval</FieldLabel>
              <Tabs
                value={interval}
                onValueChange={(value) => setInterval(value as BillingInterval)}
              >
                <TabsList>
                  {intervalOptions.map((option) => (
                    <TabsTrigger key={option.id} value={option.id}>
                      {option.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </Field>

            <Field orientation="horizontal" className="rounded-lg border p-3">
              <FieldContent className="gap-1">
                <FieldLabel htmlFor={`${formId}-per-seat`}>
                  Per seat billing
                </FieldLabel>
                <p className="text-muted-foreground text-sm">
                  Show the price as a seat based plan in the catalog.
                </p>
              </FieldContent>
              <Switch
                id={`${formId}-per-seat`}
                checked={perSeat}
                onCheckedChange={setPerSeat}
                aria-label="Toggle per seat billing"
              />
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={!canSave}>
            <SaveIcon
              data-icon="inline-start"
              aria-hidden="true"
            />
            Save details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}