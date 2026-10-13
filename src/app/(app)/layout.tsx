import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return <AppShell>{children}</AppShell>;
}
