import { NextResponse } from "next/server";

const DEV_ADMIN_COOKIE = "dev_admin";

export function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ user: null });
  }
  const cookie = request.headers.get("cookie") ?? "";
  const hasDevAdmin = cookie.includes(`${DEV_ADMIN_COOKIE}=1`);
  if (!hasDevAdmin) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      id: "dev-admin",
      email: "admin@local.dev",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    },
  });
}
