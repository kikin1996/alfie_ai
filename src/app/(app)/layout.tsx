"use client";

import Navbar from "@/components/Navbar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container py-8">{children}</main>
    </div>
  );
}
