import { PaymentStatus } from '@fp/domain'
import { describe, expect, it } from 'vitest'
import { DEFAULT_INVOICE_QUERY, InvoiceSortField, InvoiceStatus } from '@fp/domain'
import {
  applyLineChanges,
  runInvoiceEdit,
  isServerFilterable,
  toInvoice,
  toInvoiceFilter,
  type InvoiceWire,
} from './invoices'

describe('toInvoiceFilter: domain vocabulary out, transport in', () => {
  it('turns a 1-based page into an offset', () => {
    expect(toInvoiceFilter({ ...DEFAULT_INVOICE_QUERY, page: 1, pageSize: 25 })).toMatchObject({
      limit: 25,
      offset: 0,
    })
    expect(toInvoiceFilter({ ...DEFAULT_INVOICE_QUERY, page: 3, pageSize: 25 })).toMatchObject({
      offset: 50,
    })
  })

  it('maps domain sort fields onto API field names', () => {
    expect(
      toInvoiceFilter({
        ...DEFAULT_INVOICE_QUERY,
        sortBy: InvoiceSortField.Total,
        sortDirection: 'asc',
      }).sort,
    ).toEqual([{ field: 'amount_due', direction: 'asc' }])
  })

  it('skips line items, which a list never renders and which dominate the payload', () => {
    expect(toInvoiceFilter(DEFAULT_INVOICE_QUERY)).toMatchObject({ skipLineItems: true })
  })

  it('asks for every status when nothing is selected, skipped included', () => {
    // Leaving the field out is not "any": the search then drops SKIPPED, and
    // the Invoice status filter condition could never find a skipped invoice.
    expect(toInvoiceFilter(DEFAULT_INVOICE_QUERY)).toMatchObject({
      invoiceStatus: ['DRAFT', 'FINALIZED', 'VOIDED', 'SKIPPED'],
    })
  })

  it('searches invoice numbers, not external customer ids', () => {
    const filter = toInvoiceFilter({ ...DEFAULT_INVOICE_QUERY, search: ' INV-202610-00030 ' })
    expect(filter).not.toHaveProperty('externalCustomerId')
    expect(filter['filters']).toEqual([
      {
        field: 'invoice_number',
        operator: 'contains',
        dataType: 'string',
        value: { string: 'INV-202610-00030' },
      },
    ])
  })

  it('sends the API values for statuses the server understands', () => {
    expect(
      toInvoiceFilter({
        ...DEFAULT_INVOICE_QUERY,
        statuses: [InvoiceStatus.Draft, InvoiceStatus.Void],
      }),
    ).toMatchObject({ invoiceStatus: ['DRAFT', 'VOIDED'] })
  })

  // `overdue` and `paid` are derived from finalized invoices, not stored. They
  // ask the server for finalized ones too, so [draft, overdue] can find both.
  it('asks for finalized invoices when a derived status is chosen', () => {
    const filter = toInvoiceFilter({
      ...DEFAULT_INVOICE_QUERY,
      statuses: [InvoiceStatus.Overdue, InvoiceStatus.Draft],
    })

    expect(filter).toMatchObject({ invoiceStatus: ['DRAFT', 'FINALIZED'] })
    expect(isServerFilterable(InvoiceStatus.Overdue)).toBe(false)
    expect(isServerFilterable(InvoiceStatus.Draft)).toBe(true)
  })
})

