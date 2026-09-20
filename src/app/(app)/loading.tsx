export default function Loading() {
  return (
    <div className="flex h-[calc(100dvh-var(--header-height))] items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-fg-4">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        <span className="text-body">Carregando...</span>
      </div>
    </div>
  );
}