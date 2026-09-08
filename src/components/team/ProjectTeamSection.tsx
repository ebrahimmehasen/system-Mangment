"use client";

import { useActionState, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  assignToProjectAction,
  removeAssignmentAction,
  type AssignmentActionState,
} from "@/server/assignment-actions";

interface Person {
  id: string;
  name: string;
}
export interface TeamMember {
  id: string;
  role: "employee" | "supervisor";
  name: string;
  assignedAt: string;
}

const ROLE_LABEL: Record<TeamMember["role"], string> = {
  employee: "موظف",
  supervisor: "مشرف",
};

export function ProjectTeamSection({
  projectId,
  assignments,
  employeeOptions,
  userOptions,
}: {
  projectId: string;
  assignments: TeamMember[];
  employeeOptions: Person[];
  userOptions: Person[];
}) {
  const action = assignToProjectAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState<
    AssignmentActionState,
    FormData
  >(action, {});

  return (
    <Card className="p-0">
      <div className="border-b border-border p-4">
        <h2 className="mb-3 text-base font-semibold">
          فريق المشروع ({assignments.length})
        </h2>
        {/* remount on every submit so both selects reset cleanly */}
        <AddMemberForm
          key={`${state.success ?? ""}|${state.error ?? ""}|${assignments.length}`}
          formAction={formAction}
          pending={pending}
          employeeOptions={employeeOptions}
          userOptions={userOptions}
        />
        {state.error && (
          <p className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="mt-2 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
            {state.success}
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-right text-foreground-muted">
              <th className="px-4 py-3 font-medium">الاسم</th>
              <th className="px-4 py-3 font-medium">الدور</th>
              <th className="px-4 py-3 font-medium">تاريخ التعيين</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-foreground-muted"
                >
                  لا يوجد أعضاء في الفريق بعد.
                </td>
              </tr>
            )}
            {assignments.map((a) => (
              <AssignmentRow key={a.id} assignment={a} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AddMemberForm({
  formAction,
  pending,
  employeeOptions,
  userOptions,
}: {
  formAction: (formData: FormData) => void;
  pending: boolean;
  employeeOptions: Person[];
  userOptions: Person[];
}) {
  const [role, setRole] = useState<"employee" | "supervisor">("employee");
  const people = role === "employee" ? employeeOptions : userOptions;
  const selectCls =
    "rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50";

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <select
        name="role"
        value={role}
        onChange={(e) => setRole(e.target.value as "employee" | "supervisor")}
        className={selectCls}
      >
        <option value="employee">موظف</option>
        <option value="supervisor">مشرف</option>
      </select>
      <select name="personId" defaultValue="" className={selectCls} required>
        <option value="" disabled>
          {role === "employee" ? "اختر موظفًا…" : "اختر مشرفًا…"}
        </option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "جارٍ الإضافة…" : "+ إضافة"}
      </Button>
    </form>
  );
}

function AssignmentRow({ assignment }: { assignment: TeamMember }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dateFmt = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" });

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await removeAssignmentAction(assignment.id);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="px-4 py-3">{assignment.name}</td>
      <td className="px-4 py-3">
        <Badge tone={assignment.role === "supervisor" ? "accent" : "neutral"}>
          {ROLE_LABEL[assignment.role]}
        </Badge>
      </td>
      <td className="px-4 py-3 text-foreground-muted">
        {dateFmt.format(new Date(assignment.assignedAt))}
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="text-danger hover:underline disabled:opacity-50"
        >
          {pending ? "…" : "إزالة"}
        </button>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </td>
    </tr>
  );
}
