// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { useState, type ReactNode } from "react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@ui/components/reui/alert"
import { Badge } from "@ui/components/reui/badge"
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@ui/components/reui/stepper"
import { cn } from "cn"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@ui/components/primitives/avatar"
import { Button } from "@ui/components/primitives/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ui/components/primitives/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@ui/components/primitives/field"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@ui/components/primitives/item"
import {
  RadioGroup,
  RadioGroupItem,
} from "@ui/components/primitives/radio-group"
import {
  DEFAULT_PLAN_CHANGE_VALUES,
  getPlan,
  getProration,
  PLAN_OPTIONS,
  SUBSCRIPTION,
  TIMING_OPTIONS,
  WIZARD_STEPS,
  type ChangeTiming,
  type PlanChangeValues,
  type PlanTierId,
  type ProrationResult,
} from "./data"
import { ArrowUpIcon, ArrowDownIcon, CircleCheckIcon, ArrowLeftIcon, CheckIcon, ArrowRightIcon } from "lucide-react"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function WizardSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby={id}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id={id} className="text-base leading-6 font-semibold">
          {title}
        </h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </section>
  )
}

function SummaryRow({
  label,
  value,
  strong,
  hint,
  labelForeground,
}: {
  label: string
  value: ReactNode
  strong?: boolean
  hint?: string
  labelForeground?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt
        className={cn(
          "flex min-w-0 flex-col gap-0.5",
          strong || labelForeground
            ? "text-foreground"
            : "text-muted-foreground"
        )}
      >
        <span>{label}</span>
        {hint ? (
          <span className="text-muted-foreground text-xs leading-4">
            {hint}
          </span>
        ) : null}
      </dt>
      <dd
        className={cn(
          "text-foreground min-w-0 text-right break-words tabular-nums",
          strong ? "text-base font-semibold" : "font-medium"
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function AmountRow({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Item
      variant="outline"
      className="border-foreground/20 bg-muted/35 flex-nowrap gap-3 border-dashed py-3"
    >
      <ItemContent className="gap-0.5">
        <ItemTitle className="text-foreground font-medium">{label}</ItemTitle>
        {hint ? (
          <ItemDescription className="line-clamp-none text-xs leading-4">
            {hint}
          </ItemDescription>
        ) : null}
      </ItemContent>
      <ItemActions>
        <span className="text-foreground min-w-0 text-right text-lg leading-6 font-semibold break-words tabular-nums">
          {value}
        </span>
      </ItemActions>
    </Item>
  )
}

function SummarySection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-sm leading-5 font-medium">{title}</h3>
      {children}
    </section>
  )
}

function ChangeStatusBadge({ confirmed }: { confirmed: boolean }) {
  const status = confirmed ? "Scheduled" : "Draft"

  return (
    <Badge
      variant={confirmed ? "success-outline" : "warning-outline"}
      className="bg-background gap-1.5"
      aria-label={`Change status: ${status}`}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          confirmed ? "bg-success" : "bg-warning"
        )}
        aria-hidden="true"
      />
      {status}
    </Badge>
  )
}

function DirectionBadge({
  direction,
}: {
  direction: ProrationResult["direction"]
}) {
  if (direction === "same") {
    return <Badge variant="outline">No change</Badge>
  }

  const isUpgrade = direction === "upgrade"

  return (
    <Badge variant={isUpgrade ? "success-light" : "warning-light"}>
      {isUpgrade ? (
        <ArrowUpIcon aria-hidden="true" />
      ) : (
        <ArrowDownIcon aria-hidden="true" />
      )}
      {isUpgrade ? "Upgrade" : "Downgrade"}
    </Badge>
  )
}

