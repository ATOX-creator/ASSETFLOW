import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getRepository } from "@/lib/data";
import { handleApiError } from "@/lib/api/server";
import type { AssetsResponse } from "@/lib/api/types";

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const items = await getRepository().listAssets({
      search: url.searchParams.get("search") ?? "",
      category: url.searchParams.get("category") ?? "",
      status: url.searchParams.get("status") ?? "",
    });
    return NextResponse.json({ items } satisfies AssetsResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
