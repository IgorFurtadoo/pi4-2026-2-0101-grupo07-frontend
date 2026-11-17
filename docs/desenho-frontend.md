# Desenho do Frontend (Container 1)

Escrito em 16/11/2026. Responsável do módulo: Igor, que também faz todos os commits do repositório `-frontend`. Fontes: `especificacao-entrega2.md` (fluxos E1 a E7 e fichas CT1, CT3, CT6, CT9, CT13 e CT17), `desenho-core-api.md` e as pendências do Core API (comportamento real depois do C9), `direcao-visual.md` (guia de identidade de 08/10/2026) e o pacote `lemma-artes`. Em divergência valem `docs/contratos/` do Core API e este desenho; a Especificação entregue não é emendada.

Legenda:
- **[Contrato]**: já definido na Especificação ou no Core API. Só muda emendando a ficha.
- **[Marca]**: já decidido no guia de identidade.
- **[Sugestão]**: proposta deste documento, ainda não decidida.
- **[Aberto]**: decisão ainda não tomada.
- **[Decidido]**: decisão do responsável do módulo (Igor), com a data.
- **[Verificado]**: conferido por cálculo ou por fonte, com a data.

Nada aqui está decidido ainda, exceto o que traz a marca [Contrato], [Marca] ou [Decidido]. A seção 14 lista o que preciso que você confirme.

---

## 1. Papel e limites

O Frontend é uma SPA (sem SSR) que fala **só com o Core API**. Ele:

1. Cadastra o usuário e mostra o endereço da carteira criada. [Contrato: CT1, E1, E2]
2. Faz login e guarda o token. [Contrato: CT3, P1]
3. Mostra o saldo em ETH na Sepolia. [Contrato: CT6, E3]
4. Envia uma transação e entrega o identificador de acompanhamento. [Contrato: CT9, E4]
5. Acompanha a transação por polling até `CONFIRMED` ou `FAILED`. [Contrato: CT13, P4, E5]
6. Mostra o preço atual e o gráfico de 7 dias do ETH, e a mensagem de limite excedido. [Contrato: CT17, E6, E7]

Ele **não**: guarda nem vê chave privada, fala com o Blockchain Service, com o RPC ou com a CoinGecko, nem decide o estado de uma transação (só mostra o que o Core API devolve).

Contratos usados: CT1, CT3, CT6, CT9, CT13, CT17. O Frontend não tem ficha própria; ele é o chamador.

## 2. O que a identidade já decide e o que falta

O guia de identidade fecha **só a marca**. O próprio guia diz, na seção 10, que ficam fora dele: a tipografia do produto (a aprovação da Source Sans 3 foi retirada), os tons derivados para a interface, cabeçalho, cartão de saldo, botões, formulários, estados de transação, telas e layout, e em que telas o mascote aparece. As telas feitas antes foram "estudos visuais" e não são requisitos.

Então "seguir o design system do Lemma" tem duas camadas:

| Camada | Estado | O que contém |
|---|---|---|
| **Marca** | [Marca] fechada | Nome, logo (4 versões), símbolo, mascote, paleta de 4 cores, Jost no wordmark e no favicon, favicon, tamanhos mínimos, fundos permitidos, regras de contraste, regras de uso do mascote |
| **Produto** | **[Sugestão]**, definida nas seções 4 e 5 | Tons derivados, tipografia da interface, componentes, estados, telas, onde o mascote entra |

Regra de convivência: a camada de produto **deriva** da marca e nunca a altera. Todo tom que não está nas quatro cores oficiais é chamado de "derivado" e não é cor da marca (é a mesma separação que o guia faz).

Regras da marca que valem para o Frontend sem exceção [Marca]:
- Logo e símbolo só pelos arquivos do pacote, sem redigitar o wordmark. Logo no cabeçalho com pelo menos 40 px de altura (mínimo 32). Símbolo isolado a partir de 24 px, de preferência 32. Abaixo de 16 px, só o favicon.
- Versão clara do logo em fundo claro, escura em azul-noite, "fundo azul" em azul `#2447C6`. Nunca a clara no escuro nem a escura no claro.
- O coral é acento: nenhuma informação depende dele nem da diferença entre azul e coral. Coral não é texto no claro (2,6 : 1). Azul não é texto nem traço fino no azul-noite (2,2 : 1).
- O mascote é ilustração de apoio: um por peça, com texto ao lado, **nunca** para indicar sucesso, erro, alerta ou progresso, e removê-lo não pode apagar informação. Sobre azul-noite ou branco suave ele perde o contorno de partes do corpo, então entra com um disco de apoio (os estudos usaram `#C9D4F5` no claro e `#2B3659` no escuro, como exemplo).
- Movimento opcional e respeitando `prefers-reduced-motion`.

