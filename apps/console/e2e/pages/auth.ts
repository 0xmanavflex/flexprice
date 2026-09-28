import type { Locator, Page } from '@playwright/test'

/**
 * The sign-in screen — the one surface outside the shell.
 *
 * A page object for the same reason `ShellPage` is one: two specs reach this
 * form (the mocked one and the opt-in live one), and how a field is addressed
 * should be one edit rather than one per spec.
 *
 * On selectors. The email field is an `<input type="email">`, which is a
 * `textbox`, so it is reached by role and accessible name like every other
 * control in this suite. The password field is not: `<input type="password">`
 * has no implicit ARIA role at all, by design — screen readers announce it
 * from its label. There is no role to select by, so it is selected by that
 * label, and the compromise lives here instead of in every spec.
 */
export class SignInPage {
  /** The form's `<h1>`. Present means the route rendered, not merely resolved. */
  readonly heading: Locator
  readonly email: Locator
  readonly password: Locator
  readonly submit: Locator
  /**
   * The failure banner above the form — `role="alert"`, so it is announced
   * rather than merely rendered. Field-level validation messages are alerts
   * too, which is why the specs assert on its text rather than its presence.
   */
  readonly alert: Locator

  private readonly page: Page

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { level: 1, name: 'Sign in to Flexprice' })
    this.email = page.getByRole('textbox', { name: 'Email' })
    this.password = page.getByLabel('Password', { exact: true })
    this.submit = page.getByRole('button', { name: 'Sign in', exact: true })
    this.alert = page.getByRole('alert')
  }

  async goto() {
    await this.page.goto('/sign-in')
  }

  async signIn(email: string, password: string) {
    await this.email.fill(email)
    await this.password.fill(password)
    await this.submit.click()
  }
}
