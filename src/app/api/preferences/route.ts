import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getRepository } from "@/lib/data";
import { handleApiError, jsonError, readString } from "@/lib/api/server";
import type { PreferencesResponse } from "@/lib/api/types";
import { isLanguage, isPreferenceTheme } from "@/lib/constants";

/**
 * Updates the caller's own preferences.
 *
 * The user id always comes from the verified session. Requests that try to
 * submit an access role or target another profile are refused with 403 —
 * roles are server-managed and no authenticated user can elevate itself.
 */
export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const repository = getRepository();
    const body = await request.json().catch(() => null);

    if (typeof body === "object" && body !== null) {
      const record = body as Record<string, unknown>;
      if ("role" in record) {
        return jsonError(
          403,
          "Access roles cannot be changed from this endpoint.",
          "forbidden",
        );
      }
      const targetId =
        typeof record.userId === "string"
          ? record.userId
          : typeof record.id === "string"
            ? record.id
            : null;
      if (targetId !== null && targetId !== user.id) {
        return jsonError(
          403,
          "You can only update your own profile.",
          "forbidden",
        );
      }
    }

    const language = readString(body, "language");
    const theme = readString(body, "theme");
    const hasDepartment =
      typeof body === "object" && body !== null && "department" in body;
    const department = readString(body, "department");

    if (language && !isLanguage(language)) {
      return jsonError(400, "Unsupported language.", "invalid_language");
    }
    if (theme && !isPreferenceTheme(theme)) {
      return jsonError(400, "Unsupported theme.", "invalid_theme");
    }
    if (department.length > 60) {
      return jsonError(400, "Department must be 60 characters or fewer.", "invalid_department");
    }

    if (hasDepartment) {
      await repository.updateDepartment(user.id, department || null);
    }
    if (language && isLanguage(language)) {
      await repository.savePreferences(user.id, { language });
    }
    if (theme && isPreferenceTheme(theme)) {
      await repository.savePreferences(user.id, { theme });
    }

    const fresh = await repository.getUser(user.id);
    const preferences = await repository.getPreferences(user.id);
    if (!fresh) {
      return jsonError(401, "Your session is no longer valid.", "unauthorized");
    }

    return NextResponse.json({
      user: {
        id: fresh.id,
        name: fresh.name,
        email: fresh.email,
        department: fresh.department,
      },
      preferences: preferences
        ? { language: preferences.language, theme: preferences.theme }
        : { language: "en", theme: "system" },
    } satisfies PreferencesResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
