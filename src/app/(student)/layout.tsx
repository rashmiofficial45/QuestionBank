import { Shell } from "@/components/shell";

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return <Shell privateAdmin={process.env.ENABLE_PRIVATE_ADMIN === "1"}>{children}</Shell>;
}
