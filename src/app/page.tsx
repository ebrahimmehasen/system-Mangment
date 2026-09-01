import { redirect } from "next/navigation";

// The middleware already gates everything; a signed-in user hitting "/"
// should land on the dashboard, otherwise on /login.
export default function Home() {
  redirect("/dashboard");
}
