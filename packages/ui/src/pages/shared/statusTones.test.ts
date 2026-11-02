import { describe, expect, it } from 'vitest'
import {
  CREDIT_NOTE_STATUS_TONE,
  INVOICE_DOCUMENT_STATUS_TONE,
  INVOICE_STATUS_TONE,
  PAYMENT_STATUS_TONE,
  PORTAL_SUBSCRIPTION_STATUS_TONE,
  SUBSCRIPTION_STATUS_TONE,
  VERSION_STATUS_TONE,
  WALLET_STATUS_TONE,
  WEBHOOK_DELIVERY_STATUS_TONE,
  WORKFLOW_STATUS_TONE,
  statusTone,
} from './statusTones'

describe('statusTone', () => {
  it('reads a word the same however it is spelled', () => {
    for (const word of ['PAST_DUE', 'past-due', 'pastDue', 'Past due']) {
      expect(statusTone(word)).toBe('danger')
    }
    expect(statusTone('timedOut')).toBe('neutral')
    expect(statusTone('continuedAsNew')).toBe('warning')
  })

  it('is grey for a word it does not know', () => {
    expect(statusTone('something new')).toBe('neutral')
  })

  it('gives finalized and voided one colour on every page', () => {
    expect(INVOICE_DOCUMENT_STATUS_TONE.finalized).toBe('success')
    expect(CREDIT_NOTE_STATUS_TONE.finalized).toBe('success')
    expect(statusTone('Finalized')).toBe('success')
    expect(INVOICE_DOCUMENT_STATUS_TONE.voided).toBe('warning')
    expect(INVOICE_STATUS_TONE.void).toBe('warning')
    expect(PAYMENT_STATUS_TONE.voided).toBe('warning')
    expect(CREDIT_NOTE_STATUS_TONE.voided).toBe('warning')
  })

  it('keeps violet for trialing alone', () => {
    const maps = [
      INVOICE_STATUS_TONE,
      INVOICE_DOCUMENT_STATUS_TONE,
      PAYMENT_STATUS_TONE,
      SUBSCRIPTION_STATUS_TONE,
      PORTAL_SUBSCRIPTION_STATUS_TONE,
      CREDIT_NOTE_STATUS_TONE,
      WALLET_STATUS_TONE,
      VERSION_STATUS_TONE,
      WEBHOOK_DELIVERY_STATUS_TONE,
      WORKFLOW_STATUS_TONE,
    ]
    const violet = maps.flatMap((map) =>
      Object.entries(map)
        .filter(([, tone]) => tone === 'trial')
        .map(([status]) => status),
    )
    expect(new Set(violet)).toEqual(new Set(['trialing']))
  })
})
