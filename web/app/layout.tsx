import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "M1 Trainer",
  description: "Ontario M1 motorcycle licence practice tests",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