## 3. Tecnologias

Base obrigatória [Contrato]: React, TypeScript, Tailwind CSS, React Router, SPA sem SSR. O resto é [Sugestão], com a regra de só entrar o que tem justificativa.

| Item | Escolha | Por quê |
|---|---|---|
| Build e dev server | Vite | Padrão para SPA React + TS; sobe na porta 5173, que já é a origem liberada no CORS do Core API |
| Versões | A última estável de cada uma, fixada pelo agente no `package.json` | Como no Core API: conferir no `npm`, não de memória |
| Roteamento | React Router, modo biblioteca (rotas declaradas no código) | Contrato; sem SSR não precisa do modo framework |
| Estado de servidor | **Sem biblioteca** (hooks próprios) | São quatro chamadas: saldo, mercado, envio e polling. TanStack Query resolve problemas que não temos |
| Estado de sessão | Um `AuthContext` | É o único estado global |
| Formulários | Sem biblioteca; validação escrita à mão | Três formulários de dois campos |
| Gráfico | **SVG próprio**, ~100 linhas | Controle total da marca (cores, tooltip, acessibilidade), zero dependência. Alternativa descartada: Recharts, que traria uma árvore grande de dependências para uma linha de 7 dias |
| Animação | CSS (transições e `@keyframes`) | Sem Framer Motion: o impacto vem de composição e tipografia, não de biblioteca |
| Ícones | `lucide-react` (só os que usar) | Traço consistente, sem custo de bundle relevante |
| Fonte | `@fontsource-variable/jost` (autohospedada, licença OFL) | A Jost já é a fonte da marca e o pacote traz a licença. Sem Google Fonts: nada sai do container |
| Endereços e hashes | pilha monoespaçada do sistema | Sem segunda fonte para baixar |
| QR code (opcional, seção 6.3) | `qrcode.react` | Só se a tela "Receber" entrar |
| Testes | Vitest + Testing Library | Mesmo ecossistema do Vite |

Descartado de propósito: Redux/Zustand, Axios (o `fetch` basta), react-hook-form e zod, Storybook, biblioteca de componentes pronta (MUI, Chakra: brigariam com a identidade) e framework de e2e (a prova ponta a ponta é um roteiro manual, como no C9).

## 4. Camada de produto: tons e tipografia [Sugestão]

### 4.1 Tons

Cores oficiais [Marca]: azul `#2447C6`, coral `#F47762`, branco suave `#F5F7FA`, azul-noite `#151D35`. Os demais são **derivados**, escolhidos para passar nos contrastes. Razões de contraste calculadas em 16/11/2026 [Verificado] (fórmula WCAG; as razões das cores oficiais batem com as do guia: 15,5, 7,0 e 6,1).

| Papel | Valor | Origem | Contraste |
|---|---|---|---|
| Fundo do app (claro) | `#F5F7FA` | oficial | texto `#151D35` sobre ele: 15,5 : 1 |
| Cartão | `#FFFFFF` | branco | texto `#151D35`: 16,7 : 1 |
| Texto | `#151D35` | oficial | acima |
| Texto secundário | `#55607F` | derivado | 5,8 : 1 sobre `#F5F7FA`; 6,2 : 1 sobre branco |
| Primária (botão, link, foco) | `#2447C6` | oficial | 7,5 : 1 com branco; 7,0 : 1 com `#F5F7FA` |
| Primária ao passar o mouse | `#1C3AA3` | derivado | 9,6 : 1 com branco |
| Primária suave (fundos de destaque) | `#E8EDFB` | derivado | azul sobre ela: 6,4 : 1 |
| Borda de campo | `#8A94B0` | derivado | 3,0 : 1 sobre branco (limite para componente) |
| Linha divisória (decorativa) | `#D5DCEA` | derivado | 1,3 : 1; **só decoração**, nunca o único limite de um campo |
| Sucesso (texto e ícone) | `#17734B` | derivado | 5,9 : 1 sobre branco; 5,1 : 1 sobre `#E3F4EC` |
| Erro (texto e ícone) | `#B42318` | derivado | 6,6 : 1 sobre branco; 5,6 : 1 sobre `#FBE9E7` |
| Azul-noite (seções escuras) | `#151D35` | oficial | texto `#F5F7FA`: 15,5 : 1 |
| Cartão sobre noite | `#1E2845` | derivado | |
| Texto secundário sobre noite | `#A9B4D6` | derivado | 8,1 : 1 sobre `#151D35`; 7,1 : 1 sobre `#1E2845` |
| Azul-claro sobre noite (link, destaque) | `#8FA6F0` | derivado | 7,1 : 1 sobre `#151D35`; 6,2 : 1 sobre `#1E2845` |
| Coral sobre noite | `#F47762` | oficial | 6,1 : 1 (pode ser texto aí; no claro não) |

