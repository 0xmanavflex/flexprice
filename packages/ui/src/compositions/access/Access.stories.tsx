import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import type { AccessRequirement, RbacAction, RbacEntity } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { DetailMoreMenu } from '@ui/compositions/detail/DetailKit'
import { AccessProvider, AccessScope, type AccessValue, RequireAccess, WriteGate } from './Access'

/** A principal holding read on everything and write on `writes` only. */
function principal(writes: RbacEntity[], superAdmin = false): AccessValue {
  const can = (entity: RbacEntity, action: RbacAction) =>
    action === 'read' || writes.includes(entity)
  return {
    status: 'ready',
    isSuperAdmin: superAdmin,
    can,
    meets: (r: AccessRequirement) =>
      (!r.superAdmin || superAdmin) &&
      (typeof r.action === 'string' ? [r.action] : r.action).some((a) => can(r.entity, a)),
  }
}

const LOADING: AccessValue = { ...principal([]), status: 'loading' }

const meta = {
  title: 'Building blocks/Access/Access control',
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** A reader: the create button is disabled, with V1's reason in a tooltip. */
export const WriteDenied: Story = {
  render: () => (
    <AccessProvider value={principal([])}>
      <AccessScope entity="plan">
        <WriteGate>
          <Button onClick={fn()}>New plan</Button>
        </WriteGate>
      </AccessScope>
    </AccessProvider>
  ),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'New plan' })
    await expect(button).toBeDisabled()
  },
}

/** A writer of plans: the same button is live. */
export const WriteAllowed: Story = {
  render: () => (
    <AccessProvider value={principal(['plan'])}>
      <AccessScope entity="plan">
        <WriteGate>
          <Button>New plan</Button>
        </WriteGate>
      </AccessScope>
    </AccessProvider>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'New plan' })).toBeEnabled()
  },
}

/** A locked (read-only) account: a writer's button is off too, and the reason is the lock. */
export const WriteLocked: Story = {
  render: () => (
    <AccessProvider
      value={{
        ...principal(['plan']),
        writeLock: 'Your account is locked. Upgrade to make changes.',
      }}
    >
      <AccessScope entity="plan">
        <WriteGate block>
          <Button>New plan</Button>
        </WriteGate>
      </AccessScope>
    </AccessProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'New plan' })).toBeDisabled()
    await expect(canvas.getByText('Your account is locked. Upgrade to make changes.')).toBeVisible()
  },
}

/** A settings panel needs super admin: the note says so and every control inside is off. */
export const BlockNeedsSuperAdmin: Story = {
  render: () => (
    <AccessProvider value={principal(['setting'])}>
      <WriteGate block entity="setting" superAdmin>
        <label className="flex flex-col gap-1 text-sm">
          Invoice prefix
          <input className="rounded border px-2 py-1" defaultValue="INV" />
        </label>
        <Button>Save</Button>
      </WriteGate>
    </AccessProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Only a super admin can change this.')).toBeVisible()
    await expect(canvas.getByRole('textbox', { name: 'Invoice prefix' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeDisabled()
  },
}

/** While roles load the page waits; it never flashes "Access denied". */
export const PageLoading: Story = {
  render: () => (
    <AccessProvider value={LOADING}>
      <RequireAccess requirement={{ entity: 'plan', action: 'read' }}>
        <p>Plans</p>
      </RequireAccess>
    </AccessProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('Access denied')).toBeNull()
    await expect(canvas.queryByText('Plans')).toBeNull()
  },
}

/**
 * Access could not be read (the user or the role catalogue failed): the page
 * says so and offers a retry. Never "Access denied", which would be a lie.
 */
const retry = fn()
export const PageCheckFailed: Story = {
  render: () => (
    <AccessProvider value={{ ...principal([]), status: 'error', retry }}>
      <RequireAccess requirement={{ entity: 'task', action: 'read' }}>
        <p>Exports</p>
      </RequireAccess>
    </AccessProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("We couldn't check your access")).toBeVisible()
    await expect(canvas.queryByText('Access denied')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(retry).toHaveBeenCalled()
  },
}

/** A page the principal cannot read: V1's "Access denied", in place. */
export const PageDenied: Story = {
  render: () => (
    <AccessProvider value={principal([])}>
      <RequireAccess requirement={{ entity: 'plan', action: 'write' }}>
        <p>New plan form</p>
      </RequireAccess>
    </AccessProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Access denied')).toBeVisible()
    await expect(canvas.queryByText('New plan form')).toBeNull()
  },
}

/**
 * A detail menu follows the page's scope, item by item: Copy stays (read
 * only), Edit is off, and Create invoice checks invoices, not customers.
 */
/** A locked (read-only) account: the refused writes carry a lock; reads stay open. */
export const DetailMenuItemsLocked: Story = {
  render: () => (
    <AccessProvider
      value={{
        ...principal(['customer', 'invoice']),
        writeLock: 'Your account is locked. Upgrade to make changes.',
      }}
    >
      <AccessScope entity="customer">
        <DetailMoreMenu
          label="Customer actions"
          items={[
            { id: 'copy', label: 'Copy ID', readOnly: true, onSelect: fn() },
            { id: 'edit', label: 'Edit customer', onSelect: fn() },
          ]}
        />
      </AccessScope>
    </AccessProvider>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Customer actions' }))
    const edit = await screen.findByRole('menuitem', { name: 'Edit customer' })
    await expect(edit).toHaveAttribute('aria-disabled', 'true')
    await expect(edit.querySelector('[data-slot="locked-mark"]')).not.toBeNull()
    const copy = await screen.findByRole('menuitem', { name: 'Copy ID' })
    await expect(copy.querySelector('[data-slot="locked-mark"]')).toBeNull()
    await expect(screen.getByText('Your account is locked. Upgrade to make changes.')).toBeVisible()
  },
}

export const DetailMenuItems: Story = {
  render: () => (
    <AccessProvider value={principal(['invoice'])}>
      <AccessScope entity="customer">
        <DetailMoreMenu
          label="Customer actions"
          items={[
            { id: 'copy', label: 'Copy ID', readOnly: true, onSelect: fn() },
            { id: 'edit', label: 'Edit customer', onSelect: fn() },
            { id: 'invoice', label: 'Create invoice', entity: 'invoice', onSelect: fn() },
          ]}
        />
      </AccessScope>
    </AccessProvider>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Customer actions' }))
    const item = (name: string) => screen.findByRole('menuitem', { name })
    await expect(await item('Copy ID')).not.toHaveAttribute('aria-disabled', 'true')
    await expect(await item('Edit customer')).toHaveAttribute('aria-disabled', 'true')
    await expect(await item('Create invoice')).not.toHaveAttribute('aria-disabled', 'true')
  },
}
