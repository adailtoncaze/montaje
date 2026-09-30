import { describe, expect, it } from "vitest";
import {
  addDias,
  daysUntil,
  diffDias,
  formatLocalDate,
  formatTimeBr,
  formatTimestamp,
  getLocalDateFromTimestamp,
  hasTimezone,
  isPast,
  isToday,
  parseLocalDate,
  parseSaoPauloDate,
  hojeSaoPaulo,
} from "@/lib/utils/date";

describe("hasTimezone", () => {
  it.each([
    ["2026-10-02T11:00:00.000Z", true],
    ["2026-10-02T08:00:00-03:00", true],
    ["2026-10-02T08:00:00+00:00", true],
    ["2026-10-02T08:00:00", false],
    ["2026-10-02", false],
    ["", false],
  ])("%s -> %s", (entrada, esperado) => {
    expect(hasTimezone(entrada)).toBe(esperado);
  });
});

describe("parseLocalDate", () => {
  it("cria meia-noite no fuso local, sem off-by-one", () => {
    const d = parseLocalDate("2026-10-02");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(2);
    expect(d.getHours()).toBe(0);
  });
});

describe("getLocalDateFromTimestamp", () => {
  it("mantém a data literal de timestamps sem fuso (horário de parede)", () => {
    expect(getLocalDateFromTimestamp("2026-10-02T00:00:00")).toBe("2026-10-02");
    expect(getLocalDateFromTimestamp("2026-10-02T23:59:59")).toBe("2026-10-02");
  });

  it("não desloca a data em horário de parede (bug do dia anterior)", () => {
    // 00:00 em UTC-3 seria o dia anterior se fosse convertido.
    expect(getLocalDateFromTimestamp("2026-10-02T00:00:00")).not.toBe("2026-10-01");
  });

  it("converte timestamps com fuso para a data local do navegador", () => {
    // 2026-10-02T00:00Z é 2026-10-01 21:00 em São Paulo.
    const esperado =
      new Date("2026-10-02T00:00:00Z").toLocaleDateString("en-CA");
    expect(getLocalDateFromTimestamp("2026-10-02T00:00:00Z")).toBe(esperado);
  });

  it("devolve string vazia para entrada vazia", () => {
    expect(getLocalDateFromTimestamp("")).toBe("");
  });
});

describe("formatTimeBr", () => {
  it("mostra o valor literal de horário de parede", () => {
    expect(formatTimeBr("2026-10-02T08:00:00")).toBe("08:00");
    expect(formatTimeBr("2026-10-02T08:00:00.123")).toBe("08:00");
  });

  it("converte timestamptz para America/Sao_Paulo", () => {
    // 11:00Z = 08:00 em São Paulo (UTC-3).
    expect(formatTimeBr("2026-10-02T11:00:00Z")).toBe("08:00");
  });

  it("não desloca o dia ao converter 00:00 local", () => {
    // 03:00Z = 00:00 do mesmo dia em São Paulo.
    expect(formatTimeBr("2026-10-02T03:00:00Z")).toBe("00:00");
  });
});

describe("parseSaoPauloDate", () => {
  it("interpreta horário de parede como instante em São Paulo (UTC-3)", () => {
    const d = parseSaoPauloDate("2026-10-02T08:00:00");
    expect(d.toISOString()).toBe("2026-10-02T11:00:00.000Z");
  });

  it("aceita string com espaço e sem segundos", () => {
    expect(parseSaoPauloDate("2026-10-02 08:00").toISOString()).toBe(
      "2026-10-02T11:00:00.000Z"
    );
    expect(parseSaoPauloDate("2026-10-02T08:00").toISOString()).toBe(
      "2026-10-02T11:00:00.000Z"
    );
  });

  it("cai para o parser nativo em formato inesperado", () => {
    expect(parseSaoPauloDate("2026-10-02T08:00:00-03:00").toISOString()).toBe(
      "2026-10-02T11:00:00.000Z"
    );
  });

  it("mantém a ordem cronológica entre dois horários de parede", () => {
    const cedo = parseSaoPauloDate("2026-10-02T00:30:00");
    const tarde = parseSaoPauloDate("2026-10-02T23:30:00");
    expect(cedo.getTime()).toBeLessThan(tarde.getTime());
  });
});

describe("addDias / diffDias", () => {
  it("soma dias atravessando mês e ano", () => {
    expect(addDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDias("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("é estável com fuso e horário de verão (opera em UTC)", () => {
    expect(addDias("2026-03-29", 0)).toBe("2026-03-29");
    expect(addDias("2026-10-18", 0)).toBe("2026-10-18");
  });

  it("diffDias é a diferença b - a", () => {
    expect(diffDias("2026-10-02", "2026-10-05")).toBe(3);
    expect(diffDias("2026-10-05", "2026-10-02")).toBe(-3);
    expect(diffDias("2026-10-02", "2026-10-02")).toBe(0);
  });
});

describe("hojeSaoPaulo", () => {
  it("usa o fuso de São Paulo, não o da máquina", () => {
    const instantaneo = new Date("2026-10-02T02:00:00Z"); // 23:00 de 01/10 em SP
    expect(hojeSaoPaulo(instantaneo)).toBe("2026-10-01");
  });

  it("devolve YYYY-MM-DD", () => {
    expect(hojeSaoPaulo(new Date("2026-10-02T12:00:00Z"))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
  });
});

describe("daysUntil / isToday / isPast", () => {
  const hoje = "2026-10-02";

  it("conta dias até uma data futura", () => {
    expect(daysUntil("2026-10-09", hoje)).toBe(7);
  });

  it("conta dias desde uma data passada", () => {
    expect(daysUntil("2026-09-25", hoje)).toBe(-7);
  });

  it("isToday compara a data no fuso do app", () => {
    expect(isToday("2026-10-02", hoje)).toBe(true);
    expect(isToday("2026-10-03", hoje)).toBe(false);
  });

  it("isPast ignora o horário de parede", () => {
    expect(isPast("2026-10-01", hoje)).toBe(true);
    expect(isPast("2026-10-02", hoje)).toBe(false);
    expect(isPast("2026-10-03", hoje)).toBe(false);
  });
});

describe("formatLocalDate", () => {
  it("formata em pt-BR sem off-by-one", () => {
    expect(formatLocalDate("2026-10-02", "dd/MM/yyyy")).toBe("02/10/2026");
  });

  it("formata dia e mês por extenso", () => {
    expect(formatLocalDate("2026-10-02", "d 'de' MMMM")).toBe("2 de outubro");
  });
});

describe("formatTimestamp", () => {
  it("formata timestamptz no fuso local do navegador", () => {
    const iso = new Date("2026-10-02T15:30:00Z").toISOString();
    expect(formatTimestamp(iso, "dd/MM/yyyy HH:mm")).toMatch(
      /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/
    );
  });
});