Por que existe o "azul-claro sobre noite": o azul oficial só tem 2,2 : 1 sobre azul-noite e não serve como texto nem traço fino ali (guia, seção 6).

Estados de transação (`PENDING`, `CONFIRMED`, `FAILED`): cada um tem **cor, ícone e texto**, nunca só cor. `PENDING` usa o azul da marca com um indicador animado, não âmbar, para não aumentar a paleta. `CONFIRMED` usa o verde de sucesso e `FAILED` o vermelho de erro.

Tema: **um tema** na primeira versão. [Sugestão] Fundo claro nas telas de uso, azul-noite nas telas de entrada e no rodapé, e o cartão de saldo em azul sólido. Tema escuro completo fica como [melhoria posterior], porque dobraria os testes de contraste.

### 4.2 Tipografia

| Uso | Fonte | Peso |
|---|---|---|
| Títulos e saldo | Jost | 500 |
| Corpo, botões, rótulos | Jost | 400 e 500 |
| Endereço, hash, `taskId` | monoespaçada do sistema | 400 |

[Aberto, verificar no passo F1] A Jost não precisa ter algarismos tabulares. O agente confere `font-variant-numeric: tabular-nums` na Jost; se não houver, valores alinhados em coluna usam a monoespaçada.

A fonte do produto é decisão que o guia deixou aberta (seção 7, "uso da Jost em títulos ou textos"). Escolher a Jost é a opção mais coerente e a mais simples (uma fonte só); o custo é que ela é geométrica e pede um pouco mais de espaçamento de linha no corpo.

## 5. Direção visual: onde está o impacto

"Bonito e marcante" aqui não vem de efeito, vem de **contraste de superfícies, escala tipográfica, composição e poucos momentos de movimento bem feitos**, tudo dentro das regras da marca. Os cinco momentos:

1. **Entrada (cadastro e login).** Tela dividida. Um painel grande em azul-noite com o mascote em escala grande sobre o disco de apoio, o nome e uma frase curta. Ao lado, o formulário em fundo claro. No celular o painel vira uma faixa no topo com o símbolo. É o único lugar onde o mascote aparece grande.
2. **Cartão de saldo.** O elemento central do app: um cartão azul sólido (`#2447C6`, texto branco, 7,5 : 1), o saldo em Jost 500 em escala grande, a unidade "ETH" menor, o selo "Sepolia · testnet", o endereço em chip com botão de copiar e os botões "Enviar" e "Receber". O coral entra como um único acento (um fio ou um ponto), nunca como texto.
3. **Painel de mercado.** Preço em destaque, variação dos 7 dias e o gráfico em SVG: área suave sob uma linha azul, ponto e valor ao passar o mouse, sem grade pesada.
4. **Acompanhamento da transação.** Uma linha do tempo vertical: "Solicitação aceita" (concluída) → "Aguardando confirmação" (indicador animado) → "Confirmada" ou "Falhou". Na transição para o estado final, o ícone se desenha (traço de SVG). Aqui está o momento de maior movimento do app, e ele é opcional (`prefers-reduced-motion`).
5. **Carregamento e vazio.** Esqueletos (shimmer) no lugar de rodinhas. Estado vazio de atividade com o mascote pequeno ao lado de texto (é "boas-vindas", uso permitido).

Onde o mascote **não** aparece: erros, avisos, 404, carregamento, confirmação de sucesso (regra da marca, seção 5.5). Esses estados usam ícone e texto.

Responsivo: parte de 360 px de largura; conteúdo limitado a uma largura confortável no desktop; foco visível em tudo; rótulos em todos os campos; mudança de estado da transação anunciada por região `aria-live`.

## 6. Telas e rotas

| Rota | Tela | Acesso | Contratos |
|---|---|---|---|
| `/cadastro` | Cadastro (e confirmação com o endereço criado) | pública | CT1 |
| `/entrar` | Login | pública | CT3 |
| `/` | Redireciona para `/carteira` (ou `/entrar`) | | |
| `/carteira` | Saldo, ações, painel de mercado | token | CT6, CT17 |
| `/enviar` | Formulário de envio e revisão | token | CT9 |
| `/transacoes/:taskId` | Acompanhamento | token | CT13 |
| `*` | Não encontrada (só texto e logo) | pública | |

