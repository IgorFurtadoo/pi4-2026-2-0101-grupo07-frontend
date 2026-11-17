# CLAUDE.md — Frontend (Lemma)

Este repositório é o **Frontend** (Container 1) da carteira custodial Lemma, na Sepolia Testnet: SPA em React, TypeScript, Tailwind CSS e React Router (modo biblioteca, sem SSR). Fala **só com o Core API**. Nunca vê chave privada.

Idioma: português do Brasil na comunicação, nos comentários e na documentação. Nomes em código em inglês.

## Comandos

Node 26 LTS. Sem Node no host, rode qualquer comando pelo container, com o mesmo Node do Dockerfile:

```sh
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/app -w /app -e HOME=/tmp node:26.13.1-trixie-slim npm <comando>
```

| Comando | O que faz |
|---|---|
| `npm ci` | instala as dependências exatas do lock |
| `npm run dev` | Vite em http://localhost:5173 |
| `npm run build` | `tsc -b` e build de produção em `dist/` |
| `npm test` | Vitest (jsdom e Testing Library) |
| `npm run lint` | ESLint |
| `docker compose up --build` | nginx em http://localhost:5173 |

Abra sempre em `http://localhost:5173`, não em `127.0.0.1`: o CORS do Core API compara a origem como texto exato. O Vite e o container usam a mesma porta, então rode um de cada vez.

## Leitura obrigatória

1. `docs/desenho-frontend.md`: desenho do módulo e passos F1 a F8.
2. `docs/identidade/direcao-visual.md` e `docs/identidade/lemma-artes/LEIA-ME.md`: regras da marca.
3. Fichas CT1, CT3, CT6, CT9, CT13 e CT17 em `docs/contratos/` do Core API: campos, status e códigos de erro.

Em divergência valem as fichas do Core API e o desenho. Não altere `docs/fluxos/`. Itens [Aberto] do desenho não se decidem sozinhos: pergunte.

## Regras

- Página não chama `fetch`; só `src/api/`. `src/api/` não conhece React.
- O Frontend decide pelo `code` do erro, não pelo status. O texto da tela vem de `messageFor` (`src/api/errors.ts`). O `message` do servidor é só reserva e é sempre texto: nada de `dangerouslySetInnerHTML`.
- ETH (saldo e valor) é **texto** do começo ao fim: reviver decimal no `client.ts` e `src/lib/format.ts`, sem `Number`.
- Validação no cliente igual à do Core API (`src/lib/validate.ts`); quem decide é o servidor.
- Marca só pelos arquivos de `docs/identidade` copiados sem alteração, por `Logo` e `Mascot`. Não redesenhe, não redigite o wordmark, não recolora. Cores só pelos tokens de `src/styles/index.css`.
- Mascote é ilustração de apoio: nunca indica sucesso, erro, alerta ou progresso.
- Sem Redux, Zustand, Axios, TanStack Query, react-hook-form, zod, Recharts, Framer Motion nem biblioteca de componentes. Qualquer dependência nova: pergunte antes.
- Versões exatas no `package.json` (`.npmrc` com `save-exact`), conferidas no npm, não de memória.
- No Frontend não entra segredo: `VITE_API_URL` fica visível no bundle. Só `.env.example` é versionado; não leia nem edite `.env`.

## Git

- Não altere `git config`, não use `--author`, não faça `git push` nem `git merge`.
- Um commit por mudança coerente, em português, no formato `H0x.y: …`, com o rodapé do card do OpenProject (`OP#<id>`).
- Só commite com build, testes e lint verdes. Antes de cada commit, confira o `git status` (nada de `.env`, `dist/`, `node_modules/`).
