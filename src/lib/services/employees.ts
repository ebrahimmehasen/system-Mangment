export interface EmployeeFormValues {
  name: string;
  age: string;
  country: string;
  governorate: string;
  phone: string;
  qualification: string;
  notes: string;
  status: "active" | "inactive";
}

export interface EmployeeParsed {
  age: number | null;
}

export function parseEmployeeForm(formData: FormData): {
  values: EmployeeFormValues;
  errors: Partial<Record<keyof EmployeeFormValues, string>>;
  parsed: EmployeeParsed;
} {
  const values: EmployeeFormValues = {
    name: String(formData.get("name") ?? "").trim(),
    age: String(formData.get("age") ?? "").trim(),
    country: String(formData.get("country") ?? "").trim(),
    governorate: String(formData.get("governorate") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    qualification: String(formData.get("qualification") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    status: formData.get("status") === "inactive" ? "inactive" : "active",
  };

  const errors: Partial<Record<keyof EmployeeFormValues, string>> = {};

  if (!values.name) errors.name = "اسم الموظف مطلوب.";
  else if (values.name.length > 200) errors.name = "الاسم طويل جدًا.";

  let age: number | null = null;
  if (values.age) {
    const n = Number(values.age);
    if (!Number.isInteger(n) || n < 16 || n > 99) {
      errors.age = "أدخل عمرًا صحيحًا (16–99).";
    } else {
      age = n;
    }
  }

  if (values.phone && values.phone.length > 40) {
    errors.phone = "رقم الهاتف غير صحيح.";
  }

  return { values, errors, parsed: { age } };
}

/** Fields shared by create and update (CV fields handled separately). */
export function toEmployeeData(v: EmployeeFormValues, age: number | null) {
  return {
    name: v.name,
    age,
    country: v.country || null,
    governorate: v.governorate || null,
    phone: v.phone || null,
    qualification: v.qualification || null,
    notes: v.notes || null,
    status: v.status,
  };
}
