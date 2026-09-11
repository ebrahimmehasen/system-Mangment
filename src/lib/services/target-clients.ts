import { Prisma } from "@prisma/client";

export const COMPANY_SIZE_OPTIONS = [
  "صغيرة (1-10 موظفين)",
  "متوسطة (11-50 موظف)",
  "كبيرة (50+ موظف)",
] as const;
export const COMPANY_SIZE_OTHER = "أخرى";

export const TARGET_CLIENT_STATUS_LABELS: Record<string, string> = {
  available: "متاح",
  claimed: "شغال عليه",
  won: "نجح",
  lost: "فشل",
  inactive: "معطّل",
};

export interface TargetClientFormValues {
  companyName: string;
  phones: string; // comma/newline-separated in the form, stored as string[]
  facebook: string;
  instagram: string;
  whatsapp: string;
  website: string;
  companySize: string;
  companySizeOther: string;
  script: string;
  notes: string;
}

export interface TargetClientParsed {
  contactPhones: string[];
  socialLinks: Record<string, string> | null;
  companySize: string | null;
}

/** Shared list filter for the /target-clients page. */
export function targetClientListWhere(
  q: string,
  status: string | undefined,
): Prisma.TargetClientWhereInput {
  const term = q.trim();
  return {
    ...(status ? { status: status as never } : {}),
    ...(term
      ? {
          OR: [
            { companyName: { contains: term, mode: "insensitive" } },
            { website: { contains: term, mode: "insensitive" } },
            { notes: { contains: term, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export function parseTargetClientForm(formData: FormData): {
  values: TargetClientFormValues;
  errors: Partial<Record<keyof TargetClientFormValues, string>>;
  parsed: TargetClientParsed;
} {
  const values: TargetClientFormValues = {
    companyName: String(formData.get("companyName") ?? "").trim(),
    phones: String(formData.get("phones") ?? "").trim(),
    facebook: String(formData.get("facebook") ?? "").trim(),
    instagram: String(formData.get("instagram") ?? "").trim(),
    whatsapp: String(formData.get("whatsapp") ?? "").trim(),
    website: String(formData.get("website") ?? "").trim(),
    companySize: String(formData.get("companySize") ?? "").trim(),
    companySizeOther: String(formData.get("companySizeOther") ?? "").trim(),
    script: String(formData.get("script") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };

  const errors: Partial<Record<keyof TargetClientFormValues, string>> = {};

  if (!values.companyName) errors.companyName = "اسم الشركة مطلوب.";
  else if (values.companyName.length > 200) errors.companyName = "الاسم طويل جدًا.";

  if (values.companySize === COMPANY_SIZE_OTHER && !values.companySizeOther) {
    errors.companySizeOther = 'حدد حجم الشركة لما تختار "أخرى".';
  }

  const contactPhones = values.phones
    ? values.phones
        .split(/[,\n]/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  const socialLinksEntries = Object.entries({
    facebook: values.facebook,
    instagram: values.instagram,
    whatsapp: values.whatsapp,
  }).filter(([, v]) => v);
  const socialLinks = socialLinksEntries.length
    ? Object.fromEntries(socialLinksEntries)
    : null;

  const companySize =
    values.companySize === COMPANY_SIZE_OTHER
      ? values.companySizeOther || null
      : values.companySize || null;

  return { values, errors, parsed: { contactPhones, socialLinks, companySize } };
}

export function toTargetClientData(v: TargetClientFormValues, p: TargetClientParsed) {
  return {
    companyName: v.companyName,
    contactPhones: p.contactPhones,
    socialLinks: p.socialLinks ?? Prisma.JsonNull,
    website: v.website || null,
    companySize: p.companySize,
    script: v.script || null,
    notes: v.notes || null,
  };
}
