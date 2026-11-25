import { Shell } from "@/components/shell";
import { requireAdmin } from "@/modules/imports";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <Shell admin>{children}</Shell>;
}
