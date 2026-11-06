/** The message from a thrown value, safe to show in the UI. */
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