Rota protegida sem token válido leva a `/entrar`. Rota pública com sessão válida leva a `/carteira`.

### 6.1 Cadastro e login (E1, E2)

- Cadastro: e-mail e senha. Validação no cliente igual à do Core API, só para dar resposta rápida; quem decide é o servidor. E-mail no formato simples e até 254 caracteres; senha de 8 a **72 bytes** em UTF-8 (conta com `TextEncoder`, não com `length`, por causa de acentos e emojis). Botão para mostrar a senha.
- Em `201`: **tela de confirmação** com o endereço público ("Sua carteira foi criada") e o botão "Entrar", com o e-mail já preenchido. Segue o E1 passo 5 e o E2 passo 8 (mostrar o endereço e abrir o login). Não faz login automático. Nunca pede nem mostra chave privada.
- Login: `200` guarda o token e vai a `/carteira`. `401 INVALID_CREDENTIALS` mostra a mensagem e não guarda nada.
- Botão desabilitado enquanto a requisição está em andamento.

### 6.2 Carteira (E3) e mercado (E6, E7)

- Saldo: `GET /wallet/balance` ao abrir, botão de atualizar e nova leitura depois de uma transação chegar ao estado final. Sem polling do saldo.
- Mercado: `GET /market/ethereum` (o `assetId` fixo é `ethereum`, como no E6 passo 1). Estados: carregando (esqueleto), ok, `429` (contagem regressiva pelo `Retry-After`, e o botão de atualizar desabilitado até acabar), `502` ("mercado indisponível" com botão de tentar de novo), qualquer outro erro.
- **Atenção ao limite global:** o Core API aceita 10 requisições de mercado por 60 s, **somando todos os usuários**. Se cada visita à carteira buscar o mercado, entrar e sair da tela esgota o limite. [Sugestão] guardar o último resultado **em memória por 60 s** e só buscar de novo depois disso ou por clique em atualizar. É simples (uma variável de módulo com horário) e evita que a própria demonstração gere `429`.
- Enquanto o External Data Service não existe, o painel recebe `502` e mostra o estado "indisponível". O resto da carteira não depende dele.
- Variação de 7 dias: calculada no cliente (último ponto contra o primeiro da série). Preço em dólar formatado em `pt-BR` (`US$ 3.200,45`).
- Link para o explorador (`https://sepolia.etherscan.io/tx/<hash>`) só com o hash validado (`^0x[0-9a-fA-F]{64}$`), em nova aba com `rel="noopener noreferrer"`.

### 6.3 "Receber" [Sugestão, opcional]

Para financiar a carteira na demonstração o usuário precisa do endereço. A tela (ou painel) "Receber" mostra o endereço completo, o botão de copiar e uma nota "isto é a rede de teste Sepolia: só receba ETH de teste". O QR code é um acréscimo barato (`qrcode.react`) e entra só se sobrar tempo no passo F7.

### 6.4 Envio (E4) e a janela de clique duplo

- Campos: endereço de destino e valor em ETH. O valor aceita vírgula ou ponto na digitação e é **enviado como texto** com ponto (`"0.01"`), sem passar por `Number`. O Core API aceita texto numérico no `amountEth` (decisão do C5). Regra no cliente: maior que zero, até 18 casas, até 20 dígitos inteiros. Endereço: `^0x[0-9a-fA-F]{40}$`. O checksum e a regra final são do servidor, e o `ADDRESS_INVALID` dele é mostrado.
- Duas etapas: formulário e **revisão** ("Você vai enviar X ETH para 0x…"), porque transação em blockchain não se desfaz. Sem botão "enviar tudo" (o Blockchain Service assina todo envio com limite de gás fixo de 500.000 e a rede exige adiantar o custo máximo; o usuário não consegue enviar o saldo inteiro). O texto de ajuda pede "deixe uma pequena folga para a taxa de rede".
- **Clique duplo.** O CT9/CT10 não tem idempotência: duas requisições são duas transações. Duas proteções: o botão fica desabilitado durante a requisição **e** o handler tem uma trava síncrona (uma `ref` que impede a segunda chamada antes de o React redesenhar), porque o `disabled` só vale depois do próximo render.
- **Sem retentativa automática do envio.** Se a requisição der timeout ou cair a conexão, não se sabe se o Core API aceitou. A tela diz "não foi possível confirmar se o envio foi aceito" e **não reenvia sozinha**; o usuário decide. (Hoje não há como conferir, ver seção 7.)
- Em `202`: vai para `/transacoes/{taskId}` (com `replace`, para o botão "voltar" não reabrir a revisão).

### 6.5 Acompanhamento (E5, P4)

