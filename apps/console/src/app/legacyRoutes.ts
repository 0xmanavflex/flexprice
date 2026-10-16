const RENAMED_ROUTES: Readonly<Record<string, string>> = {
  '/subscriptions': '/contracts',
  '/credit-notes': '/credit-memos',
  '/products': '/features',
}

/** Match a complete path segment so unrelated routes are never rewritten. */
export function legacyDestination(pathname: string): string | undefined {
  for (const [oldPath, newPath] of Object.entries(RENAMED_ROUTES)) {
    if (pathname === oldPath || pathname.startsWith(`${oldPath}/`)) {
      return newPath + pathname.slice(oldPath.length)
    }
  }
  return undefined
}
