"use client";

/**
 * Geração de relatórios do cronograma (PDF e CSV).
 *
 * - Filtros e agrupamentos são funções puras (testáveis).
 * - PDF e CSV são gerados no navegador, sob demanda (import dinâmico de
 *   jspdf / jspdf-autotable), sem round-trip extra no servidor.
 */

import type { AtividadeCompleta } from "@/lib/actions/atividades";
import type { TipoAtividade } from "@/types/database";
import type { RowInput } from "jspdf-autotable";
import {
  STATUS_ATIVIDADE_LABEL,
  TIPO_ATIVIDADE_LABEL,
  TIPO_EQUIPE_LABEL,
} from "@/lib/constants";

/* ------------------------------------------------------------------ */
/*  Tipos públicos                                                     */
/* ------------------------------------------------------------------ */

export type AgruparPor = "equipe" | "dia";
export type TipoFiltro = TipoAtividade | "todas";
export type IdFiltro = string | "todas";

export interface FiltrosRelatorio {
  agruparPor: AgruparPor;
  tipo: TipoFiltro;
  equipeId: IdFiltro;
  municipio: IdFiltro;
  /** "YYYY-MM-DD" ou "" (sem limite). */
  dataInicio: string;
  dataFim: string;
}

export interface GrupoRelatorio {
  id: string;
  titulo: string;
  subtitulo?: string;
  atividades: AtividadeCompleta[];
}

export interface MetaRelatorio {
  ano: number;
  turno: number;
  zonaEleitoral: string;
}

/* ------------------------------------------------------------------ */
/*  Formatação                                                         */
/* ------------------------------------------------------------------ */

export function formatDataBr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

export function formatHora(iso: string): string {
  return iso.length >= 16 ? iso.slice(11, 16) : "";
}

