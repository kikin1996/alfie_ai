import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Renote",
  description: "Automatizace prohlídek nemovitostí – kalendář, SMS, hovory",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
