import { Prisma } from "@prisma/client";

export type Decimalish = Prisma.Decimal | number | string;

/** Sum a list of decimal-ish values, staying in Prisma.Decimal the whole way. */
export function sum(values: Decimalish[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (acc, v) => acc.plus(new Prisma.Decimal(v)),
    new Prisma.Decimal(0),
  );
}

export function toDecimal(v: Decimalish): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

/** Format an EGP amount for display, e.g. "٩٠٬٠٠٠٫٠٠ ج.م". */
const egpFmt = new Intl.NumberFormat("ar-EG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEgp(v: Decimalish): string {
  return `${egpFmt.format(new Prisma.Decimal(v).toNumber())} ج.م`;
}

/** Format an amount in an arbitrary currency (original amount display). */
export function formatCurrency(v: Decimalish, currency: string): string {
  return `${egpFmt.format(new Prisma.Decimal(v).toNumber())} ${currency}`;
}
