import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * O tailwind-merge não conhece os tamanhos de fonte customizados do tema
 * (`--text-micro`, `--text-caption`, `--text-body`, ...). Sem avisá-lo, ele
 * classifica `text-caption` como COR de texto — e então `text-caption` e
 * `text-white` entram em conflito (mantendo só o último). Isso removia a
 * cor branca do botão primário, deixando o label e o ícone (currentColor)
 * herdeiros de `--fg` (preto). Registrando os nomes em `theme.text`,
 * `text-<tamanho>` passa a ser reconhecido como font-size e nunca conflita
 * com `text-<cor>`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["micro", "caption", "body", "subtitle", "title", "headline"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
