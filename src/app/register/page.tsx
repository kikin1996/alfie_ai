"use client";

import { redirect } from "next/navigation";

// Registrace probíhá automaticky přes Google OAuth – přesměruj na přihlášení
export default function RegisterPage() {
  redirect("/login");
}
