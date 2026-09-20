import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render?: (row: T, index: number) => ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  emptyMessage?: string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "Nenhum registro encontrado.",
  loading = false,
  onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="rounded-lg border border-stroke bg-surface p-8 text-center">
        <div className="mx-auto mb-2 size-6 animate-spin rounded-full border-2 border-stroke border-t-brand" />
        <p className="text-caption text-fg-4">Carregando…</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-stroke bg-surface p-8 text-center">
        <p className="text-body text-fg-3">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-stroke bg-surface">
      <table className="w-full text-left text-body">
        <thead>
          <tr className="border-b border-stroke bg-surface-subtle">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-2.5 text-caption font-semibold text-fg-2",
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={keyExtractor(row, i)}
              className={cn(
                "border-b border-stroke-subtle transition-colors duration-100",
                "last:border-b-0",
                onRowClick &&
                  "cursor-pointer hover:bg-surface-subtle active:bg-stroke",
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn("px-4 py-2.5 text-fg", col.className)}
                >
                  {col.render
                    ? col.render(row, i)
                    : String((row as Record<string, unknown>)[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
