import { PageContent } from "@/components/layout/page-header";
import { listarEquipes } from "@/lib/actions/equipes";
import { listarColaboradores } from "@/lib/actions/colaboradores";
import { getPerfil } from "@/lib/actions/auth";
import { EquipesClient } from "./equipes-client";

export default async function EquipesPage() {
  const [equipes, colaboradores, perfil] = await Promise.all([
    listarEquipes(),
    listarColaboradores(),
    getPerfil(),
  ]);
  const isAdmin = perfil?.perfil === "admin";

  return (
    <PageContent>
      <EquipesClient
        equipes={equipes}
        colaboradores={colaboradores}
        isAdmin={isAdmin}
      />
    </PageContent>
  );
}