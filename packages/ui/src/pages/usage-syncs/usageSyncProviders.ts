const PROVIDER_LABEL: Record<string, string> = {
  aws_marketplace: 'AWS Marketplace',
  gcp_marketplace: 'Google Cloud Marketplace',
  azure_marketplace: 'Azure Marketplace',
}

/** A marketplace key as words. One this build has not heard of is title-cased, never blanked. */
export function providerLabel(provider: string): string {
  const known = PROVIDER_LABEL[provider]
  if (known) return known
  return provider
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
