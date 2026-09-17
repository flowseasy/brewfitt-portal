/** Errors raised by the data layer, with an HTTP-like status and a message fit to show the user. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong loading this. Try again, or reset the demo data from the user menu.";
}
