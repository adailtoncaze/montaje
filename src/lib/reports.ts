"use client";

/**
 * Geração de relatórios do cronograma (PDF e CSV).
 *
 * - Filtros e agrupamentos são funções puras (testáveis).
 * - PDF e CSV são gerados no navegador, sob demanda (import dinâmico de
 *   jspdf / jspdf-autotable), sem round-trip extra no servidor.
 */

import type { AtividadeCompleta } from "@/lib/actions/atividades";
import type { MembroResumido } from "@/lib/actions/equipes";
import type { TipoAtividade } from "@/types/database";
import type { RowInput } from "jspdf-autotable";
import {
  STATUS_ATIVIDADE_LABEL,
  TIPO_ATIVIDADE_LABEL,
  TIPO_EQUIPE_LABEL,
} from "@/lib/constants";
import { LOGO_SVG } from "@/lib/logo-svg";

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
  membros?: MembroResumido[];
  atividades: AtividadeCompleta[];
}

export interface MetaRelatorio {
  ano: number;
  turno: number;
  zonaEleitoral: string;
  /** Rótulo do tipo de atividade filtrado ("" quando "Todas"). */
  tipoLabel: string;
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formataTimestamp(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatarDuracao(min: number): string {
  if (!Number.isFinite(min)) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

/** Intervalo início–fim e tempo total da atividade (p/ coluna Horário). */
function horarioAtividade(a: AtividadeCompleta): {
  intervalo: string;
  tempo: string;
} {
  const inicio = formatHora(a.data_hora_planejada);
  if (!inicio) return { intervalo: "", tempo: "" };

  let fim =
    a.fim_planejado && a.fim_planejado.length >= 5
      ? a.fim_planejado.slice(0, 5)
      : "";
  if (!fim && a.duracao_minutos != null) {
    const [h, m] = inicio.split(":").map(Number);
    const total = h * 60 + m + a.duracao_minutos;
    fim = `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
  }

  const intervalo = fim ? `${inicio} – ${fim}` : inicio;
  const tempo =
    a.duracao_minutos != null ? formatarDuracao(a.duracao_minutos) : "";
  return { intervalo, tempo };
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

function ordenarMembros(membros: MembroResumido[]): MembroResumido[] {
  return membros
    .slice()
    .sort((x, y) =>
      x.papel === y.papel
        ? x.nome.localeCompare(y.nome)
        : x.papel === "responsavel"
          ? -1
          : 1
    );
}

export function agrupaPorEquipe(
  lista: AtividadeCompleta[],
  membrosPorEquipe: Record<string, MembroResumido[]> = {}
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
        membros: ordenarMembros(membrosPorEquipe[a.equipe_id] ?? []),
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
    "Horário (início – fim)",
    "Tempo",
    "Equipe",
    "LAT Origem",
    "Status",
    "Observações",
  ];
  const linhas: string[] = [headers.map(csvEscape).join(";")];
  for (const g of grupos) {
    g.atividades.forEach((a, i) => {
      const hor = horarioAtividade(a);
      linhas.push(
        [
          String(i + 1),
          a.local?.nome ?? "",
          a.local?.municipio ?? "",
          a.local ? String(a.local.qtd_secoes) : "",
          TIPO_ATIVIDADE_LABEL[a.tipo] ?? a.tipo,
          formatDataBr(a.data_hora_planejada),
          hor.intervalo,
          hor.tempo,
          a.equipe?.nome ?? "",
          a.equipe?.lat_origem ?? "",
          STATUS_ATIVIDADE_LABEL[a.status] ?? a.status,
          a.observacoes ?? "",
        ]
          .map(csvEscape)
          .join(";")
      );
    });
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

/**
 * Rasteriza o SVG da logo em PNG (supersampling 4x para nitidez).
 * Retorna null fora do navegador ou se o canvas falhar (fallback: bloco "M").
 */
async function rasterizarSvg(
  svg: string,
  largura: number,
  altura: number
): Promise<string | null> {
  if (typeof document === "undefined" || typeof Image === "undefined")
    return null;
  try {
    return await new Promise<string | null>((resolve) => {
      let url = "";
      try {
        url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      } catch {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = largura;
          canvas.height = altura;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(url);
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, largura, altura);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

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
  const startY = 200; // abaixo do cabeçalho (grupo + membros)

  const logoPng = await rasterizarSvg(LOGO_SVG, 160, 168);

  const head = [[
    "Seq.",
    "Local de votação",
    "Qtd.\nseções",
    "Tipo de atividade",
    "Data",
    "Horário\n(início – fim)",
    "Equipe(s)",
    "LAT Origem",
  ]];

  const turno = meta.turno === 2 ? "2º Turno" : "1º Turno";
  const titulo = meta.tipoLabel
    ? `Cronograma de ${meta.tipoLabel}`
    : "Cronograma de Distribuição de Urnas";

  const desenharCabecalho = (grupo: GrupoRelatorio | null) => {
    // Faixa da marca no topo
    doc.setFillColor(...COR_PRIMARIA);
    doc.rect(0, 0, W, 3, "F");

    // Logo oficial (ou fallback com bloco "M")
    if (logoPng) {
      doc.addImage(logoPng, "PNG", M, 26, 40, 42);
    } else {
      doc.setFillColor(...COR_PRIMARIA);
      doc.roundedRect(M, 26, 40, 42, 7, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(21);
      doc.setTextColor(255, 255, 255);
      doc.text("M", M + 20, 56, { align: "center" });
    }

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

    // Título (dinâmico pelo tipo de atividade) e zona eleitoral
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(titulo, W / 2, 84, { align: "center" });
    if (meta.zonaEleitoral) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...COR_MUTED);
      doc.text(meta.zonaEleitoral, W / 2, 100, { align: "center" });
    }

    // Grupo (equipe ou dia) + tipo + membros
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
      if (grupo.membros?.length) {
        const nomes = grupo.membros
          .map((m) =>
            m.papel === "responsavel" ? `${m.nome} (Responsável)` : m.nome
          )
          .join(", ");
        let linhas = doc.splitTextToSize(`Membros: ${nomes}`, W - M - M);
        if (linhas.length > 2) {
          linhas = linhas.slice(0, 2);
          linhas[1] = `${linhas[1]} …`;
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...COR_MUTED);
        doc.text(linhas, M, 158);
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
    let seq = 0;
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
      seq++;
      const hor = horarioAtividade(a);
      const horarioCell =
        [hor.intervalo, hor.tempo].filter(Boolean).join("\n") || "—";
      body.push([
        { content: String(seq), styles: { halign: "center" } },
        a.local?.nome ?? "—",
        {
          content: a.local ? String(a.local.qtd_secoes) : "—",
          styles: { halign: "center" },
        },
        TIPO_ATIVIDADE_LABEL[a.tipo] ?? a.tipo,
        {
          content: formatDataBr(a.data_hora_planejada),
          styles: { halign: "center" },
        },
        { content: horarioCell, styles: { halign: "center" } },
        a.equipe?.nome ?? "—",
        a.equipe?.lat_origem ?? "",
      ]);
    }

    autoTable(doc, {
      head,
      body,
      startY,
      margin: { left: M, right: M, top: startY },
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
        0: { cellWidth: 30, halign: "center" },
        1: { cellWidth: 197 },
        2: { cellWidth: 42, halign: "center" },
        3: { cellWidth: 122 },
        4: { cellWidth: 58, halign: "center" },
        5: { cellWidth: 92, halign: "center" },
        6: { cellWidth: 104 },
        7: { cellWidth: 136 },
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

export function nomeArquivoPdf(
  grupos: GrupoRelatorio[],
  meta?: MetaRelatorio
): string {
  const ts = new Date();
  const sufixo = `${ts.getFullYear()}${pad2(ts.getMonth() + 1)}${pad2(ts.getDate())}-${pad2(ts.getHours())}${pad2(ts.getMinutes())}`;
  if (grupos.length === 1) {
    return `Cronograma-${slugNome(grupos[0].titulo)}.pdf`;
  }
  return `CronogramaMontaJE-${meta ? `${meta.ano}-` : ""}${sufixo}.pdf`;
}

export function nomeArquivoCsv(
  grupos: GrupoRelatorio[],
  meta?: MetaRelatorio
): string {
  const ts = new Date();
  const sufixo = `${ts.getFullYear()}${pad2(ts.getMonth() + 1)}${pad2(ts.getDate())}-${pad2(ts.getHours())}${pad2(ts.getMinutes())}${pad2(ts.getSeconds())}`;
  if (grupos.length === 1) {
    return `Relatorio-${slugNome(grupos[0].titulo)}.csv`;
  }
  return `RelatorioAtividades-${meta ? `${meta.ano}-` : ""}${sufixo}.csv`;
}