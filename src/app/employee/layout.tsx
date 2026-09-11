import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { EmployeePortalHeader } from "@/components/layout/EmployeePortalHeader";

export default async function EmployeePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // Admins belong in the real admin panel, not here.
  if (user.role === "admin") redirect("/dashboard");

  const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
  // Defensive: an employee-role login not linked to an Employee record
  // shouldn't be possible via createEmployeeLoginAction, but don't crash if
  // it somehow happens.
  if (!employee) redirect("/employee-pending");

  return (
    <div className="flex min-h-screen w-full flex-col">
      <EmployeePortalHeader employeeName={employee.name} />
      <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
    </div>
  );
}