describe('toInvoice: a narrow model out of a 45-field optional response', () => {
  const wire: InvoiceWire = {
    id: 'inv_1',
    invoiceNumber: 'INV-0001',
    customerId: 'cus_1',
    customer: { name: 'Acme Corp' },
    invoiceStatus: 'FINALIZED',
    paymentStatus: 'PENDING',
    currency: 'usd',
    total: '1234.56',
    amountDue: '1234.56',
    amountRemaining: '1234.56',
    dueDate: new Date('2026-01-01T00:00:00Z'),
    issueDate: new Date('2025-12-01T00:00:00Z'),
  }

  it('produces domain money, not strings', () => {
    const invoice = toInvoice(wire, new Date('2025-12-15T00:00:00Z'))

    expect(invoice.total).toEqual({ amount: '1234.56', currency: 'USD' })
    expect(invoice.amountRemaining).toEqual({ amount: '1234.56', currency: 'USD' })
  })

  it('resolves one status from the response’s three', () => {
    expect(toInvoice(wire, new Date('2025-12-15T00:00:00Z')).status).toBe(InvoiceStatus.Open)
    expect(toInvoice(wire, new Date('2026-06-01T00:00:00Z')).status).toBe(InvoiceStatus.Overdue)
  })

  it('resolves a display name so no cell has to fall back', () => {
    expect(toInvoice({ ...wire, customer: { name: 'Acme Corp' } }).customerName).toBe('Acme Corp')
    expect(toInvoice({ ...wire, customer: { email: 'a@b.com' } }).customerName).toBe('a@b.com')
    expect(toInvoice({ ...wire, customer: undefined }).customerName).toBe('cus_1')
  })

  it('leaves the number blank when the API has not issued one', () => {
    expect(toInvoice({ ...wire, invoiceNumber: undefined }).number).toBe('')
    expect(toInvoice({ ...wire, invoiceNumber: '' }).number).toBe('')
    expect(toInvoice({ ...wire, invoiceNumber: '   ' }).number).toBe('')
    expect(toInvoice({ ...wire, invoiceNumber: undefined }).id).toBe('inv_1')
  })

  // Every field on InvoiceResponse is optional. The grid must still get a row.
  it('survives a response with nothing on it', () => {
    const invoice = toInvoice({})

    expect(invoice.total).toEqual({ amount: '0', currency: 'USD' })
    // No balance on the response is not proof it was paid.
    expect(invoice.status).toBe(InvoiceStatus.Open)
    expect(invoice.dueDate).toBeNull()
    expect(invoice.customerName).toBe('Unknown')
  })

  it('does not read a missing balance as paid', () => {
    const unpaid = { ...wire, amountRemaining: undefined }
    expect(toInvoice(unpaid, new Date('2025-12-15T00:00:00Z')).status).toBe(InvoiceStatus.Open)
    expect(
      toInvoice({ ...unpaid, amountDue: undefined }, new Date('2025-12-15T00:00:00Z')).status,
    ).toBe(InvoiceStatus.Open)
    expect(toInvoice({ ...unpaid, amountDue: '0' }).status).toBe(InvoiceStatus.Paid)
    expect(toInvoice({ ...unpaid, paymentStatus: 'SUCCEEDED' }).status).toBe(InvoiceStatus.Paid)
  })

  it('treats a zero remaining balance as paid, whatever the payment status says', () => {
    expect(toInvoice({ ...wire, amountRemaining: '0.00' }).status).toBe(InvoiceStatus.Paid)
  })
})

