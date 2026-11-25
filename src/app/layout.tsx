import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Study Atlas · Question Bank", template: "%s · Study Atlas" },
  description: "A focused question bank and practice workspace for civil services preparation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={GeistSans.variable} suppressHydrationWarning><body>{children}</body></html>;
}