export function formatSeq(n: number | null | undefined): string {
  return n == null ? "—" : String(n).padStart(3, "0");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formataTimestamp(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/* ------------------------------------------------------------------ */
/*  Filtro e agrupamento                                               */
/* ------------------------------------------------------------------ */

export function filtraAtividades(
  atividades: AtividadeCompleta[],
  f: FiltrosRelatorio
): AtividadeCompleta[] {
  return atividades
    .filter((a) => {
      if (f.tipo !== "todas" && a.tipo !== f.tipo) return false;
      if (f.equipeId !== "todas" && a.equipe_id !== f.equipeId) return false;
      if (f.municipio !== "todos" && a.local?.municipio !== f.municipio)
        return false;
      const dia = (a.data_hora_planejada ?? "").slice(0, 10);
      if (f.dataInicio && dia < f.dataInicio) return false;
      if (f.dataFim && dia > f.dataFim) return false;
      return true;
    })
    .sort((x, y) => {
      const d = (x.data_hora_planejada ?? "").localeCompare(
        y.data_hora_planejada ?? ""
      );
      if (d !== 0) return d;
      return (x.sequencia ?? 0) - (y.sequencia ?? 0);
    });
}

export function agrupaPorEquipe(
  lista: AtividadeCompleta[]
): GrupoRelatorio[] {
  const map = new Map<string, GrupoRelatorio>();
  for (const a of lista) {
    if (!a.equipe) continue;
    let g = map.get(a.equipe_id);
    if (!g) {
      g = {
        id: a.equipe_id,
        titulo: `Equipe: ${a.equipe.nome}`,
        subtitulo:
          TIPO_EQUIPE_LABEL[a.equipe.tipo as keyof typeof TIPO_EQUIPE_LABEL] ??
          a.equipe.tipo,
        atividades: [],
      };
      map.set(a.equipe_id, g);
    }
    g.atividades.push(a);
  }
  return [...map.values()].sort((x, y) => x.titulo.localeCompare(y.titulo));
}

export function agrupaPorDia(lista: AtividadeCompleta[]): GrupoRelatorio[] {
  const map = new Map<string, GrupoRelatorio>();
  for (const a of lista) {
    const dia = (a.data_hora_planejada ?? "").slice(0, 10);
    if (!dia) continue;
    let g = map.get(dia);
    if (!g) {
      g = { id: dia, titulo: `Dia: ${formatDataBr(dia)}`, atividades: [] };
      map.set(dia, g);
    }
    g.atividades.push(a);
  }
  return [...map.values()].sort((x, y) => x.id.localeCompare(y.id));
}

/* ------------------------------------------------------------------ */
/*  CSV                                                                */
/* ------------------------------------------------------------------ */

function csvEscape(v: string): string {
  const s = String(v ?? "");
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Monta o conteúdo CSV (separador ";", formato pt-BR). */
export function montaCsv(grupos: GrupoRelatorio[]): string {
  const headers = [
    "Seq.",
    "Local de votação",
    "Município",
    "Qtd. seções",
    "Tipo de atividade",
    "Data",
    "Hora",
    "Equipe",
    "LAT Origem",
    "Status",
    "Observações",
  ];
  const linhas: string[] = [headers.map(csvEscape).join(";")];
  for (const g of grupos) {
    for (const a of g.atividades) {
      linhas.push(
        [
          formatSeq(a.sequencia),
          a.local?.nome ?? "",
          a.local?.municipio ?? "",
          a.local ? String(a.local.qtd_secoes) : "",
          TIPO_ATIVIDADE_LABEL[a.tipo] ?? a.tipo,
          formatDataBr(a.data_hora_planejada),
          formatHora(a.data_hora_planejada),
          a.equipe?.nome ?? "",
          a.equipe?.lat_origem ?? "",
          STATUS_ATIVIDADE_LABEL[a.status] ?? a.status,
          a.observacoes ?? "",
        ]
          .map(csvEscape)
          .join(";")
      );
    }
  }
  return linhas.join("\r\n");
}

/* ------------------------------------------------------------------ */
/*  Download                                                           */
/* ------------------------------------------------------------------ */

export function baixarArquivo(
  conteudo: string,
  nomeArquivo: string,
  mime: string
): void {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugNome(titulo: string): string {
  return (
    titulo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "relatorio"
  );
}

/* ------------------------------------------------------------------ */
/*  PDF (jspdf + autotable, importados sob demanda)                    */
/* ------------------------------------------------------------------ */

const COR_PRIMARIA: [number, number, number] = [91, 95, 199];
const COR_BANDA: [number, number, number] = [230, 232, 248];
const COR_LINHA: [number, number, number] = [205, 205, 220];
const COR_TEXTO: [number, number, number] = [48, 48, 54];
const COR_MUTED: [number, number, number] = [108, 108, 120];
const COR_ALT: [number, number, number] = [246, 246, 251];

const LARG_COLS = [34, 218, 46, 132, 62, 46, 110, 134]; // soma = 782 (842-2*30)

export async function gerarPdfRelatorio(
  grupos: GrupoRelatorio[],
  meta: MetaRelatorio,
  emitidoEm: Date
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = 842;
  const M = 30;
  const N_COLS = 8;

  const head = [[
    "Seq.",
    "Local de votação",
    "Qtd.\nseções",
    "Tipo de atividade",
    "Data",
    "Hora",
    "Equipe(s)",
    "LAT Origem",
  ]];

  const turno = meta.turno === 2 ? "2º Turno" : "1º Turno";

  const desenharCabecalho = (grupo: GrupoRelatorio | null) => {
    // Faixa da marca no topo
    doc.setFillColor(...COR_PRIMARIA);
    doc.rect(0, 0, W, 3, "F");

    // Bloco da marca (M em bg primária)
    doc.setFillColor(...COR_PRIMARIA);
    doc.roundedRect(M, 26, 40, 42, 7, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(21);
    doc.setTextColor(255, 255, 255);
    doc.text("M", M + 20, 56, { align: "center" });

    // Órgãos
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...COR_MUTED);
    doc.text("Poder Judiciário", M + 52, 40);
    doc.text("Tribunal Regional Eleitoral da Paraíba", M + 52, 52);
    doc.text("MontaJE - Sistema Integrado de Distribuição de Urnas", M + 52, 64);

    // Eleições (à direita)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...COR_TEXTO);
    doc.text(`Eleições: ${meta.ano} · ${turno}`, W - M, 42, { align: "right" });

    // Título
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Cronograma de Distribuição de Urnas", W / 2, 84, {
      align: "center",
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...COR_MUTED);
    if (meta.zonaEleitoral) {
      doc.text(`Zona Eleitoral: ${meta.zonaEleitoral}`, W / 2, 100, {
        align: "center",
      });
    }

    // Grupo (equipe ou dia)
    if (grupo) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...COR_TEXTO);
      doc.text(grupo.titulo, M, 130);
      if (grupo.subtitulo) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...COR_MUTED);
        doc.text(grupo.subtitulo, M, 144);
      }
    }
  };

  const desenharRodape = () => {
    doc.setDrawColor(...COR_LINHA);
    doc.setLineWidth(0.5);
    doc.line(M, 566, W - M, 566);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COR_MUTED);
    doc.text(`MontaJE · Emitido em ${formataTimestamp(emitidoEm)}`, M, 578);
  };

  for (let gi = 0; gi < grupos.length; gi++) {
    const g = grupos[gi];
    if (gi > 0) doc.addPage();

    const body: RowInput[] = [];
    let munAtual = "";
    for (const a of g.atividades) {
      const mun = a.local?.municipio ?? "";
      if (mun !== munAtual) {
        body.push([
          {
            content: `Município - ${mun === "" ? "Não definido" : mun}`,
            colSpan: N_COLS,
            styles: {
              fillColor: COR_BANDA,
              textColor: [51, 55, 120],
              fontStyle: "bold",
            },
          },
        ]);
        munAtual = mun;
      }
      body.push([
        { content: formatSeq(a.sequencia), styles: { halign: "center" } },
        a.local?.nome ?? "—",
        {
          content: a.local ? String(a.local.qtd_secoes) : "—",
          styles: { halign: "center" },
        },
        TIPO_ATIVIDADE_LABEL[a.tipo] ?? a.tipo,
        { content: formatDataBr(a.data_hora_planejada), styles: { halign: "center" } },
        { content: formatHora(a.data_hora_planejada), styles: { halign: "center" } },
        a.equipe?.nome ?? "—",
        a.equipe?.lat_origem ?? "",
      ]);
    }

    autoTable(doc, {
      head,
      body,
      startY: 160,
      margin: { left: M, right: M },
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: COR_TEXTO,
        lineColor: COR_LINHA,
        lineWidth: 0.4,
      },
      headStyles: {
        fillColor: COR_PRIMARIA,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center" },
        2: { halign: "center" },
        4: { halign: "center" },
        5: { halign: "center" },
      },
      alternateRowStyles: { fillColor: COR_ALT },
      didDrawPage: () => {
        desenharCabecalho(g);
        desenharRodape();
      },
    });
  }

  // Numeração de páginas (após gerar todas)
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COR_MUTED);
    doc.text(`Página ${i} de ${total}`, W - M, 578, { align: "right" });
  }

  doc.save(nomeArquivoPdf(grupos, meta));
}

export function nomeArquivoPdf(grupos: GrupoRelatorio[], meta?: MetaRelatorio): string {
  const ts = new Date();
  const sufixo = `${ts.getFullYear()}${pad2(ts.getMonth() + 1)}${pad2(ts.getDate())}-${pad2(ts.getHours())}${pad2(ts.getMinutes())}`;
  if (grupos.length === 1) {
    return `Cronograma-${slugNome(grupos[0].titulo)}.pdf`;
  }
  return `CronogramaMontaJE-${meta ? `${meta.ano}-` : ""}${sufixo}.pdf`;
}

export function nomeArquivoCsv(grupos: GrupoRelatorio[], meta?: MetaRelatorio): string {
  const ts = new Date();
  const sufixo = `${ts.getFullYear()}${pad2(ts.getMonth() + 1)}${pad2(ts.getDate())}-${pad2(ts.getHours())}${pad2(ts.getMinutes())}${pad2(ts.getSeconds())}`;
  if (grupos.length === 1) {
    return `Relatorio-${slugNome(grupos[0].titulo)}.csv`;
  }
  return `RelatorioAtividades-${meta ? `${meta.ano}-` : ""}${sufixo}.csv`;
}