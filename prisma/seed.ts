/**
 * Seed reference data (نقطة 2).
 * Idempotent: safe to run repeatedly (upsert by unique name).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EXPENSE_CATEGORIES = [
  "Salaries",
  "Hosting",
  "Domains",
  "Software",
  "Marketing",
  "Office",
  "Equipment",
  "Transportation",
  "Contractors",
  "Other",
];

const PROJECT_STATUSES = [
  "Planning",
  "Pending",
  "In Progress",
  "On Hold",
  "Testing",
  "Ready for Delivery",
  "Delivered",
  "Completed",
  "Cancelled",
];

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Wallet", "Card", "Other"];

async function main() {
  for (const name of EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { name },
      update: { isDefault: true },
      create: { name, isDefault: true },
    });
  }

  for (let i = 0; i < PROJECT_STATUSES.length; i++) {
    const name = PROJECT_STATUSES[i];
    await prisma.projectStatus.upsert({
      where: { name },
      update: { sortOrder: i, isDefault: name === "Planning" },
      create: { name, sortOrder: i, isDefault: name === "Planning" },
    });
  }

  for (let i = 0; i < PAYMENT_METHODS.length; i++) {
    const name = PAYMENT_METHODS[i];
    await prisma.paymentMethod.upsert({
      where: { name },
      update: { sortOrder: i },
      create: { name, sortOrder: i },
    });
  }

  const counts = {
    expenseCategories: await prisma.expenseCategory.count(),
    projectStatuses: await prisma.projectStatus.count(),
    paymentMethods: await prisma.paymentMethod.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
