import { PageContent } from "@/components/layout/page-header";
import { listarColaboradores, listarFuncoes } from "@/lib/actions/colaboradores";
import { getPerfil } from "@/lib/actions/auth";
import { ColaboradoresClient } from "./colaboradores-client";

export default async function ColaboradoresPage() {
  const [colaboradores, funcoes, perfil] = await Promise.all([
    listarColaboradores(),
    listarFuncoes(),
    getPerfil(),
  ]);
  const isAdmin = perfil?.perfil === "admin";

  return (
    <PageContent>
      <ColaboradoresClient
        colaboradores={colaboradores}
        funcoes={funcoes}
        isAdmin={isAdmin}
      />
    </PageContent>
  );
}