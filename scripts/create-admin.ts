import { createAuth, isAdminEmail } from "../lib/auth";
async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password || !isAdminEmail(email))
    throw new Error(
      "Set an allowlisted ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD in your local environment.",
    );
  await createAuth(true).api.signUpEmail({
    body: { email, password, name: "Store administrator" },
  });
  console.log(
    "Administrator created. Remove the bootstrap password from your environment.",
  );
}
main().catch(() => {
  console.error(
    "Account creation failed. Verify the environment, allowlist, password length, and whether the account already exists.",
  );
  process.exitCode = 1;
});
