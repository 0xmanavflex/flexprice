const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** A connection id in the backend's format (`conn_` + ULID), so its webhook URL is known before create. */
export function newConnectionId(now: number = Date.now()): string {
  let time = ''
  for (let rest = now, i = 0; i < 10; i++, rest = Math.floor(rest / 32)) {
    time = CROCKFORD.charAt(rest % 32) + time
  }
  const random = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    CROCKFORD.charAt(byte % 32),
  ).join('')
  return `conn_${time}${random}`
}
