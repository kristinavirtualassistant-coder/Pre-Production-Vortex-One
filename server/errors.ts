/** Raised when a tenant-owned resource does not exist FOR THE CALLER'S ORGANIZATION (never reveals other tenants' rows). */
export class ResourceNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'ResourceNotFoundError';
  }
}

/** Maps a thrown error to an HTTP status. Unknown errors are 500; tenant not-found conditions are 404. */
export function httpStatusForError(error: unknown): number {
  if (error instanceof ResourceNotFoundError) return 404;
  const status = (error as { statusCode?: unknown })?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 600) return status;
  const message = String((error as { message?: unknown })?.message ?? '');
  if (/^(Campaign|Dialing session|Lead|Workflow|Webhook endpoint|Call|Contact|Owner|Property|Schedule)\b.*\bnot found$/i.test(message)) return 404;
  return 500;
}
