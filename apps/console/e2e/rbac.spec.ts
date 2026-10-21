import { expect, test, type BrowserContext } from '@playwright/test'

/**
 * RBAC as V1: the console shows what the signed-in principal's roles allow.
 * The mocked `/users/me` answers as `flexprice.mock.userId` (demo user, a
 * super admin, by default). The API stays the authority; this checks the UI.
 */
const READER = 'user_01M38QUSER0000000000004' // all_reader
const WRITER = 'user_01M38QUSER0000000000002' // all_writer

async function signInAs(context: BrowserContext, userId?: string) {
  await context.addInitScript(
    ({ session, userId }) => {
      try {
        window.localStorage.setItem('flexprice.session', session)
        if (userId) window.localStorage.setItem('flexprice.mock.userId', userId)
        else window.localStorage.removeItem('flexprice.mock.userId')
      } catch {
        /* private mode */
      }
    },
    {
      session: JSON.stringify({
        token: 'mock_demo_token',
        userId: 'user_demo',
        tenantId: 'tenant_demo',
      }),
      userId,
    },
  )
}

test('a reader sees lists with writes disabled, and is denied create pages', async ({
  page,
  context,
}) => {
  await signInAs(context, READER)
  await page.goto('/plans')
  await expect(page.getByRole('button', { name: 'New plan' })).toBeDisabled()

  await page.goto('/plans/new')
  await expect(page.getByText('Access denied')).toBeVisible()

  // The shell's Create menu offers nothing a reader can start.
  await page.goto('/customers')
  await page.getByRole('button', { name: 'Create something new' }).click()
  await expect(page.getByRole('menuitem', { name: 'New customer' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
})

test('a writer can create, but tenant settings stay super-admin only', async ({
  page,
  context,
}) => {
  await signInAs(context, WRITER)
  await page.goto('/plans')
  await expect(page.getByRole('button', { name: 'New plan' })).toBeEnabled()

  await page.goto('/settings?section=invoicing&tab=invoices')
  await expect(page.getByText('Only a super admin can change this.')).toBeVisible()

  // Team: no role editing or removal without super admin.
  await page.goto('/settings?section=team&tab=members')
  await expect(page.getByRole('button', { name: 'Edit roles' })).toHaveCount(0)
})

test('a super admin manages members, but never their own roles', async ({ page, context }) => {
  await signInAs(context)
  await page.goto('/settings?section=team&tab=members')
  const me = page.getByRole('row').filter({ hasText: 'demo@flexprice.io' })
  await expect(me.getByRole('button', { name: 'Edit roles' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit roles' }).first()).toBeVisible()
  await page.goto('/plans/new')
  await expect(page.getByText('Access denied')).toHaveCount(0)
})
