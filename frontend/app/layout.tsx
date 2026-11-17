import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ModelProvider } from "@/components/layout/ModelContext";

export const metadata: Metadata = {
  title: "ScanWatch — Know when your medical AI changes",
  description: "Educational medical AI observability prototype. Synthetic data only; not a clinical product.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ModelProvider>
          <AppShell>{children}</AppShell>
        </ModelProvider>
      </body>
    </html>
  );
}
