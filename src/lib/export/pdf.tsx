import "server-only";

import path from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReportTable } from "@/lib/reports/tables";

const FONT_DIR = path.join(process.cwd(), "src/lib/export/fonts");

let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  Font.register({
    family: "Amiri",
    fonts: [
      { src: path.join(FONT_DIR, "Amiri-Regular.ttf") },
      { src: path.join(FONT_DIR, "Amiri-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  // Arabic must never be hyphenated / split mid-word.
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

export interface PdfMeta {
  docTitle: string;
  period: string;
  generatedAt: Date;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    fontSize: 10,
    color: "#111827",
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 36,
    direction: "rtl",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#1546c8",
    paddingBottom: 8,
    marginBottom: 18,
  },
  brand: { fontSize: 16, fontWeight: "bold", color: "#1546c8", textAlign: "right" },
  docTitle: { fontSize: 12, marginTop: 2, textAlign: "right" },
  meta: { fontSize: 9, color: "#6b7280", marginTop: 2, textAlign: "right" },
  tableTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 6,
    textAlign: "right",
  },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  headRow: { backgroundColor: "#eef2ff" },
  cell: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 6,
    textAlign: "right",
  },
  headCell: { fontWeight: "bold" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
  },
});

function Table({ table }: { table: ReportTable }) {
  return (
    <View wrap={false}>
      <Text style={styles.tableTitle}>{table.title}</Text>
      <View>
        <View style={[styles.row, styles.headRow]}>
          {table.columns.map((c, i) => (
            <Text key={i} style={[styles.cell, styles.headCell]}>
              {c}
            </Text>
          ))}
        </View>
        {table.rows.map((r, ri) => (
          <View key={ri} style={styles.row}>
            {r.map((cell, ci) => (
              <Text key={ci} style={styles.cell}>
                {String(cell)}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function ReportsDocument({
  meta,
  tables,
}: {
  meta: PdfMeta;
  tables: ReportTable[];
}) {
  // Plain LTR stamp — mixing Arabic-Indic digits + separators with RTL
  // text confuses the bidi pass and scrambles the date visually.
  const d = meta.generatedAt;
  const p2 = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

  return (
    <Document title={meta.docTitle}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.brand}>404 Legends</Text>
          <Text style={styles.docTitle}>{meta.docTitle}</Text>
          <Text style={styles.meta}>الفترة: {meta.period}</Text>
          <Text style={styles.meta}>تاريخ التصدير: {stamp}</Text>
        </View>

        {tables.map((t) => (
          <Table key={t.key} table={t} />
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

/** Build a PDF buffer of the given report tables, RTL, Arabic. */
export async function buildReportsPdf(
  meta: PdfMeta,
  tables: ReportTable[],
): Promise<Buffer> {
  ensureFonts();
  return renderToBuffer(<ReportsDocument meta={meta} tables={tables} />);
}
