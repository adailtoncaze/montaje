# MontaJE

Cronograma de montagem e recolhimento eleitoral (PRD v1.0).
**Next.js 15 (App Router) · Tailwind 4 · Supabase (Auth + Postgres + Realtime).**

---

## Funcionalidades

- **Painel** com KPIs, atividades de hoje, próximas atividades e prazos da eleição.
- **Cronograma** agrupado por dia, com filtros (busca, status, tipo, equipe, local e período).
- **Perfis**: `admin` (planeja atividades) e `servidor_zona` (executa: iniciar/concluir, observações).
- **Supabase Realtime**: atualizações refletidas em tempo real entre usuários.

---

## Requisitos

- Node.js **18.18+** (recomendado 20.x)
- Conta no [Supabase](https://supabase.com) (plano gratuito é suficiente)
- Conta no [Vercel](https://vercel.com) (plano gratuito/Hobby é suficiente)

---

## Começando (desenvolvimento local)

```bash
npm install
cp .env.example .env.local      # preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

### Aplicando as migrações no Supabase

O app **não** roda migrações automaticamente. Aplique os arquivos de
`supabase/migrations/` (na ordem) no **SQL Editor** do painel do Supabase,
ou via CLI:

```bash
supabase db push
```

Migrações atuais:

| Arquivo | O que faz |
|---|---|
| `0001_init.sql` | Schema inicial: tabelas, RLS, view de status, trigger de auditoria, Realtime |
| `0002_atividades_detalhamento.sql` | Sequência, horários planejados, duração |
| `0003_tipo_equipe_4_valores.sql` | Amplia `tipo_equipe` de 2 para 4 valores (alinhado a `tipo_atividade`) |
| `0004_atividades_data_wallclock.sql` | Corrige datas do cronograma (horário de parede, sem timezone) |

> ⚠️ **Para produção, deixe as migrações aplicadas no Supabase antes do deploy.**

### Criando usuários

Não há tela de cadastro: crie os usuários no painel do Supabase
(**Authentication → Users → Add user**, e-mail + senha). Para tornar alguém admin:

```sql
update perfis set perfil = 'admin' where id = '<uuid do usuário>';
```

---

## Deploy na Vercel (plano gratuito)

### 1. Suba o projeto para o GitHub

```bash
git init
git add .
git commit -m "MontaJE"
git remote add origin https://github.com/USUARIO/montaje.git
git push -u origin main
```

> O `.gitignore` já exclui `.env*.local` — **nunca** commite segredos.

### 2. Importe o projeto na Vercel

1. Acesse [vercel.com/new](https://vercel.com/new) e faça login com o GitHub.
2. **Import Git Repository** → escolha o repositório `montaje`.
3. A Vercel detecta **Next.js** automaticamente (Build: `npm run build`; Output: `.next`).
4. Em **Environment Variables**, adicione (ou importe do `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL` → `https://SEU-PROJETO.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → sua anon key (pública por definição — seguro usar `NEXT_PUBLIC_`)
   - (opcional) `NODE_VERSION` → `20` caso o build reclame de versão do Node
5. Clique em **Deploy**.

### 3. Configure o Supabase Auth para o domínio

No painel do Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://SEU-PROJETO.vercel.app` (ou seu domínio)
- **Redirect URLs**: adicione `https://SEU-PROJETO.vercel.app/**`

O login é por **e-mail + senha** (`signInWithPassword`). No plano gratuito do
Supabase, e-mails de confirmação/recuperação usam o serviço padrão e funcionam,
mas para envio confiável considere configurar um **SMTP customizado** depois.

### 4. Verifique o deploy

- Acesse o domínio `*.vercel.app` gerado.
- Faça login com um usuário criado no passo anterior.
- Confira: painel, cronograma (com as **datas corretas**), criação/edição de
  atividade por um admin e status em tempo real.

### 5. Atualizações futuras

Todo `git push` no branch principal dispara deploy automático na Vercel.
Alterações no schema do Supabase exigem aplicar uma **nova migração** no banco
(independente do deploy do código).

---

### Notas sobre o plano gratuito da Vercel (Hobby)

- Gratuito, **sem cartão de crédito**; até 3 projetos.
- **~100 GB de transferência/mês** — confortável para uso interno da equipe
  (eleição tem volume baixo de acessos).
- Deploys **serverless**: há um cold start pequeno na primeira visita;
  nada a configurar.
- **Domínio próprio**: dá para apontar um domínio personalizado no projeto
  (Settings → Domains). O app é padrão — basta apontar o DNS e configurar o
  Site URL/Redirect no Supabase para o novo domínio.
- Se um dia precisar de mais (bandwidth, build time, domínios extras), o plano
  **Pro** (pago) é o próximo passo. O código não muda.

---

## Segurança (internet e intranet)

Este app roda o **mesmo código** na internet (Vercel) e na intranet (acesso interno
pela rede da organização). O modelo de segurança é único e já está na base:

- **Todas as tabelas têm RLS habilitado** e as políticas aceitam apenas o papel
  `authenticated` — **nenhum dado é legível sem login** (nem com a anon key).
- **Escrita admin-only** via políticas `is_admin()` (com exceção de
  `status`/`observações` de atividades, liberadas para `servidor_zona` via trigger).
- **A chave `service_role` não é usada no código** e nunca deve entrar em `.env`
  ou na Vercel — somente no painel do Supabase (ela ignora RLS; vazá-la seria grave).
- A página de login retorna erro **genérico** para e-mail/senha errados
  (não há enumeração de contas).

### 🔴 Impostergável: desabilite o cadastro público no Supabase

O Supabase permite **auto-cadastro por padrão** (`Authentication → Providers →
Email → "Allow new users to sign up"`). Como o app tem um trigger
(`handle_new_user`) que cria o perfil de **servidor_zona** automaticamente, um
atacante poderia se registrar sozinho e **ler todos os dados** (usuários criados
só pelo admin). **Desmarque essa opção** antes de publicar na internet:

> Supabase → **Authentication → Sign In / Up → Email** → desative
> **"Allow new users to sign up"**.

Depois, crie usuários apenas por
**Authentication → Users → Add user**. Isso vale tanto para a internet quanto
para a intranet.

### Ajustes recomendados no Supabase

| Configuração | Onde | Recomendação |
|---|---|---|
| Confirmação de e-mail | Authentication → Providers → Email | Manter **ativada** |
| Política de senha | Authentication → Password Strength | **Alta** (mín. 8, maiúsculas, números, símbolos) |
| Proteção por CAPTCHA | Authentication → Bot and Abuse Protection | Ativar **hCaptcha** (reduz força bruta no login) |
| Sessões | Authentication → Sessions | Manter padrão (1 h + refresh) |

### Notas de hardening (leia e decida)

- **PII de colaboradores**: qualquer usuário autenticado hoje lê nome e
  **telefone** de todos os colaboradores (`colaboradores`/`equipe_colaboradores`).
  Se a organização julgar sensível, restrinja a leitura a admin e exponha uma
  **view sem telefone** para `servidor_zona` (requer pequena mudança de código).
- **Realtime**: o app não usa realtime, mas a tabela `atividades` está na
  publicação `supabase_realtime` (migração `0001`). Para reduzir superfície,
  remova (SQL no SQL Editor):
  ```sql
  alter publication supabase_realtime drop table atividades;
  ```
- **CSP**: o app já envia `X-Frame-Options`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy` e HSTS via `next.config.ts`. Uma Content-Security-Policy
  estrita com nonce é o próximo passo opcional — teste em staging antes
  (o Next injeta scripts inline que precisam de nonce).
- **MFA**: o Supabase suporta TOTP; implementar exige fluxos extras no app
  (second factor). Considere como evolução, principalmente para contas admin.

### Intranet

- O acesso interno usa o **mesmo HTTPS** do Vercel (nada muda no RLS).
- Cookies de sessão do Supabase são `SameSite=Lax` e servidos via HTTPS.
- Se no futuro houver um servidor intranet **separado em HTTP puro**, remova o
  cabeçalho HSTS do `next.config.ts` (HSTS força HTTPS no navegador).
- As credenciais do Supabase (URL + anon key) são as mesmas nos dois cenários;
  a anon key é pública por definição — a RLS é a barreira de verdade.

---

## Troubleshooting

| Problema | Causa provável / solução |
|---|---|
| Build falha na Vercel | Configure `NODE_VERSION=20` nas env vars do projeto. |
| `invalid login credentials` | Usuário criado no Supabase com e-mail/senha corretos? Confira em Authentication → Users. |
| Login recusa após trocar de domínio | Atualize **Site URL** e **Redirect URLs** no Auth do Supabase. |
| Datas do cronograma com 1 dia de diferença | Migração `0004` não aplicada no banco. Rode o SQL no SQL Editor. |
| Tabelas/procedimentos ausentes (erro de SQL/RLS) | Rode as migrações `0001`→`0004` em ordem. |
| Realtime não atualiza | Confira se a publicação `supabase_realtime` inclui `atividades` (migração `0001`). |

---

## Tema (design system estilo Microsoft Teams)

Tudo em `src/app/globals.css`: variáveis CSS (`:root` claro, `[data-theme="dark"]` escuro) espelhadas no Tailwind via `@theme inline`.
Nada de hex solto nos componentes — use as utilities semânticas:

| Grupo | Utilities |
|---|---|
| Superfícies | `bg-canvas` `bg-surface` `bg-surface-subtle` `border-stroke` `border-stroke-strong` |
| Texto | `text-fg` `text-fg-2` `text-fg-3` `text-fg-4` `text-fg-disabled` |
| Marca | `bg-brand` `hover:bg-brand-hover` `active:bg-brand-pressed` `text-brand-fg` `bg-brand-tint` |
| Rail | `bg-rail` `text-rail-fg` `bg-rail-active` `bg-rail-hover` |
| Status | `bg-success-bg text-success-fg` · `warning-*` · `danger-*` |
| Tipografia | `text-micro` 11 · `text-caption` 12 · `text-body` 14 · `text-subtitle` 16 · `text-title` 20 · `text-headline` 24 |
| Raio / sombra | `rounded-md` 4 · `rounded-lg` 8 · `shadow-card` `shadow-raised` `shadow-dialog` |

Componentes base: `Button`, `Badge`, `StatusBadge`, `Card`, `Rail` (barra inferior no mobile), `PageHeader`.

## Estrutura

```
src/app/(app)/*        telas protegidas (placeholders)
src/app/login          login (Supabase Auth)
src/components/ui      primitivos do design system
src/components/layout  rail, header de página
src/lib/supabase       clients browser/server/middleware
src/types/database.ts  tipos de domínio do PRD
supabase/migrations    schema, RLS, trigger de auditoria, Realtime
```

Obs.: no Next 16 o `middleware.ts` passou a se chamar `proxy.ts`; o projeto está fixado no Next 15.