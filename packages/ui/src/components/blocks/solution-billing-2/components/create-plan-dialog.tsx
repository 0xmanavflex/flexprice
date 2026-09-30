"use client"

import { AlertCircleIcon, CircleCheckIcon, PlusIcon } from "lucide-react"
import * as React from "react"
import type { ReactNode } from "react"
import { toast } from "sonner"

import { Button } from "@ui/primitives/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/primitives/dialog"
import { Field, FieldGroup, FieldLabel } from "@ui/primitives/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@ui/primitives/input-group"
import { Tabs, TabsList, TabsTrigger } from "@ui/primitives/tabs"

import { intervalOptions, type BillingInterval } from "./data"

// ── Toast helpers (dialog-12 grammar) ──

function getSuccessIcon() {
  return (
    <CircleCheckIcon
      className="text-success mt-0.5 size-4 shrink-0"
      aria-hidden="true"
    />
  )
}

function getErrorIcon() {
  return (
    <AlertCircleIcon
      className="text-destructive mt-0.5 size-4 shrink-0"
      aria-hidden="true"
    />
  )
}

function ToastTitle({ icon, children }: { icon: ReactNode; children: string }) {
  return (
    <span className="flex items-start gap-2">
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

interface CreatePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreatePlanDialog({
  open,
  onOpenChange,
}: CreatePlanDialogProps) {
  const [name, setName] = React.useState("")
  const [price, setPrice] = React.useState("")
  const [interval, setInterval] = React.useState<BillingInterval>("monthly")

  const canCreate = name.trim().length > 0 && price.trim().length > 0

  function handleCreate() {
    if (!canCreate) {
      toast.error(
        <ToastTitle icon={getErrorIcon()}>Add a name and price</ToastTitle>,
        {
          description: (
            <ToastDescription>
              A new plan needs a name and a price before it can be saved.
            </ToastDescription>
          ),
          icon: null,
        }
      )
      return
    }

    const intervalLabel = interval === "monthly" ? "month" : "year"
    toast.success(
      <ToastTitle
        icon={getSuccessIcon()}
      >{`${name.trim()} drafted`}</ToastTitle>,
      {
        description: (
          <ToastDescription>{`Saved as a draft at $${price.trim()} per seat per ${intervalLabel}. Publish to list it.`}</ToastDescription>
        ),
        icon: null,
      }
    )
    setName("")
    setPrice("")
    setInterval("monthly")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Plan</DialogTitle>
          <DialogDescription>
            New plans save as a draft until you publish them.
          </DialogDescription>
        </DialogHeader>

        <form
          id="solution-billing-2-create-plan-form"
          className="grid gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            handleCreate()
          }}
        >
          <FieldGroup className="gap-4">
            <Field className="gap-2">
              <FieldLabel htmlFor="create-plan-name">Plan name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="create-plan-name"
                  value={name}
                  placeholder="Pro"
                  onChange={(event) => setName(event.target.value)}
                />
              </InputGroup>
            </Field>

            <Field className="gap-2">
              <FieldLabel htmlFor="create-plan-price">
                Price per seat
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText className="text-muted-foreground">
                    $
                  </InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="create-plan-price"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={price}
                  placeholder="49"
                  onChange={(event) => setPrice(event.target.value)}
                />
              </InputGroup>
            </Field>

            <Field className="gap-2">
              <FieldLabel>Billing interval</FieldLabel>
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
          </FieldGroup>
        </form>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="solution-billing-2-create-plan-form"
            disabled={!canCreate}
          >
            <PlusIcon
              data-icon="inline-start"
              aria-hidden="true"
            />
            Create plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}