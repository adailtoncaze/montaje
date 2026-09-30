import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // `getUser()` valida o token no servidor do Supabase (autoritativo). Em
  // intranets o acesso ao Supabase pode falhar de forma intermitente; quando
  // isso acontece, em vez de derrubar sessões válidas para o /login, caímos
  // na `getSession()` (leitura local dos cookies). As páginas protegidas
  // continuam validando com `getUser()` via `requireAuth`/`getPerfil`.
  let user = null;
  try {
    const {
      data: { user: usuario },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    user = usuario;
  } catch {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    user = session?.user ?? null;
  }

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/painel";
    return NextResponse.redirect(url);
  }

  return response;
}
