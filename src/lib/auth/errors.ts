/**
 * Shared authorization errors.
 *
 * Kept in a leaf module so both the session helpers and the API error mapper
 * can reference the same classes without importing the data layer or the
 * Supabase client.
 */
export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}
