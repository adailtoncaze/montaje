import { describe, expect, it } from "vitest";
import {
  ALERTA_PROXIMO_MINUTOS,
  NOME_SISTEMA,
  PAPEL_EQUIPE_LABEL,
  PERFIL_LABEL,
  STATUS_ATIVIDADE_LABEL,
  TIPO_ATIVIDADE_LABEL,
  TIPO_EQUIPE_LABEL,
  normalizarTipoEquipe,
  rotuloTipoEquipe,
} from "@/lib/constants";
import type {
  PapelEquipe,
  PerfilUsuario,
  StatusAtividade,
  TipoAtividade,
  TipoEquipe,
} from "@/types/database";

/* ------------------------------------------------------------------ */
/*  Rótulos                                                            */
/* ------------------------------------------------------------------ */

describe("TIPO_EQUIPE_LABEL", () => {
  it("cobre os 4 tipos de equipe do banco", () => {
    expect(Object.keys(TIPO_EQUIPE_LABEL).sort()).toEqual([
      "instalacao",
      "recolhimento_midia",
      "recolhimento_urna",
      "verificacao",
    ]);
  });

  it("usa rótulos em português legíveis", () => {
    expect(TIPO_EQUIPE_LABEL.instalacao).toBe("Instalação de Urna");
    expect(TIPO_EQUIPE_LABEL.verificacao).toBe("Montagem de Seção");
    expect(TIPO_EQUIPE_LABEL.recolhimento_midia).toBe("Recolhimento de Mídia");
    expect(TIPO_EQUIPE_LABEL.recolhimento_urna).toBe("Recolhimento de Urna");
  });
});

describe("TIPO_ATIVIDADE_LABEL", () => {
  it("cobre os 4 tipos de atividade", () => {
    expect(Object.keys(TIPO_ATIVIDADE_LABEL).sort()).toEqual([
      "instalacao",
      "recolhimento_midia",
      "recolhimento_urna",
      "verificacao",
    ]);
  });

  it("mantém os mesmos rótulos do tipo de equipe", () => {
    expect(TIPO_ATIVIDADE_LABEL).toEqual(TIPO_EQUIPE_LABEL);
  });
});

describe("STATUS_ATIVIDADE_LABEL", () => {
  it("cobre os 4 status", () => {
    expect(Object.keys(STATUS_ATIVIDADE_LABEL).sort()).toEqual([
      "atrasado",
      "concluido",
      "em_andamento",
      "pendente",
    ]);
  });

  it("usa rótulos legíveis", () => {
    expect(STATUS_ATIVIDADE_LABEL).toEqual({
      pendente: "Pendente",
      em_andamento: "Em andamento",
      concluido: "Concluído",
      atrasado: "Atrasado",
    });
  });

  it("nenhum status tem rótulo vazio", () => {
    for (const [status, label] of Object.entries(STATUS_ATIVIDADE_LABEL)) {
      expect(label, status).toBeTruthy();
    }
  });
});

describe("PERFIL_LABEL", () => {
  it("cobre os perfis do banco", () => {
    expect(Object.keys(PERFIL_LABEL).sort()).toEqual([
      "admin",
      "servidor_zona",
    ]);
  });

  it("expande a sigla ZONA", () => {
    expect(PERFIL_LABEL.servidor_zona).toBe("Servidor Zona");
  });
});

describe("PAPEL_EQUIPE_LABEL", () => {
  it("cobre os papéis do banco", () => {
    expect(Object.keys(PAPEL_EQUIPE_LABEL).sort()).toEqual([
      "membro",
      "responsavel",
    ]);
  });
});

describe("ALERTA_PROXIMO_MINUTOS", () => {
  it("é a janela de 30 minutos do PRD 4.6", () => {
    expect(ALERTA_PROXIMO_MINUTOS).toBe(30);
  });
});

describe("NOME_SISTEMA", () => {
  it("é o nome oficial usado no PDF", () => {
    expect(NOME_SISTEMA).toContain("Cronograma");
  });
});

/* ------------------------------------------------------------------ */
/*  normalizarTipoEquipe / rotuloTipoEquipe                           */
/* ------------------------------------------------------------------ */

describe("normalizarTipoEquipe", () => {
  it.each<TipoEquipe>(["instalacao", "verificacao", "recolhimento_midia", "recolhimento_urna"])(
    "mantém o tipo atual %s",
    (tipo) => {
      expect(normalizarTipoEquipe(tipo)).toBe(tipo);
    }
  );

  it.each([
    ["montagem", "instalacao"],
    ["recolhimento", "recolhimento_midia"],
  ])("mapeia o tipo legado %s para %s", (legado, atual) => {
    expect(normalizarTipoEquipe(legado)).toBe(atual);
  });

  it("é idempotente", () => {
    expect(normalizarTipoEquipe(normalizarTipoEquipe("montagem"))).toBe(
      "instalacao"
    );
  });

  it("repassa valor desconhecido sem quebrar", () => {
    expect(normalizarTipoEquipe("outro")).toBe("outro");
    expect(normalizarTipoEquipe("")).toBe("");
  });
});

describe("rotuloTipoEquipe", () => {
  it("rótulo dos tipos atuais", () => {
    expect(rotuloTipoEquipe("instalacao")).toBe("Instalação de Urna");
    expect(rotuloTipoEquipe("recolhimento_urna")).toBe("Recolhimento de Urna");
  });

  it("rótulo dos tipos legados (sem quebrar tela de equipe antiga)", () => {
    expect(rotuloTipoEquipe("montagem")).toBe("Instalação de Urna");
    expect(rotuloTipoEquipe("recolhimento")).toBe("Recolhimento de Mídia");
  });

  it("cai para o valor cru quando o tipo é desconhecido", () => {
    expect(rotuloTipoEquipe("tipo_futuro")).toBe("tipo_futuro");
    expect(rotuloTipoEquipe("")).toBe("");
  });

  it("nunca devolve undefined", () => {
    for (const t of ["instalacao", "montagem", "xyz", "  "]) {
      expect(typeof rotuloTipoEquipe(t)).toBe("string");
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Cobertura dos tipos                                                */
/* ------------------------------------------------------------------ */

describe("cobertura dos maps de rótulo", () => {
  it("todo StatusAtividade tem rótulo", () => {
    const status: StatusAtividade[] = [
      "pendente",
      "em_andamento",
      "concluido",
      "atrasado",
    ];
    for (const s of status) expect(STATUS_ATIVIDADE_LABEL[s]).toBeTruthy();
  });

  it("todo TipoAtividade tem rótulo", () => {
    const tipos: TipoAtividade[] = [
      "instalacao",
      "verificacao",
      "recolhimento_midia",
      "recolhimento_urna",
    ];
    for (const t of tipos) expect(TIPO_ATIVIDADE_LABEL[t]).toBeTruthy();
  });

  it("todo PapelEquipe e PerfilUsuario têm rótulo", () => {
    const papeis: PapelEquipe[] = ["responsavel", "membro"];
    const perfis: PerfilUsuario[] = ["admin", "servidor_zona"];
    for (const p of papeis) expect(PAPEL_EQUIPE_LABEL[p]).toBeTruthy();
    for (const p of perfis) expect(PERFIL_LABEL[p]).toBeTruthy();
  });
});
