const decode = (segment: string) => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * Where to land after an environment switch, or `null` to stay put.
 *
 * Ids are scoped to an environment, so a page addressed by one (a customer, a
 * plan, an invoice) does not exist in the environment just switched to. The
 * landing place is the list the id sat under: everything before the first
 * route param, so `/customers/abc/edit` becomes `/customers`. Pages without a
 * param (lists, forms, dashboards) are valid in every environment and stay.
 */
export function listPathAfterEnvironmentSwitch(
  pathname: string,
  params: Record<string, string | undefined>,
): string | null {
  const ids = new Set(Object.values(params).filter((v): v is string => !!v))
  if (ids.size === 0) return null
  const segments = pathname.split('/').filter(Boolean)
  const at = segments.findIndex((segment) => ids.has(decode(segment)))
  if (at <= 0) return null
  return `/${segments.slice(0, at).join('/')}`
}
