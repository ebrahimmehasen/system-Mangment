import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApi } from "@/lib/api-auth";
import { createSignedUrl } from "@/lib/storage";

/**
 * Serve a project file through a short-lived signed URL.
 *   ?mode=download  -> forces a download
 *   (default)       -> opens inline (e.g. PDF in the browser)
 *
 * Admin-only — the employee portal doesn't expose project files (point 6
 * only shows assignment/commission info), so there's no legitimate
 * employee use case yet. The file is also checked to belong to the
 * project in the path. No permanent public URLs are ever exposed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id: projectId, fileId } = await params;

  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const file = await prisma.projectFile.findUnique({ where: { id: fileId } });
  if (!file || file.projectId !== projectId) {
    return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
  }

  const mode = request.nextUrl.searchParams.get("mode");
  const { data, error } = await createSignedUrl(
    file.storageKey,
    60,
    mode === "download" ? file.fileName : undefined,
  );
  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "تعذّر إنشاء رابط الوصول" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
