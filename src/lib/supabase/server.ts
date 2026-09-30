import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Cliente Supabase do servidor, cacheado por requisição: layout, páginas e
 * server actions compartilham a MESMA instância de cliente (e a mesma leitura
 * dos cookies) dentro de uma requisição. Evita reconstruir o cliente a cada
 * query e, junto com o `getUsuario` de actions/auth (leitura local da sessão),
 * mantém o middleware como o único ponto que valida/renova o token — o que
 * elimina os refreshs concorrentes responsáveis pelas falhas intermitentes no
 * deploy na Vercel.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de um Server Component: o middleware renova a sessão.
          }
        },
      },
    },
  );
});
