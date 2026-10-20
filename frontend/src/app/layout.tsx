import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Surya Sangam - Dynamic Quotation Filler",
  description: "Dynamic Quotation Template Filler & PDF Generator for Surya Sangam",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
