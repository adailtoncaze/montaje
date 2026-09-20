import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { NOME_SISTEMA } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: NOME_SISTEMA,
    template: `%s · ${NOME_SISTEMA}`,
  },
  description:
    "Cronograma de montagem e recolhimento eleitoral, com acompanhamento em tempo real.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#444791",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
