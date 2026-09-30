import { AuthRetryableFetchError } from "@supabase/supabase-js";
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

  // `getUser()` valida o token no servidor do Supabase (autoritativo) e, se o
  // access token estiver perto de expirar, renova a sessÃ£o â€” gravando os
  // cookies novos via `setAll`. Este Ã© o ÃšNICO ponto de refresh da aplicaÃ§Ã£o:
  // as pÃ¡ginas leem a sessÃ£o localmente (`getSession`), sem nova chamada de
  // rede, evitando refreshs concorrentes (o refresh token Ã© de uso Ãºnico).
  //
  // Antes, layout/pÃ¡ginas tambÃ©m chamavam `getUser()`. Em deploys na Vercel,
  // requisiÃ§Ãµes paralelas (ex.: prefetch de rotas do App Router) com um token
  // vencido disputavam o mesmo refresh token: a primeira queimava o token e a
  // segunda falhava â€” e a sessÃ£o aparecia inexistente naquela requisiÃ§Ã£o, as
  // queries do /painel caÃ­am no RLS e a pÃ¡gina exibia o erro intermitente
  // "Ops, algo deu errado", que sumia sÃ³ com um refresh manual.
  let user = null;
  try {
    const {
      data: { user: usuario },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    user = usuario;
  } catch (erro) {
    // `instanceof` cobre o caso normal; a checagem por `name` protege caso o
    // bundler duplique o mÃ³dulo do SDK no bundle do middleware (Edge).
    const ehFalhaDeRede =
      erro instanceof AuthRetryableFetchError ||
      (typeof erro === "object" &&
        erro !== null &&
        (erro as { name?: string }).name === "AuthRetryableFetchError");

    // SÃ³ falha de REDE (fetch/timeout) aceita cair de volta na sessÃ£o local:
    // uma sessÃ£o vÃ¡lida nÃ£o pode ser derrubada por problema transitÃ³rio de
    // conexÃ£o (intranet, cold start). Erros de AUTH (refresh token queimado
    // ou expirado, JWT invÃ¡lido) significam que a sessÃ£o realmente nÃ£o vale
    // mais â€” tratamos como deslogado: o /login reapresenta a entrada e, se um
    // request paralelo jÃ¡ rotacionou os cookies, o middleware volta a
    // enxergar a sessÃ£o e redireciona de volta ao /painel (auto-recuperaÃ§Ã£o).
    if (ehFalhaDeRede) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        // SÃ³ segue com a sessÃ£o dos cookies se o access token ainda estiver
        // dentro do perÃ­odo de validade real â€” senÃ£o a requisiÃ§Ã£o chegaria Ã s
        // queries jÃ¡ com um token vencido e quebraria a pÃ¡gina.
        const expiraEm = session?.expires_at ?? 0;
        const aindaValido = expiraEm > Math.floor(Date.now() / 1000);
        user = aindaValido && session ? session.user : null;
      } catch {
        // `getSession()` tambÃ©m tentou renovar (token no limiar) e a rede
        // falhou de novo: sem rede nÃ£o hÃ¡ como validar â€” segue deslogado.
        user = null;
      }
    }
  }

  const isPublic = PUBLIC_PATHS.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );

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