function PlanStep({
  values,
  onValueChange,
}: {
  values: PlanChangeValues
  onValueChange: (field: keyof PlanChangeValues, value: string) => void
}) {
  return (
    <WizardSection
      id="plan-change-plan-title"
      title="New Plan"
      description="Pick the tier to move this subscription to."
    >
      <FieldSet className="gap-0">
        <FieldLegend className="sr-only">Available plans</FieldLegend>
        <RadioGroup
          value={values.plan}
          onValueChange={(value) => onValueChange("plan", value as PlanTierId)}
          aria-label="Select new plan"
        >
          <ItemGroup className="gap-2">
            {PLAN_OPTIONS.map((plan) => {
              const fieldId = `plan-change-plan-${plan.id}`
              const isSelected = values.plan === plan.id
              const isCurrent = plan.id === SUBSCRIPTION.currentPlan

              return (
                <Item
                  key={plan.id}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "hover:bg-muted/50 gap-3 transition-colors",
                    isSelected && "border-primary bg-primary/5"
                  )}
                >
                  <Field
                    orientation="horizontal"
                    className="w-full flex-wrap gap-3 sm:flex-nowrap"
                  >
                    <RadioGroupItem id={fieldId} value={plan.id} />
                    <FieldLabel
                      htmlFor={fieldId}
                      className="min-w-0 flex-1 items-start"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="font-medium">{plan.label}</span>
                          {isCurrent ? (
                            <Badge variant="outline" size="sm">
                              Current
                            </Badge>
                          ) : plan.badge ? (
                            <Badge variant="success-light" size="sm">
                              {plan.badge}
                            </Badge>
                          ) : null}
                        </span>
                        <span className="text-muted-foreground text-sm font-normal">
                          {plan.description}
                        </span>
                      </span>
                    </FieldLabel>
                    <span className="ml-auto shrink-0 text-right text-sm font-semibold tabular-nums">
                      {formatCurrency(plan.price)}
                      <span className="text-muted-foreground font-normal">
                        /seat/mo
                      </span>
                    </span>
                  </Field>
                </Item>
              )
            })}
          </ItemGroup>
        </RadioGroup>
      </FieldSet>
    </WizardSection>
  )
}

function TimingStep({
  values,
  onValueChange,
}: {
  values: PlanChangeValues
  onValueChange: (field: keyof PlanChangeValues, value: string) => void
}) {
  return (
    <WizardSection
      id="plan-change-timing-title"
      title="Timing"
      description="Choose when the new plan takes effect."
    >
      <FieldSet className="gap-0">
        <FieldLegend className="sr-only">Change timing</FieldLegend>
        <RadioGroup
          value={values.timing}
          onValueChange={(value) =>
            onValueChange("timing", value as ChangeTiming)
          }
          aria-label="Select change timing"
        >
          <ItemGroup className="gap-2">
            {TIMING_OPTIONS.map((option) => {
              const fieldId = `plan-change-timing-${option.value}`
              const isSelected = values.timing === option.value

              return (
                <Item
                  key={option.value}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "hover:bg-muted/50 gap-3 transition-colors",
                    isSelected && "border-primary bg-primary/5"
                  )}
                >
                  <Field
                    orientation="horizontal"
                    className="w-full flex-nowrap items-start gap-3"
                  >
                    <RadioGroupItem id={fieldId} value={option.value} />
                    <FieldLabel
                      htmlFor={fieldId}
                      className="min-w-0 flex-1 items-start"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-muted-foreground text-sm font-normal">
                          {option.description}
                        </span>
                      </span>
                    </FieldLabel>
                  </Field>
                </Item>
              )
            })}
          </ItemGroup>
        </RadioGroup>
      </FieldSet>
    </WizardSection>
  )
}

function ConfirmStep({
  values,
  confirmed,
  proration,
}: {
  values: PlanChangeValues
  confirmed: boolean
  proration: ProrationResult
}) {
  const currentPlan = getPlan(SUBSCRIPTION.currentPlan)
  const newPlan = getPlan(values.plan)
  const effective =
    values.timing === "now" ? "Today" : SUBSCRIPTION.renewalLabel

  return (
    <WizardSection
      id="plan-change-confirm-title"
      title="Confirm"
      description="Review the change before it is scheduled."
    >
      {confirmed ? (
        <Alert variant="success">
          <CircleCheckIcon aria-hidden="true" />
          <AlertTitle>Plan change scheduled</AlertTitle>
          <AlertDescription>
            {SUBSCRIPTION.customerName} moves to {newPlan.label} effective{" "}
            {effective.toLowerCase()}. Invoice {SUBSCRIPTION.resultingInvoice}{" "}
            issued.
          </AlertDescription>
        </Alert>
      ) : null}

      <dl className="flex flex-col gap-3">
        <SummaryRow
          label="Plan"
          value={`${currentPlan.label} to ${newPlan.label}`}
        />
        <SummaryRow label="Seats" value={`${SUBSCRIPTION.seats} seats`} />
        <SummaryRow
          label="Timing"
          value={values.timing === "now" ? "Apply now" : "At next renewal"}
        />
        <SummaryRow label="Effective" value={effective} />
        <SummaryRow
          label="Requested by"
          value={
            <span className="flex items-center justify-end gap-2">
              <Avatar className="size-5">
                <AvatarImage src={SUBSCRIPTION.requestedBy.avatar} alt="" />
                <AvatarFallback className="text-[9px] font-medium">
                  MW
                </AvatarFallback>
              </Avatar>
              {SUBSCRIPTION.requestedBy.name}
            </span>
          }
        />
        <SummaryRow
          label="Due today"
          value={formatCurrency(proration.dueToday)}
          strong
        />
      </dl>
    </WizardSection>
  )
}

