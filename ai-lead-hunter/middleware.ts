import { NextRequest, NextResponse } from "next/server";
// Optional private-workspace gate. Configure APP_PASSWORD before a public deploy
// with paid API keys. Credentials must only travel over HTTPS outside localhost.
export function middleware(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const header = request.headers.get("authorization") ?? "";
  let supplied = "";
  try {
    if (header.startsWith("Basic ")) {
      const bytes = Uint8Array.from(atob(header.slice(6)), (char) =>
        char.charCodeAt(0),
      );
      supplied = new TextDecoder().decode(bytes).split(":").slice(1).join(":");
    }
  } catch {
    /* invalid auth */
  }
  if (supplied.length === password.length) {
    let difference = 0;
    for (let i = 0; i < password.length; i++)
      difference |= supplied.charCodeAt(i) ^ password.charCodeAt(i);
    if (!difference) return NextResponse.next();
  }
  return new NextResponse("Потрібен пароль робочого простору.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="AI Lead Hunter", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
