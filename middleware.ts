import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, sessionToken, timingSafeEqual } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/login") return NextResponse.next();
  const expected = await sessionToken();
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Configuración incompleta: define APP_PASSWORD para proteger la aplicación.", { status: 503 });
    }
    return NextResponse.next(); // desarrollo local sin contraseña
  }
  const got = req.cookies.get(COOKIE)?.value ?? "";
  if (timingSafeEqual(got, expected)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
