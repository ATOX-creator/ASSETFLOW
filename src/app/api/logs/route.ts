import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getRepository } from "@/lib/data";
import { handleApiError } from "@/lib/api/server";
import type { LogsResponse } from "@/lib/api/types";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  try {
    await requireUser();
    const params = new URL(request.url).searchParams;

    const logs = await getRepository().listLogs({
      search: params.get("search") ?? "",
      assetId: params.get("asset") ?? "",
      category: params.get("category") ?? "",
      status: params.get("status") ?? "",
      userId: params.get("user") ?? "",
      from: params.get("from") ?? "",
      to: params.get("to") ?? "",
    });

    const ordered =
      params.get("sort") === "oldest" ? [...logs].reverse() : logs;

    const rawPageSize = Number(params.get("pageSize"));
    const pageSize = Number.isFinite(rawPageSize)
      ? Math.min(Math.max(Math.trunc(rawPageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
    const rawPage = Number(params.get("page"));
    const total = ordered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const page = Number.isFinite(rawPage)
      ? Math.min(Math.max(Math.trunc(rawPage) || 1, 1), pages)
      : 1;

    const start = (page - 1) * pageSize;

    return NextResponse.json({
      items: ordered.slice(start, start + pageSize),
      total,
      page,
      pageSize,
    } satisfies LogsResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
