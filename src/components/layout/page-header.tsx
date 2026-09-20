/** Conteúdo da página: largura total com padding responsivo. */
export function PageContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full px-4 py-6 md:px-6">
      {children}
    </div>
  );
}