- Faz `GET /transactions/{taskId}` a cada **3 s** enquanto `PENDING` [Sugestão: o worker do Blockchain Service roda a cada 5 s, o webhook traz o estado final na hora e cada polling custa só uma leitura de banco no Core API mais uma consulta de banco no Blockchain Service]. Para em `CONFIRMED` ou `FAILED`.
- Encadeia `setTimeout` depois de cada resposta (não `setInterval`), para nunca haver duas requisições em voo, e cancela tudo ao sair da tela.
- Aba escondida (`document.hidden`): pausa; ao voltar, consulta na hora.
- Falha de rede ou 5xx: mantém o último estado, mostra "reconectando…" e aumenta o intervalo (3, 6, 10 s). O Core API já devolve o último estado local se a consulta ativa falhar, então um 5xx aqui é o próprio Core API fora.
- `401 TOKEN_INVALID`: encerra a sessão e leva ao login. `404 TRANSACTION_NOT_FOUND`: "transação não encontrada" (também é o que um `taskId` de outro usuário recebe).
- **Sem tempo limite de task no backend (P4 em aberto).** Depois de 10 minutos em `PENDING`, o Frontend mostra o aviso "está demorando mais que o normal; você pode sair e voltar a esta página" e passa a consultar a cada 10 s. Não inventa um estado novo.
- Hash: aparece quando o Core API o informa. Enquanto `PENDING` ele é **provisório** (o Blockchain Service pode apagá-lo se a rede recusar), então é rotulado assim e o link do explorador só aparece em estado final. Em `CONFIRMED` mostra o link. Em `FAILED` com hash (`TRANSACTION_REVERTED`) também.
- Motivos de falha em português: `REJECTED_BY_NETWORK` ("A rede recusou a transação. Verifique se o saldo cobre o valor mais a taxa."), `TRANSACTION_REVERTED` ("A transação foi executada e revertida."), `INTERNAL_ERROR` ("Falha interna ao processar. Tente novamente.").
- Ao chegar a `CONFIRMED`, o saldo é considerado desatualizado e a carteira o relê ao voltar.

## 7. Histórico de transações [Aberto]

O Core API **não tem rota para listar transações**: só `POST /transactions` e `GET /transactions/{taskId}`. Consequências:

- O usuário só chega a uma transação pelo `taskId` (a URL). Se fechar a aba durante um `PENDING` e não guardou o link, **não tem como reencontrá-la**.
- Também não há "atividade recente" na carteira, que é o que dá aparência de produto pronto a uma carteira.
- Depois de um timeout no envio, não há como conferir se a solicitação foi aceita.

Alternativas:

| Opção | O que é | Prós | Contras |
|---|---|---|---|
| A. Sem histórico | Só o acompanhamento por URL | Nenhum trabalho extra; atende a Entrega 1 e a Especificação, que não pedem histórico | Carteira "pelada"; transação pendente pode ser perdida de vista |
| B. Lista local | O Frontend guarda os `taskId` enviados no navegador (por usuário) e consulta cada um | Sem mudar o Core API | Some ao trocar de navegador ou limpar dados; mais consultas; não resolve o timeout do envio |
| C. Rota nova no Core API | `GET /transactions` (do usuário do token, mais recentes primeiro, com limite fixo, por exemplo 20) | Resolve os três pontos; é uma leitura do `eth_transaction` que já existe; um passo pequeno | Uma ficha nova (CT) e um passo C10 no Core API; fora da Especificação |

**Recomendo C, depois do fluxo principal.** O custo é um passo pequeno e o ganho é visível na demonstração. Isso não bloqueia nada: os passos F1 a F6 não dependem dele, e a tela da carteira reserva o espaço da lista. Se o grupo preferir não mexer no Core API, A é aceitável e B não vale o esforço. Se C for aprovado, o passo vira C10 no Core API, e a alternância de contas do Core API continua (o próximo seria o Guillermo).

## 8. Cliente da API

Um único módulo (`src/api/client.ts`) por onde passa toda chamada.

