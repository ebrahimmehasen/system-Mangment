import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "status_changed"
  | "file_uploaded"
  | "file_deleted"
  | "payment_created"
  | "expense_created"
  | "expense_deleted";

interface AuditInput {
  userId: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
}

/**
 * Append an audit-log row. Audit logs are never updated or deleted.
 * Pass a Prisma transaction client as `tx` to record inside the same
 * atomic transaction as the change it describes.
 */
export async function writeAuditLog(
  input: AuditInput,
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      oldValue: input.oldValue ?? undefined,
      newValue: input.newValue ?? undefined,
    },
  });
}
