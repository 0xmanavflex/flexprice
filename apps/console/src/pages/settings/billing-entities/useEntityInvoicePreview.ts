import { defaultInvoiceConfig, entityInvoicePreview } from '@fp/domain'
import { useInvoiceConfig } from '@fp/query'
import { useSession } from '@/app/session'

/** The example invoice number for a prefix, from this environment's numbering scheme. */
export function useEntityInvoicePreview(): (prefix: string) => string {
  const { environmentId } = useSession()
  const config = useInvoiceConfig(environmentId)
  const scheme = config.data ?? defaultInvoiceConfig()
  return (prefix) => entityInvoicePreview(scheme, prefix)
}