- **URL base:** variável `VITE_API_URL` (padrão `http://localhost:8080`, que é o Core API publicado). É lida na hora do build e fica **visível no bundle**: no Frontend não vai nenhum segredo.
- **CORS** [Contrato, C3 e C8]: o Core API aceita só a origem `http://localhost:5173` e expõe o `Retry-After`. Por isso o Frontend, em dev e no container, é servido em `5173` (seção 11).
- **Autorização:** `Authorization: Bearer <token>` em toda rota, menos cadastro e login.
- **Tempo limite:** `AbortController` de 20 s. O Core API espera até 15 s o Blockchain Service, então 20 s evita desistir antes dele.
- **Erro tipado:** `ApiError { status, code, message, retryAfter? }`. Falha de rede ou timeout vira `code: "NETWORK_ERROR"`, sem status. O Frontend decide pelo **`code`**, não pelo status: `INVALID_CREDENTIALS` e `TOKEN_INVALID` são ambos 401 e pedem reações opostas.
- **`401 TOKEN_INVALID`** em qualquer rota protegida: limpar a sessão e ir a `/entrar` com a mensagem "sua sessão expirou". Centralizado no cliente, uma vez.
- **Mensagens:** o texto mostrado vem de um mapa `code → português` do próprio Frontend. O `message` do servidor é só reserva e é sempre renderizado como texto (nunca como HTML).
- **Precisão decimal.** O Core API devolve `balanceEth`, `amountEth`, `currentPrice` e `price` como número JSON exato; o `JSON.parse` comum lê como `double` e perde dígitos acima de ~15. **[Sugestão]** `JSON.parse(texto, reviver)` com o terceiro argumento `context.source` para os quatro campos, devolvendo o texto original. Suporte [Verificado em 16/11/2026, caniuse e web-platform-dx]: Chrome e Edge 114+, Firefox 135+, Safari 18.4+. Fora disso, o `context` vem indefinido e o cliente usa o número comum (perde precisão, serve para exibir arredondado). O agente confirma no navegador-alvo da demonstração. O saldo e o valor ficam como **texto** e são formatados por funções de texto (cortar casas por manipulação de string, sem `Number`); o preço e a série do gráfico podem ser `Number`, porque só são exibidos.
- **Códigos de erro cobertos pelo mapa:** `EMAIL_INVALID`, `PASSWORD_INVALID`, `EMAIL_ALREADY_REGISTERED`, `WALLET_UNAVAILABLE`, `INVALID_CREDENTIALS`, `REQUEST_INVALID`, `TOKEN_INVALID`, `ADDRESS_INVALID`, `AMOUNT_INVALID`, `BLOCKCHAIN_UNAVAILABLE`, `TRANSACTION_NOT_FOUND`, `ASSET_NOT_FOUND`, `RATE_LIMIT_EXCEEDED`, `MARKET_DATA_UNAVAILABLE`, `INTERNAL_ERROR`, mais `NETWORK_ERROR` do próprio cliente.

## 9. Sessão e token [Aberto]

Onde guardar o token (HS256, 240 min no exemplo, sem revogação):

| Opção | Sobrevive a recarregar | Sobrevive a fechar a aba | Exposto a XSS |
|---|---|---|---|
| Só em memória | não | não | sim, enquanto a aba vive |
| `sessionStorage` | sim | não | sim |
| `localStorage` | sim | sim | sim |
| Cookie `HttpOnly` | sim | conforme o cookie | não, mas exige mudar o Core API (`Set-Cookie`, CORS com credenciais e proteção contra CSRF) |

**Recomendo `sessionStorage`.** Sobrevive ao "atualizar a página" na demonstração, não deixa a credencial no disco do computador depois de fechar a aba (relevante em computador compartilhado, como o da sala) e não custa nada a mais que o `localStorage`. O cookie `HttpOnly` é o mais robusto contra XSS, mas mexe em três pontos do Core API (cookie, CORS e CSRF) por um ganho que não se justifica numa testnet acadêmica; fica registrado como alternativa descartada para a banca.

Detalhes:
- O que se guarda: `token` e `expiresAt`. Ao carregar o app, um token vencido é descartado sem chamar a API. Um temporizador encerra a sessão no `expiresAt`.
- Logout: apaga o token. Não há logout no servidor (o Core API não tem).
- Nunca vai ao log nem à URL.

## 10. Segurança do Frontend

- Não há chave privada no Frontend (carteira custodial). Nenhuma tela a pede ou mostra.
- Sem `dangerouslySetInnerHTML`. Todo texto vindo do servidor é renderizado como texto.
- Links externos só para o explorador, com hash validado e `rel="noopener noreferrer"`.
- Cabeçalhos no nginx do container: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, e uma `Content-Security-Policy` restrita (`default-src 'self'`; `connect-src` com a URL do Core API). Fontes autohospedadas, então não há domínio de fonte externo a liberar.
- Limitações a registrar no relatório: token em armazenamento do navegador é legível por um XSS; não há limite de tentativas de login (é do Core API); o Frontend roda em HTTP no `localhost` (sem HTTPS dentro do compose, testnet).

## 11. Infraestrutura

