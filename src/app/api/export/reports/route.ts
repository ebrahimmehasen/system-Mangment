import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getReportsData } from "@/lib/reports/data";
import { reportsToTables } from "@/lib/reports/tables";
import { getAdvancedFinancials, advancedToTables } from "@/lib/reports/advanced";
import { buildWorkbook } from "@/lib/export/excel";
import { buildCsv } from "@/lib/export/csv";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams;
  const format = q.get("format") === "csv" ? "csv" : "xlsx";
  const section = q.get("section") ?? "all";

  const dateParams = {
    range: q.get("range") ?? undefined,
    from: q.get("from") ?? undefined,
    to: q.get("to") ?? undefined,
  };

  const [data, advanced] = await Promise.all([
    getReportsData({
      ...dateParams,
      csort: q.get("csort") ?? undefined,
      cdir: q.get("cdir") ?? undefined,
      psort: q.get("psort") ?? undefined,
      pdir: q.get("pdir") ?? undefined,
      pq: q.get("pq") ?? undefined,
    }),
    getAdvancedFinancials(dateParams),
  ]);

  const allTables = [...reportsToTables(data), ...advancedToTables(advanced)];
  const tables =
    section === "all" ? allTables : allTables.filter((t) => t.key === section);
  if (tables.length === 0) {
    return NextResponse.json({ error: "تقرير غير معروف" }, { status: 400 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const base = section === "all" ? "reports" : section;
  const period = data.range.label;

  if (format === "csv") {
    const csv = buildCsv(tables[0], [
      "404 Legends",
      tables[0].title,
      `الفترة: ${period}`,
    ]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}-${stamp}.csv"`,
      },
    });
  }

  const buffer = await buildWorkbook(
    { docTitle: "تقارير 404 Legends", period, generatedAt: new Date() },
    tables,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}-${stamp}.xlsx"`,
    },
  });
}
