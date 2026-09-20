import { PageContent } from "@/components/layout/page-header";
import { listarLocais } from "@/lib/actions/locais";
import { getPerfil } from "@/lib/actions/auth";
import { LocaisClient } from "./locais-client";

export default async function LocaisPage() {
  const [locais, perfil] = await Promise.all([listarLocais(), getPerfil()]);
  const isAdmin = perfil?.perfil === "admin";

  return (
    <PageContent>
      <LocaisClient locais={locais} isAdmin={isAdmin} />
    </PageContent>
  );
}