describe('applyLineChanges: the order and the id-threading are the logic', () => {
  /** Records each call, and lets a test say which invoice id the API answers with. */
  function recorder(answers: (string | undefined)[] = []) {
    const calls: { id: string; params: Record<string, unknown> }[] = []
    let n = 0
    const execute = async (id: string, params: Record<string, unknown>) => {
      calls.push({ id, params })
      return answers[n++]
    }
    return { calls, execute }
  }

  const line = (over: Record<string, unknown> = {}) => ({
    displayName: 'Onboarding',
    amount: '250',
    quantity: '1',
    ...over,
  })

  it('removes first, updates next, adds last', async () => {
    const { calls, execute } = recorder()
    await applyLineChanges(
      {
        invoiceId: 'inv_1',
        removed: ['li_old'],
        updated: [line({ id: 'li_a' })],
        added: [line({ displayName: 'Training' })],
      },
      execute,
    )
    expect(calls.map((c) => c.params['action'])).toEqual(['remove', 'update', 'add'])
  })

  it('sends one call per update, because an update versions the line item', async () => {
    // Batching two updates into one call is not available, and reusing the
    // original id after the first edit would address a line that no longer
    // exists under that id.
    const { calls, execute } = recorder()
    await applyLineChanges(
      {
        invoiceId: 'inv_1',
        removed: [],
        updated: [line({ id: 'li_a' }), line({ id: 'li_b' })],
        added: [],
      },
      execute,
    )
    expect(calls).toHaveLength(2)
    expect(calls.map((c) => c.params['lineItemId'])).toEqual(['li_a', 'li_b'])
  })

  it('threads the id the API answers with through the rest of the batch', async () => {
    /*
     * Modifying a finalized invoice voids it and returns a draft copy under a
     * new id. Every later call has to address that copy: the API rejects one
     * that still names the voided original: and the caller needs the id it
     * ended on so it can navigate somewhere that exists.
     */
    const { calls, execute } = recorder(['inv_copy'])
    const ended = await applyLineChanges(
      {
        invoiceId: 'inv_final',
        removed: ['li_old'],
        updated: [line({ id: 'li_a' })],
        added: [],
      },
      execute,
    )
    expect(calls[0]?.id).toBe('inv_final')
    expect(calls[1]?.id).toBe('inv_copy')
    expect(ended).toBe('inv_copy')
  })

  it('keeps the original id when the API does not name a new one', async () => {
    const { calls, execute } = recorder()
    const ended = await applyLineChanges(
      { invoiceId: 'inv_1', removed: [], updated: [line({ id: 'li_a' })], added: [] },
      execute,
    )
    expect(calls[0]?.id).toBe('inv_1')
    expect(ended).toBe('inv_1')
  })

  it('sends nothing at all when nothing changed', async () => {
    const { calls, execute } = recorder()
    const ended = await applyLineChanges(
      { invoiceId: 'inv_1', removed: [], updated: [], added: [] },
      execute,
    )
    expect(calls).toEqual([])
    expect(ended).toBe('inv_1')
  })

  it('skips an update with no id rather than addressing nothing', async () => {
    const { calls, execute } = recorder()
    await applyLineChanges(
      { invoiceId: 'inv_1', removed: [], updated: [line()], added: [] },
      execute,
    )
    expect(calls).toEqual([])
  })

  it('omits description when the editor never set one', async () => {
    // The API treats an absent description as "leave it"; sending undefined
    // explicitly is the difference between keeping and clearing it.
    const { calls, execute } = recorder()
    await applyLineChanges(
      { invoiceId: 'inv_1', removed: [], updated: [], added: [line()] },
      execute,
    )
    const items = calls[0]?.params['items'] as Record<string, unknown>[]
    expect(items[0]).not.toHaveProperty('description')
  })

  it('stops at the first failure and does not run the rest', async () => {
    // There is no transaction, so a compensating edit would be issuing more
    // changes against an invoice whose state is already unknown.
    const calls: string[] = []
    const execute = async (_id: string, params: Record<string, unknown>) => {
      calls.push(String(params['action']))
      if (params['action'] === 'update') throw new Error('rejected')
      return undefined
    }
    await expect(
      applyLineChanges(
        {
          invoiceId: 'inv_1',
          removed: ['li_old'],
          updated: [line({ id: 'li_a' })],
          added: [line()],
        },
        execute,
      ),
    ).rejects.toThrow('rejected')
    expect(calls).toEqual(['remove', 'update'])
  })
})

