/**
 * Seed script.
 * Phase 1: placeholder only. The real reference data
 * (expense categories, project statuses, payment methods) is seeded
 * in Phase 2 once those tables exist.
 */
async function main() {
  console.log("Seed: nothing to do in Phase 1.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
