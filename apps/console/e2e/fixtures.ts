import { type Page, test as base, expect as baseExpect } from '@playwright/test'

/**
 * Every journey's `test`: Playwright's, plus failure evidence the reporter
 * cannot see on its own — what the browser logged and which requests failed.
 *
 * Collected for every journey, attached only when one fails (a passing
 * journey keeps nothing). Requests are recorded by method, URL path and
 * status only: no headers, bodies or query strings, so a token, cookie or
 * password never reaches a report.
 */
export const test = base.extend<{ evidence: void }>({
  evidence: [
    async ({ page }, use, testInfo) => {
      const consoleLines: string[] = []
      const networkLines: string[] = []
      const at = () => new Date().toISOString()
      const path = (raw: string) => {
        try {
          const url = new URL(raw)
          return `${url.origin}${url.pathname}`
        } catch {
          return raw.split('?')[0] ?? raw
        }
      }

      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
          consoleLines.push(`${at()} [${message.type()}] ${message.text()}`)
        }
      })
      page.on('pageerror', (error) => consoleLines.push(`${at()} [pageerror] ${error.message}`))
      page.on('requestfailed', (request) =>
        networkLines.push(
          `${at()} FAILED ${request.method()} ${path(request.url())} — ${request.failure()?.errorText ?? 'unknown'}`,
        ),
      )
      page.on('response', (response) => {
        if (response.status() >= 400) {
          networkLines.push(
            `${at()} ${response.status()} ${response.request().method()} ${path(response.url())}`,
          )
        }
      })

      await use()

      if (testInfo.status !== testInfo.expectedStatus) {
        if (consoleLines.length > 0) {
          await testInfo.attach('browser-console', {
            body: consoleLines.join('\n'),
            contentType: 'text/plain',
          })
        }
        if (networkLines.length > 0) {
          await testInfo.attach('network-errors', {
            body: networkLines.join('\n'),
            contentType: 'text/plain',
          })
        }
      }
    },
    { auto: true },
  ],
})

/** A URL as the journeys read it: without the console's `env` parameter. */
function withoutEnvironment(url: URL): string {
  const copy = new URL(url)
  copy.searchParams.delete('env')
  return copy.toString().replace(/\?$/, '')
}

/**
 * Every console page carries `?env=<environment id>` (see
 * `app/shell/environmentInUrl.ts`). The journeys assert where a page is, not
 * which environment it names, so `toHaveURL` compares the address with that
 * parameter removed; `shared-link-environment.spec.ts` checks `env` itself
 * by reading `page.url()`. Built on Playwright's own retrying `toHaveURL`.
 */
export const expect = baseExpect.extend({
  async toHaveURL(
    page: Page,
    expected: string | RegExp | ((url: URL) => boolean),
    options?: { timeout?: number; ignoreCase?: boolean },
  ) {
    const matches = (url: URL): boolean => {
      if (typeof expected === 'function') return expected(url)
      const actual = withoutEnvironment(url)
      if (typeof expected === 'string') return actual === withoutEnvironment(new URL(expected, url))
      expected.lastIndex = 0
      return expected.test(actual)
    }
    try {
      if (this.isNot) await baseExpect(page).not.toHaveURL(matches, options)
      else await baseExpect(page).toHaveURL(matches, options)
      return { pass: !this.isNot, name: 'toHaveURL', message: () => '' }
    } catch {
      return {
        pass: this.isNot,
        name: 'toHaveURL',
        message: () =>
          `Expected the URL (env removed) ${this.isNot ? 'not ' : ''}to match ${String(expected)}\n` +
          `Received: ${withoutEnvironment(new URL(page.url()))}`,
      }
    }
  },
})
