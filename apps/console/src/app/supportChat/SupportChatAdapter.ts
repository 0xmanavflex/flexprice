/** The subset of the signed-in user a support-chat provider needs to identify them. */
export interface SupportChatUser {
  id: string
  email?: string | undefined
  name?: string | undefined
  /** Epoch milliseconds. */
  createdAt?: number | undefined
  tenantId?: string | undefined
}

export interface SupportChatVisibilityHandlers {
  onShow: () => void
  onHide: () => void
}

/**
 * The only thing `useSupportChat` knows about a provider. `subscribe()`'s return
 * value undoes `subscribe()`; `dispose()` kills the instance. Either may be
 * called first.
 */
export interface SupportChatAdapter {
  /** Load the SDK and identify the user. Rejects if the SDK cannot load or config is invalid. */
  init(user: SupportChatUser): Promise<void>
  /** Open the messenger. Never throws: a no-op if init failed or has not completed. */
  show(): void
  /**
   * Hide or bring back the provider's launcher, e.g. while a sheet or dialog is
   * open and the launcher would cover its actions. Optional: a provider without
   * it keeps its launcher.
   */
  setLauncherHidden?(hidden: boolean): void
  /** Register visibility handlers. The returned function removes them. */
  subscribe(handlers: SupportChatVisibilityHandlers): () => void
  /** Tear down this adapter instance. Called exactly once, on unmount. Idempotent. */
  dispose(): void
}
