import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getRepository } from "@/lib/data";
import { handleApiError } from "@/lib/api/server";
import type { MeResponse } from "@/lib/api/types";

export async function GET(): Promise<
  NextResponse<MeResponse | { error: string; message: string }>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ user: null, preferences: null }, { status: 401 });
    }
    const preferences = await getRepository().getPreferences(user.id);
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
      },
      preferences: preferences
        ? { language: preferences.language, theme: preferences.theme }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
