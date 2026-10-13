import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/auth/errors";

export function jsonError(status: number, message: string, code = "error") {
  return NextResponse.json({ error: code, message }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return jsonError(401, "Your session is no longer valid. Please sign in again.", "unauthorized");
  }
  if (error instanceof ForbiddenError) {
    return jsonError(403, "You do not have permission to perform this action.", "forbidden");
  }
  if (error instanceof Error && error.message === "TAG_EXISTS") {
    return jsonError(409, "An asset with this tag already exists.", "conflict");
  }
  // Full details stay server-side only; clients get a generic message.
  console.error("[assetflow] api error", error);
  return jsonError(500, "The request could not be completed.", "internal");
}

export function readString(source: unknown, key: string): string {
  if (typeof source !== "object" || source === null) {
    return "";
  }
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}
