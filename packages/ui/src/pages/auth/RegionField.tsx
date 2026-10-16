import { useId, useState } from 'react'
import { CheckIcon, InfoIcon } from '@ui/icons'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ui/components/primitives/dialog'
import { Field, FieldLabel } from '@ui/components/primitives/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { provenance } from '@ui/provenance'

/**
 * The data-region picker on the sign-in and sign-up forms, after the dashboard
 * redesign (and admin.flexprice.io before it): a flag and a name per region,
 * an "i" that opens what each region means, and a Select.
 */
export const RegionFieldProvenance = provenance({
  source: 'composition',
  composes: ['ui/select', 'ui/field', 'ui/tooltip', 'ui/dialog'],
  note: 'Data region field from the dashboard redesign.',
})

export type RegionId = 'in' | 'us' | 'ca'

export interface RegionOption {
  id: RegionId
  label: string
}

/** What each region means, as the live app explains it. */
const REGION_INFO: Record<RegionId, { title: string; points: string[] }> = {
  us: {
    title: 'US hosting',
    points: [
      'Faster if you and your users are based in the US',
      'Easier to comply with some US regulations',
      'Hosted in Oregon, USA (us-west-2)',
    ],
  },
  in: {
    title: 'India hosting',
    points: [
      'Faster if you and your users are based in India',
      'Hosted in Mumbai, India (ap-south-1)',
    ],
  },
  ca: {
    title: 'Canada hosting',
    points: [
      'Faster if you and your users are based in Canada',
      'Keeps billing data inside Canada',
      'Hosted in Montréal, Canada (ca-central-1)',
    ],
  },
}

/** Small flags, drawn rather than fetched. */
function Flag({ id }: { id: RegionId }) {
  const frame = 'h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-border'
  if (id === 'in') {
    return (
      <svg viewBox="0 0 30 20" aria-hidden="true" className={frame}>
        <rect width="30" height="20" fill="#ffffff" />
        <rect width="30" height="6.67" fill="#ff9933" />
        <rect y="13.33" width="30" height="6.67" fill="#138808" />
        <circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.7" />
      </svg>
    )
  }
  if (id === 'ca') {
    return (
      <svg viewBox="0 0 30 20" aria-hidden="true" className={frame}>
        <rect width="30" height="20" fill="#ffffff" />
        <rect width="7.5" height="20" fill="#d52b1e" />
        <rect x="22.5" width="7.5" height="20" fill="#d52b1e" />
        <path
          d="M15 5.2l1 2 2.1-.5-.7 2 1.8 1.1-1.8 1.1.4 1.6-1.9-.3-.3 1.9h-1.2l-.3-1.9-1.9.3.4-1.6L11 9.8l1.8-1.1-.7-2 2.1.5z"
          fill="#d52b1e"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 30 20" aria-hidden="true" className={frame}>
      <rect width="30" height="20" fill="#ffffff" />
      {[0, 2, 4, 6, 8, 10, 12].map((stripe) => (
        <rect key={stripe} y={(stripe * 20) / 13} width="30" height={20 / 13} fill="#b22234" />
      ))}
      <rect width="12" height={(7 * 20) / 13} fill="#3c3b6e" />
    </svg>
  )
}

function RegionLabel({ option }: { option: RegionOption }) {
  return (
    <span className="flex items-center gap-2">
      <Flag id={option.id} />
      {option.label}
    </span>
  )
}

export interface RegionFieldProps {
  regions: readonly RegionOption[]
  value: RegionId
  onChange: (region: RegionId) => void
  disabled?: boolean
}

export function RegionField({ regions, value, onChange, disabled }: RegionFieldProps) {
  const [info, setInfo] = useState(false)
  const id = useId()
  const current = regions.find((region) => region.id === value) ?? regions[0]

  return (
    <Field>
      <div className="flex items-center gap-1.5">
        <FieldLabel htmlFor={id}>Data region</FieldLabel>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Learn more about regions"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setInfo(true)}
              />
            }
          >
            <InfoIcon className="size-3.5" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>Learn more about regions</TooltipContent>
        </Tooltip>
      </div>
      <Dialog open={info} onOpenChange={setInfo}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-medium">
              Which region would you like to choose?
            </DialogTitle>
            <DialogDescription>
              Choose carefully. Moving to another region is possible, but it needs a manual
              migration and can&apos;t be changed automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5">
            {regions.map((region) => (
              <div key={region.id} className="flex flex-col gap-2.5">
                <p className="text-sm font-medium">{REGION_INFO[region.id].title}</p>
                <ul className="flex flex-col gap-2">
                  {REGION_INFO[region.id].points.map((point) => (
                    <li
                      key={point}
                      className="text-muted-foreground flex items-start gap-2 text-sm"
                    >
                      <CheckIcon
                        className="text-success mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Select
        value={value}
        items={regions.map((region) => ({ value: region.id, label: region.label }))}
        onValueChange={(next) => {
          if (next) onChange(next as RegionId)
        }}
        {...(disabled ? { disabled } : {})}
      >
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue>{() => (current ? <RegionLabel option={current} /> : null)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {regions.map((region) => (
            <SelectItem key={region.id} value={region.id}>
              <RegionLabel option={region} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
