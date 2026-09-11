import { prisma } from "@/lib/db/prisma";

/** Everyone a meeting/reminder can be targeted at — admins and employees with a portal login. */
export async function getAssignableUsers() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true },
  });
  return users.map((u) => ({
    id: u.id,
    label: `${u.name || u.email}${u.role === "employee" ? " (موظف)" : ""}`,
  }));
}