function ProrationSummary({
  values,
  proration,
}: {
  values: PlanChangeValues
  proration: ProrationResult
}) {
  const currentPlan = getPlan(SUBSCRIPTION.currentPlan)
  const newPlan = getPlan(values.plan)
  const isRenewal = values.timing === "renewal"
  const newMonthly = newPlan.price * SUBSCRIPTION.seats
  const effective = isRenewal ? SUBSCRIPTION.renewalLabel : "Today"

  return (
    <aside
      className="flex min-w-0 flex-col gap-5 border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"
      aria-labelledby="plan-change-summary-title"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 id="plan-change-summary-title" className="text-sm font-semibold">
            Proration preview
          </h2>
          <DirectionBadge direction={proration.direction} />
        </div>
        <p className="text-muted-foreground text-sm">
          Updates as you change plan.
        </p>
      </div>

      <AmountRow
        label="Due today"
        value={formatCurrency(proration.dueToday)}
        hint={
          isRenewal
            ? `New price starts ${SUBSCRIPTION.renewalLabel}`
            : `${newPlan.label}, ${SUBSCRIPTION.seats} seats, prorated ${SUBSCRIPTION.daysRemaining} days`
        }
      />

      {isRenewal ? (
        <SummarySection title="At renewal">
          <dl className="flex flex-col gap-2.5">
            <SummaryRow
              label="New monthly"
              value={formatCurrency(newMonthly)}
              hint={`${newPlan.label}, ${SUBSCRIPTION.seats} seats`}
              labelForeground
            />
            <SummaryRow
              label="Starts"
              value={SUBSCRIPTION.renewalLabel}
              labelForeground
            />
          </dl>
        </SummarySection>
      ) : (
        <SummarySection title="Proration">
          <dl className="flex flex-col gap-2.5">
            <SummaryRow
              label="Current plan credit"
              value={`-${formatCurrency(proration.currentCredit)}`}
              hint={`${currentPlan.label}, unused ${SUBSCRIPTION.daysRemaining} days`}
              labelForeground
            />
            <SummaryRow
              label="New plan charge"
              value={formatCurrency(proration.newCharge)}
              hint={`${newPlan.label}, ${SUBSCRIPTION.daysRemaining} days`}
              labelForeground
            />
            {proration.creditToNextInvoice > 0 ? (
              <SummaryRow
                label="Credit to next invoice"
                value={formatCurrency(proration.creditToNextInvoice)}
                hint="Applied on Jul 4"
                labelForeground
              />
            ) : null}
          </dl>
        </SummarySection>
      )}

      <SummarySection title="Change">
        <dl className="flex flex-col gap-2.5">
          <SummaryRow
            label="New plan"
            value={`${newPlan.label}, ${SUBSCRIPTION.seats} seats`}
            hint={newPlan.code}
            labelForeground
          />
          <SummaryRow label="Effective" value={effective} labelForeground />
        </dl>
      </SummarySection>
    </aside>
  )
}

