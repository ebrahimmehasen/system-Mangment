import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ clients: [], projects: [] });
  }

  const contains = { contains: q, mode: "insensitive" as const };

  const [clients, projects] = await Promise.all([
    prisma.client.findMany({
      where: {
        OR: [{ name: contains }, { companyName: contains }, { phone: contains }, { email: contains }],
      },
      select: { id: true, name: true, companyName: true },
      take: 6,
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: { name: contains },
      select: { id: true, name: true, client: { select: { name: true } } },
      take: 6,
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      sub: c.companyName ?? "",
    })),
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      sub: p.client.name,
    })),
  });
}
