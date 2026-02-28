import { NextRequest, NextResponse } from "next/server";

const DEV_ADMIN_COOKIE = "dev_admin";

export function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const url = new URL(request.url);
  const origin = url.origin;
  const res = NextResponse.redirect(new URL("/dashboard", origin));
  res.cookies.set(DEV_ADMIN_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24, // 24 h
    sameSite: "lax",
  });
  return res;
}
