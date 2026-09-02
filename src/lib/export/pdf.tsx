import "server-only";

import fs from "node:fs";
import path from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReportTable } from "@/lib/reports/tables";

const ASSET_DIR = path.join(process.cwd(), "src/lib/export");
const FONT_DIR = path.join(ASSET_DIR, "fonts");
const IMG_DIR = path.join(ASSET_DIR, "assets");

/** react-pdf reliably embeds images from an in-memory buffer, not a bare fs path. */
const pngSrc = (file: string) => ({
  data: fs.readFileSync(path.join(IMG_DIR, file)),
  format: "png" as const,
});
let MARK: { data: Buffer; format: "png" };
let WATERMARK: { data: Buffer; format: "png" };

const BRAND = "#1546c8";
const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const HEAD_BG = "#eef3ff";
const ZEBRA = "#f8fafc";

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
  MARK = pngSrc("mark.png");
  WATERMARK = pngSrc("mark-watermark.png");
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
    color: INK,
    backgroundColor: "#ffffff",
    paddingTop: 96,
    paddingBottom: 56,
    paddingHorizontal: 40,
    direction: "rtl",
  },

  /* faint centered logo behind the content */
  watermark: {
    position: "absolute",
    top: 250,
    left: 130,
    width: 340,
    height: 340,
    opacity: 0.06,
  },

  /* fixed header band */
  header: {
    position: "absolute",
    top: 28,
    left: 40,
    right: 40,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
  },
  brandRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  brandMark: { width: 30, height: 30 },
  brandText: { alignItems: "flex-end" },
  brandName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
    letterSpacing: 1.5,
    color: INK,
  },
  brandNameBlue: { color: BRAND },
  brandTag: {
    fontFamily: "Helvetica",
    fontSize: 6,
    letterSpacing: 2,
    color: MUTED,
    marginTop: 2,
  },
  headerMeta: { alignItems: "flex-start" },
  headerMetaLine: { fontSize: 8, color: MUTED },

  /* document title block */
  titleBlock: { marginBottom: 16 },
  docTitle: { fontSize: 15, fontWeight: "bold", color: BRAND, textAlign: "right" },
  docSub: { fontSize: 9, color: MUTED, marginTop: 3, textAlign: "right" },

  tableTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: INK,
    marginTop: 16,
    marginBottom: 6,
    textAlign: "right",
  },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 3 },
  row: { flexDirection: "row" },
  headRow: { backgroundColor: HEAD_BG },
  zebraRow: { backgroundColor: ZEBRA },
  cell: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 7,
    fontSize: 9,
    textAlign: "right",
    borderRightWidth: 1,
    borderRightColor: LINE,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  lastCell: { borderRightWidth: 0 },
  headCell: { fontWeight: "bold", color: BRAND },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 6,
    fontSize: 7,
    color: MUTED,
  },
});

function Header({ meta, stamp }: { meta: PdfMeta; stamp: string }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.brandRow}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={MARK} style={styles.brandMark} />
        <View style={styles.brandText}>
          <Text style={styles.brandName}>
            404 <Text style={styles.brandNameBlue}>LEGENDS</Text>
          </Text>
          <Text style={styles.brandTag}>PREMIUM SOFTWARE SOLUTIONS</Text>
        </View>
      </View>
      <View style={styles.headerMeta}>
        <Text style={styles.headerMetaLine}>{meta.docTitle}</Text>
        <Text style={styles.headerMetaLine}>{stamp}</Text>
      </View>
    </View>
  );
}

function Table({ table }: { table: ReportTable }) {
  const last = table.columns.length - 1;
  return (
    <View wrap={false}>
      <Text style={styles.tableTitle}>{table.title}</Text>
      <View style={styles.table}>
        <View style={[styles.row, styles.headRow]}>
          {table.columns.map((c, i) => (
            <Text
              key={i}
              style={[
                styles.cell,
                styles.headCell,
                ...(i === last ? [styles.lastCell] : []),
              ]}
            >
              {c}
            </Text>
          ))}
        </View>
        {table.rows.map((r, ri) => (
          <View
            key={ri}
            style={[styles.row, ...(ri % 2 === 1 ? [styles.zebraRow] : [])]}
          >
            {r.map((cell, ci) => (
              <Text
                key={ci}
                style={[
                  styles.cell,
                  ...(ci === last ? [styles.lastCell] : []),
                ]}
              >
                {String(cell)}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function ReportsDocument({ meta, tables }: { meta: PdfMeta; tables: ReportTable[] }) {
  const d = meta.generatedAt;
  const p2 = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

  return (
    <Document
      title={meta.docTitle}
      author="404 Legends"
      creator="404 Legends"
      producer="404 Legends"
    >
      <Page size="A4" style={styles.page}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={WATERMARK} style={styles.watermark} fixed />
        <Header meta={meta} stamp={stamp} />

        <View style={styles.titleBlock}>
          <Text style={styles.docTitle}>{meta.docTitle}</Text>
          <Text style={styles.docSub}>الفترة: {meta.period}</Text>
          <Text style={styles.docSub}>تاريخ التصدير: {stamp}</Text>
        </View>

        {tables.map((t) => (
          <Table key={t.key} table={t} />
        ))}

        <View style={styles.footer} fixed>
          <Text>404 Legends — Where 404 Becomes Legend</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

/** Build a branded PDF buffer of the given report tables, RTL, Arabic. */
export async function buildReportsPdf(
  meta: PdfMeta,
  tables: ReportTable[],
): Promise<Buffer> {
  ensureFonts();
  return renderToBuffer(<ReportsDocument meta={meta} tables={tables} />);
}