// Plan change and proration wizard. The proration summary rail stays beside
// every step and recomputes from the chosen plan and timing (the signature).
export function PlanChangeWizard() {
  const [currentStep, setCurrentStep] = useState(1)
  const [confirmed, setConfirmed] = useState(false)
  const [values, setValues] = useState<PlanChangeValues>(
    DEFAULT_PLAN_CHANGE_VALUES
  )

  const proration = getProration(values)
  const isLastStep = currentStep === WIZARD_STEPS.length

  const handleValueChange = (field: keyof PlanChangeValues, value: string) => {
    setConfirmed(false)
    setValues((current) => ({ ...current, [field]: value }))
  }

  const handlePrimaryAction = () => {
    if (isLastStep) {
      setConfirmed(true)
      return
    }
    setCurrentStep((step) => Math.min(WIZARD_STEPS.length, step + 1))
  }

  return (
    <Card className="w-full max-w-4xl gap-0 p-0">
      <Stepper value={currentStep} onValueChange={setCurrentStep}>
        <CardHeader className="gap-x-4 gap-y-1 border-b px-5 py-4 sm:px-6">
          <CardTitle className="leading-5">Change Plan</CardTitle>
          <CardDescription className="max-w-[34rem] leading-5">
            {SUBSCRIPTION.customerName} on{" "}
            {getPlan(SUBSCRIPTION.currentPlan).label} · {SUBSCRIPTION.seats}{" "}
            seats
          </CardDescription>
          <CardAction className="self-center pl-3">
            <ChangeStatusBadge confirmed={confirmed} />
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-6 px-5 py-5 sm:px-6 sm:py-6">
          <div
            data-stepper-scroll
            className="overflow-x-auto overflow-y-hidden py-4"
          >
            <StepperNav
              aria-label="Plan change progress"
              className="min-w-full items-start"
            >
              {WIZARD_STEPS.map((step, index) => (
                <StepperItem
                  key={step.id}
                  step={step.step}
                  className="relative min-w-0 flex-1 overflow-visible"
                >
                  <StepperTrigger
                    aria-label={step.title}
                    className="w-full min-w-0 flex-col items-center justify-start gap-2 px-0 text-center"
                  >
                    <StepperIndicator className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=completed]:border-primary data-[state=completed]:bg-primary data-[state=inactive]:border-border data-[state=inactive]:bg-background data-[state=inactive]:text-foreground data-[state=active]:before:border-primary relative isolate size-6 overflow-visible rounded-full border border-transparent before:pointer-events-none before:absolute before:inset-0 before:z-10 before:rounded-full before:border before:border-dashed before:border-transparent before:content-[''] data-[state=active]:border-0 data-[state=active]:before:animate-[spin_8s_linear_infinite] motion-reduce:data-[state=active]:before:animate-none">
                      {index + 1}
                    </StepperIndicator>
                    <span className="flex max-w-full min-w-0 flex-col items-center gap-1 text-center">
                      <StepperTitle className="max-w-full truncate">
                        {step.title}
                      </StepperTitle>
                      <span className="text-muted-foreground hidden text-xs leading-none sm:block">
                        {step.description}
                      </span>
                    </span>
                  </StepperTrigger>
                  {index < WIZARD_STEPS.length - 1 ? (
                    <StepperSeparator className="group-data-[state=completed]/step:bg-primary absolute top-3 left-[calc(50%+1.125rem)] m-0 w-[calc(100%-2.25rem)] flex-none" />
                  ) : null}
                </StepperItem>
              ))}
            </StepperNav>
          </div>

          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <StepperPanel>
              {WIZARD_STEPS.map((step) => (
                <StepperContent
                  key={step.id}
                  value={step.step}
                  className="w-full"
                >
                  {step.id === "plan" ? (
                    <PlanStep
                      values={values}
                      onValueChange={handleValueChange}
                    />
                  ) : null}
                  {step.id === "timing" ? (
                    <TimingStep
                      values={values}
                      onValueChange={handleValueChange}
                    />
                  ) : null}
                  {step.id === "confirm" ? (
                    <ConfirmStep
                      values={values}
                      confirmed={confirmed}
                      proration={proration}
                    />
                  ) : null}
                </StepperContent>
              ))}
            </StepperPanel>

            <ProrationSummary values={values} proration={proration} />
          </div>
        </CardContent>

        <CardFooter className="justify-between gap-3 border-t px-5 py-4 sm:px-6">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}
            >
              <ArrowLeftIcon className="size-4" aria-hidden="true" />
              Previous
            </Button>
          ) : (
            <span className="hidden h-9 w-28 sm:block" aria-hidden="true" />
          )}

          <Button
            type="button"
            onClick={handlePrimaryAction}
            className="ml-auto"
            disabled={isLastStep && confirmed}
          >
            {isLastStep ? (confirmed ? "Scheduled" : "Confirm change") : "Next"}
            {isLastStep && !confirmed ? (
              <CheckIcon className="size-4" aria-hidden="true" />
            ) : null}
            {!isLastStep ? (
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            ) : null}
          </Button>
        </CardFooter>
      </Stepper>
    </Card>
  )
}