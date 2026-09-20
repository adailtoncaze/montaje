import { Rail } from "@/components/layout/rail";
import { TopBar } from "@/components/layout/top-bar";
import { getPerfil } from "@/lib/actions/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await getPerfil();
  const isAdmin = perfil?.perfil === "admin";

  return (
    <div className="min-h-dvh">
      <Rail isAdmin={isAdmin} />
      <div className="pb-[calc(var(--bottom-bar-height)+env(safe-area-inset-bottom))] md:pb-0 md:pl-(--rail-width)">
        <TopBar nome={perfil?.nome ?? null} />
        {children}
      </div>
    </div>
  );
}