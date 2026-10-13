export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const body = payload as { message?: string; error?: string } | null;
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/login"
    ) {
      const next = encodeURIComponent(
        window.location.pathname + window.location.search,
      );
      window.location.assign(`/login?next=${next}`);
    }
    throw new ApiError(
      response.status,
      body?.error ?? "error",
      body?.message ?? "The request could not be completed.",
    );
  }
  return payload as T;
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { cache: "no-store", signal });
  return parse<T>(response);
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  return parse<T>(response);
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
