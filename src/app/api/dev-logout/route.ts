import { NextResponse } from "next/server";

const DEV_ADMIN_COOKIE = "dev_admin";

export function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
