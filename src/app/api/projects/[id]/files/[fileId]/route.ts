import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { createSignedUrl } from "@/lib/storage";

/**
 * Serve a project file through a short-lived signed URL.
 *   ?mode=download  -> forces a download
 *   (default)       -> opens inline (e.g. PDF in the browser)
 *
 * Every request is authenticated and the file is checked to belong to
 * the project in the path. No permanent public URLs are ever exposed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id: projectId, fileId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

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
