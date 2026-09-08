import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { EMPLOYEE_CVS_BUCKET, createSignedUrl } from "@/lib/storage";

/**
 * Serve an employee's CV through a short-lived signed URL.
 *   ?mode=download  -> forces a download
 *   (default)       -> opens inline
 *
 * Every request is authenticated. No permanent public URLs are exposed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { cvStorageKey: true, cvFileName: true },
  });
  if (!employee?.cvStorageKey) {
    return NextResponse.json({ error: "لا توجد سيرة ذاتية" }, { status: 404 });
  }

  const mode = request.nextUrl.searchParams.get("mode");
  const { data, error } = await createSignedUrl(
    employee.cvStorageKey,
    60,
    mode === "download" ? (employee.cvFileName ?? "cv") : undefined,
    EMPLOYEE_CVS_BUCKET,
  );
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "تعذّر إنشاء رابط الوصول" }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