| Item | Proposta |
|---|---|
| Dockerfile | Multi-stage: etapa Node faz o `npm ci` e o `npm run build`; etapa final `nginx` (tag fixa) serve a pasta `dist` com **fallback de SPA** (`try_files $uri /index.html`), usuário não root quando a imagem permitir |
| Compose do repositório | Serviço `frontend`, porta publicada em **`127.0.0.1:5173`** (container escuta em 80) |
| Por que 5173 | É a origem que o Core API já libera (`CORS_ALLOWED_ORIGIN=http://localhost:5173`): **nenhuma mudança no Core API** |
| URL da API | `VITE_API_URL` como argumento de build, padrão `http://localhost:8080` |
| Rede `lemma-dev` | **Não precisa.** O navegador chama o Core API pela porta publicada no host; não há chamada de container para container |
| Desenvolvimento diário | `npm run dev` no host (Vite em 5173). Container e Vite usam a mesma porta, então rodam um por vez |
| Segredos | Nenhum. `.env.example` com `VITE_API_URL` apenas |

Quando o compose do sistema existir, o serviço `frontend` entra nele com a mesma porta.

## 12. Estrutura de código [Sugestão]

```
src/
  main.tsx                 monta o app
  App.tsx                  rotas e RequireAuth
  api/
    client.ts              fetch, Bearer, tempo limite, ApiError, reviver decimal
    errors.ts              mapa code -> mensagem em português
    auth.ts, wallet.ts, transactions.ts, market.ts    uma função por contrato
  auth/
    AuthContext.tsx, sessionStorage.ts, RequireAuth.tsx
  pages/
    RegisterPage, LoginPage, WalletPage, SendPage, TransactionPage, NotFoundPage
  components/
    ui/        Button, Input, Card, Badge, Skeleton, Toast, CopyButton
    brand/     Logo, Mascot (usam os SVG do pacote, sem redesenhar)
    wallet/    BalanceCard, ReceivePanel
    market/    MarketPanel, PriceChart (SVG)
    tx/        StatusTimeline, SendReview
  hooks/       useBalance, useMarket (com cache de 60 s), useTransactionPolling
  lib/         format.ts (ETH por texto, USD, datas), validate.ts, address.ts
  styles/      index.css (Tailwind e os tokens da seção 4)
  assets/brand logos, símbolo, mascote e favicon copiados de lemma-artes
```

Regras: página não chama `fetch`; só chama `api/`. `api/` não conhece React. A lógica de polling mora num hook testável com relógio falso. Os SVG da marca entram como arquivos, sem alteração.

## 13. Testes e ordem de implementação

### 13.1 Testes

1. **Unitários:** `format` (ETH por texto sem `Number`, casas, vírgula e ponto), validação de e-mail, senha (limite de 72 **bytes**), endereço e valor, mapa de erros, reviver decimal (com e sem `context`), cálculo da variação.
2. **Hooks com relógio falso:** `useTransactionPolling` (para em estado final; nunca duas requisições em voo; recua o intervalo em falha; pausa com a aba escondida; cancela ao sair; aviso aos 10 minutos) e o cache de 60 s do mercado.
3. **Componentes:** formulários (mensagens por `code`, botão desabilitado durante a requisição, trava de clique duplo com dois cliques seguidos gerando **uma** chamada), `RequireAuth`, tratamento de `TOKEN_INVALID`, contagem regressiva do `429`.
4. **Roteiro manual ponta a ponta** (Core API e Blockchain Service reais, na Sepolia): cadastrar, entrar, ver saldo, abastecer o usuário pelo procedimento já documentado no README do Core API ("Como abastecer a carteira de um usuário"), enviar, ver `PENDING` virar `CONFIRMED` sem recarregar, conferir o saldo; depois um envio que a rede recusa (valor acima do saldo) e ver `FAILED`. O teste de carga do E7 (H10.2) passa pelo Frontend só para ver a mensagem de limite.
5. **Verificações visuais** (manual, por tela): os contrastes da seção 4, foco visível, 360 px de largura, `prefers-reduced-motion`.

### 13.2 Passos

Um passo por card do OpenProject, um commit por mudança coerente, rodapé `OP#<id>`. Como o repositório é seu, os commits saem da sua conta, sem alternância e sem a regra de sigilo do Core API. Os números dos cards do Frontend **ainda não foram conferidos**: preciso do print do Kanban (ou da lista) para preencher a coluna.