describe('runInvoiceEdit: the whole edit page, in the order the API needs', () => {
  function recorder(ids: Record<string, string> = {}) {
    const log: string[] = []
    return {
      log,
      calls: {
        update: async (id: string, body: object) => {
          log.push(`update ${id} ${JSON.stringify(body)}`)
          return ids['update'] ?? id
        },
        paymentStatus: async (id: string, change: { status: string }) => {
          log.push(`payment ${id} ${change.status}`)
        },
        modify: async (id: string, params: { action?: string }) => {
          log.push(`modify ${id} ${params.action}`)
          return ids['modify'] ?? id
        },
        finalize: async (id: string) => {
          log.push(`finalize ${id}`)
        },
        void: async (id: string) => {
          log.push(`void ${id}`)
        },
      },
    }
  }

  it('saves fields, then payment, then lines, then the lifecycle step', async () => {
    const { log, calls } = recorder()
    const id = await runInvoiceEdit(
      {
        invoiceId: 'inv_1',
        metadata: { po: '7' },
        paymentStatus: { status: PaymentStatus.Failed },
        lines: {
          removed: ['li_1'],
          updated: [],
          added: [{ displayName: 'Setup', amount: '10', quantity: '1' }],
        },
        nextStatus: 'finalize',
      },
      calls as never,
    )
    expect(log).toEqual([
      'update inv_1 {"metadata":{"po":"7"}}',
      'payment inv_1 failed',
      'modify inv_1 remove',
      'modify inv_1 add',
      'finalize inv_1',
    ])
    expect(id).toBe('inv_1')
  })

  it('follows the draft copy a finalized invoice is replaced by', async () => {
    const { log, calls } = recorder({ update: 'inv_copy' })
    const id = await runInvoiceEdit(
      {
        invoiceId: 'inv_1',
        applyDiscount: true,
        lines: {
          removed: [],
          updated: [{ id: 'li_1', displayName: 'A', amount: '1', quantity: '1' }],
          added: [],
        },
      },
      calls as never,
    )
    expect(log).toEqual(['update inv_1 {"applyDiscount":true}', 'modify inv_copy update'])
    expect(id).toBe('inv_copy')
  })

  it('makes no call for an untouched page', async () => {
    const { log, calls } = recorder()
    await runInvoiceEdit(
      { invoiceId: 'inv_1', lines: { removed: [], updated: [], added: [] } },
      calls as never,
    )
    expect(log).toEqual([])
  })
})

describe('toInvoice billing entity', () => {
  it('keeps the billing entity and the seller snapshot', () => {
    const invoice = toInvoice({
      billingEntityId: 'be_1',
      sellerSnapshot: {
        billingEntityId: 'be_1',
        legalName: 'Acme Ltd',
        sellerDetails: { email: 's@acme.test', address: { addressCity: 'Pune' } },
        taxIdentifiers: [{ country: 'IN', type: 'GST', value: '27AAA' }],
      },
    })
    expect(invoice.billingEntityId).toBe('be_1')
    expect(invoice.sellerSnapshot).toMatchObject({
      legalName: 'Acme Ltd',
      email: 's@acme.test',
      address: { city: 'Pune' },
      taxIdentifiers: [{ country: 'IN', type: 'GST', value: '27AAA' }],
    })
  })

  it('leaves both off when the wire has none', () => {
    const invoice = toInvoice({})
    expect(invoice).not.toHaveProperty('billingEntityId')
    expect(invoice).not.toHaveProperty('sellerSnapshot')
  })
})

describe('toInvoice subscription', () => {
  // The row menu's "View contract" needs it; one-off invoices have none.
  it('keeps the contract that raised the invoice, and null when there is none', () => {
    expect(toInvoice({ id: 'inv_1', subscriptionId: 'subs_1' }).subscriptionId).toBe('subs_1')
    expect(toInvoice({ id: 'inv_2' }).subscriptionId).toBeNull()
  })
})

describe('a customer-scoped invoice search', () => {
  it('scopes by internal customer id, which still resolves once the customer is archived', () => {
    const filter = toInvoiceFilter(DEFAULT_INVOICE_QUERY, { customerId: 'cust_archived' })
    expect(filter).toMatchObject({
      customerId: 'cust_archived',
      // The customer tab lists skipped invoices too, as V1 does.
      invoiceStatus: ['DRAFT', 'FINALIZED', 'VOIDED', 'SKIPPED'],
    })
    expect(filter).not.toHaveProperty('externalCustomerId')
  })
})

describe('the customer an invoice bills', () => {
  it("names the invoice's own customer, not a different expanded one", () => {
    // A contract invoiced to another customer expands the contract's customer.
    const invoice = toInvoice({
      id: 'inv_1',
      customerId: 'cust_billing',
      customer: { id: 'cust_child', name: 'Active Child' },
    })
    expect(invoice.customerName).toBe('cust_billing')
    expect(
      toInvoice({ id: 'inv_2', customerId: 'cust_1', customer: { id: 'cust_1', name: 'Acme' } })
        .customerName,
    ).toBe('Acme')
  })
})
