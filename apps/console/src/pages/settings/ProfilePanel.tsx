import { useId } from 'react'
import { type Tenant, type UpdateTenant, toUpdateTenantDraft, updateTenantSchema } from '@fp/domain'
import { useTenant, useUpdateTenant, useUserInfo } from '@fp/query'
import { SettingRow, SettingsFieldGroup } from '@fp/ui/compositions'
import { Button, Input } from '@fp/ui/primitives'
import {
  ActionError,
  ActionNote,
  Panel,
  PanelError,
  SettingsBlock,
  mutationMessage,
  toFailure,
  PanelLoading,
  PanelUnavailable,
  queryPhase,
} from './panelKit'
import { useDraft } from './useDraft'

/**
 * The organisation itself: its name, and who to bill and contact.
 *
 * Two hooks rather than one: the tenant can only be fetched by id, and the only
 * id this console may ask for is its own, which arrives with `GET /users/me`.
 * Asking for any other tenant 403s, so the id is never a prop.
 *
 * ## The three fields V1 had and never showed
 *
 * `email`, `help_email` and `phone` are in V1's update schema and have no
 * inputs anywhere in V1's form: the payload carried three keys the screen
 * could not set, so the only way to change a billing email was an API call.
 * They are real fields on `billing_details`; they are wired here.
 *
 * They stay optional on screen because they are optional in the schema: an
 * empty string is a valid value meaning "not set", and `updateTenantSchema`
 * accepts it rather than demanding an address from a tenant that has none to
 * give. Only the name is required, which is why only the name is starred.
 *
 * Laid out as ReUI's settings card: the label sits on the left, the control
 * on the right, and Save lives in the card footer.
 */
export function ProfilePanel() {
  const me = useUserInfo()
  const tenantId = me.data?.tenantId ?? ''
  const tenant = useTenant(tenantId)

  const failure = toFailure(me.error ?? tenant.error, 'your organisation')

  if (failure) {
    return (
      <Panel>
        <PanelError
          failure={failure}
          onRetry={() => {
            void me.refetch()
            void tenant.refetch()
          }}
        />
      </Panel>
    )
  }

  // `useTenant` is disabled until the id arrives, so the loading state has to
  // cover both hops: otherwise the panel renders an empty form for one frame
  // and then replaces it, which looks like the form resetting itself. But a
  // disabled query is `isPending` for ever: once `/users/me` has answered
  // without a tenant id, nothing is coming, and the panel says so.
  const mePhase = queryPhase(me)
  if (mePhase === 'loading') return <PanelLoading rows={6} />
  if (mePhase === 'idle' || !tenantId) {
    return (
      <PanelUnavailable
        reason="unavailable"
        title="Organisation details are not available"
        description="Your account did not report an organisation, so there is nothing to show here."
      />
    )
  }
  const tenantPhase = queryPhase(tenant)
  if (tenantPhase === 'idle') return <PanelUnavailable reason="unavailable" />
  if (tenantPhase === 'loading' || !tenant.data) return <PanelLoading rows={6} />

  // Keyed on the record so a refetch that genuinely changes the organisation
  // re-seeds the draft rather than leaving the values it mounted with.
  return <ProfileForm key={tenant.data.id} tenant={tenant.data} />
}

function ProfileForm({ tenant }: { tenant: Tenant }) {
  const update = useUpdateTenant()
  const draft = useDraft<UpdateTenant>(updateTenantSchema, toUpdateTenantDraft(tenant))

  const saveError = mutationMessage(update.error, 'The organisation could not be saved.')
  const busy = update.isPending

  return (
    <form
      className="contents"
      noValidate
      onSubmit={draft.handleSubmit((value) => {
        update.mutate(value, {
          // Re-seeded from what the server accepted, not from what was typed:
          // the API normalises, and a form still showing the typed version
          // claims a save that did not happen quite that way.
          onSuccess: (saved) => draft.reset(toUpdateTenantDraft(saved)),
        })
      })}
    >
      <Panel>
        <SettingsBlock label="Organisation" flush>
          <SettingsFieldGroup
            legend="Organisation"
            description="The name on your invoices, and where Flexprice reaches you."
          >
            <TextField
              label="Name"
              path="name"
              draft={draft}
              busy={busy}
              required
              placeholder="Northwind Systems"
            />
            <TextField
              label="Billing email"
              path="billingEmail"
              draft={draft}
              busy={busy}
              type="email"
              hint="Where invoices from Flexprice are sent."
              placeholder="billing@northwind.example"
            />
            <TextField
              label="Support email"
              path="helpEmail"
              draft={draft}
              busy={busy}
              type="email"
              hint="Shown to your customers when they need help with a bill."
              placeholder="support@northwind.example"
            />
            <TextField
              label="Phone"
              path="phone"
              draft={draft}
              busy={busy}
              type="tel"
              placeholder="+1 555 0142"
              last
            />
          </SettingsFieldGroup>
        </SettingsBlock>

        <SettingsBlock
          label="Billing address"
          flush
          actions={
            <div className="flex w-full flex-wrap items-center justify-end gap-3">
              <ActionError message={saveError} />
              {!saveError && update.isSuccess ? <ActionNote message="Saved." /> : null}
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          }
        >
          <SettingsFieldGroup
            legend="Billing address"
            description="Printed on the invoices Flexprice issues to you."
          >
            <TextField
              label="Address line 1"
              path="address.line1"
              draft={draft}
              busy={busy}
              autoComplete="address-line1"
            />
            <TextField
              label="Address line 2"
              path="address.line2"
              draft={draft}
              busy={busy}
              autoComplete="address-line2"
            />
            <TextField
              label="City"
              path="address.city"
              draft={draft}
              busy={busy}
              autoComplete="address-level2"
            />
            <TextField
              label="State or province"
              path="address.state"
              draft={draft}
              busy={busy}
              autoComplete="address-level1"
            />
            <TextField
              label="Postal code"
              path="address.postalCode"
              draft={draft}
              busy={busy}
              autoComplete="postal-code"
            />
            <TextField
              label="Country"
              path="address.country"
              draft={draft}
              busy={busy}
              autoComplete="country"
              hint="Two-letter code, for example US or IN."
              placeholder="US"
              last
            />
          </SettingsFieldGroup>
        </SettingsBlock>
      </Panel>
    </form>
  )
}

/** One labelled text input bound to a path in the draft, as a settings row. */
function TextField({
  label,
  path,
  draft,
  busy,
  required,
  hint,
  placeholder,
  type,
  autoComplete,
  last,
}: {
  label: string
  path: string
  draft: ReturnType<typeof useDraft<UpdateTenant>>
  busy: boolean
  required?: boolean
  hint?: string
  placeholder?: string
  type?: string
  autoComplete?: string
  last?: boolean
}) {
  const id = useId()
  const error = draft.error(path)

  return (
    <SettingRow
      title={label}
      labelFor={id}
      {...(hint ? { description: hint } : {})}
      {...(last ? { last: true } : {})}
      {...(required
        ? {
            titleAddon: (
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            ),
          }
        : {})}
    >
      <div className="flex w-full flex-col gap-1">
        <Input
          id={id}
          disabled={busy}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          value={draft.text(path)}
          onChange={(event) => draft.setText(path, event.target.value)}
          {...(type ? { type } : {})}
          {...(placeholder ? { placeholder } : {})}
          {...(autoComplete ? { autoComplete } : {})}
        />
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-destructive text-xs">
            {error}
          </p>
        ) : null}
      </div>
    </SettingRow>
  )
}