| # | Passo | Pronto quando | Card |
|---|---|---|---|
| F1 | Esqueleto Vite + TS + Tailwind + Router; tokens da seção 4; fonte; Dockerfile, nginx e compose na porta 5173; ativos da marca; cabeçalho com o logo; cliente da API (erros, decimal, tempo limite); `.env.example`; `docs/desenho-frontend.md` no repositório | `docker compose up` serve o app em `http://localhost:5173` com o logo e o favicon; recarregar uma rota profunda não dá 404; testes do cliente e do reviver verdes | H01.5 (#1315, parte Frontend) e H01.2 (#865, parte Frontend) |
| F2 | Cadastro (com a tela de confirmação), login, `AuthContext`, `sessionStorage`, `RequireAuth`, tratamento centralizado de `TOKEN_INVALID` | Cadastrar, ver o endereço, entrar, recarregar mantendo a sessão, token vencido volta ao login, senha errada mostra a mensagem e não guarda token | cards de E1/E2 do Frontend (a conferir) |
| F3 | Carteira: cartão de saldo, copiar endereço, "Receber", esqueletos | Saldo real do Core API em texto, sem perda de dígitos; 502 do saldo mostra estado de erro com nova tentativa | card de E3 do Frontend (a conferir) |
| F4 | Envio: formulário, revisão, trava de clique duplo, erros por `code` | Um envio real devolve `202` e abre `/transacoes/{taskId}`; dois cliques seguidos fazem **uma** chamada; endereço e valor inválidos mostram a mensagem certa | card de E4 do Frontend (a conferir) |
| F5 | Acompanhamento: polling, linha do tempo, hash, motivos de falha, aviso de demora | `PENDING` vira `CONFIRMED` sem recarregar; `FAILED` mostra o motivo; sair da tela cancela o polling; saldo atualiza ao voltar | card de E5 do Frontend (a conferir) |
| F6 | Mercado: painel, gráfico SVG, cache de 60 s, `429` com contagem, `502` | Contra o External Data Service real ou um falso: preço e gráfico; `429` mostra a contagem e libera o botão ao fim; `502` mostra "indisponível" sem afetar o saldo | card de E6/E7 do Frontend (a conferir) |
| F7 | Acabamento: acessibilidade, movimento, 404, README do Frontend, roteiro manual ponta a ponta registrado | Roteiro 4 da seção 13.1 passa; contrastes e 360 px conferidos | H04.4 (#1317, parte Frontend) e cards de teste |
| F8 (se a opção C da seção 7 for aprovada) | Lista de atividade na carteira, depois do passo C10 no Core API | Lista das últimas transações do usuário, cada uma levando ao acompanhamento | novo (a criar) |

Dependências: F1 antes de todos; F2 antes de F3 a F6; F4 antes de F5; F6 não depende de F4 nem de F5 e pode ser feito antes se convier; F8 depende do C10.

## 14. Decisões e divergências

### Para você confirmar

1. **Camada de produto da seção 4** (tons derivados, Jost em tudo, um tema só). É decisão sua, porque o guia a deixou aberta.
2. **Cinco momentos visuais da seção 5**, em particular o mascote grande só na entrada.
3. **Sem bibliotecas de dados, formulários, gráfico e animação** (seção 3); gráfico em SVG próprio.
4. **Token em `sessionStorage`** (seção 9).
5. **Histórico:** opção A, B ou C (seção 7). Recomendo C, depois do fluxo principal.
6. **Mercado com cache de 60 s em memória** para não esgotar o limite global (seção 6.2).
7. **Cadastro termina na tela de confirmação com o endereço**, sem login automático (segue o E1/E2).
8. **Passos F1 a F7** e o print do Kanban com os cards do Frontend.

### Abertos que não bloqueiam

- Algarismos tabulares da Jost (verificar em F1).
- Tema escuro completo, QR code de "Receber" e histórico: ficam depois.
- O repositório `-frontend` só tem `docs/fluxos/`? O agente confere no primeiro plano; se houver código, o F1 parte dele.
- Estado do External Data Service (Lucas): não bloqueia o F1 a F5; o F6 roda contra `502` até ele existir.
- Tempo limite de task e retentativa de webhook (P4): do backend; o Frontend só mostra o aviso de demora.
- A formulação final de "Frontend sem responsável" na Especificação: passa a valer "Igor", como decisão posterior à Entrega 2.

### Divergências da Especificação (vão ao relatório final)

1. **Responsável do Frontend:** a Especificação diz "sem responsável definido"; passa a ser o Igor (decidido em 16/11/2026).
2. **Limite de gás (P8):** o Blockchain Service assina com 500.000, não 21.000, e um envio a conta nova gastou ~204.600 no C9. Efeito no Frontend: sem botão "enviar tudo" e mensagem de folga.
3. **Mascote e interface:** o guia limita onde o mascote pode aparecer; a seção 5 respeita isso.
