# Desenho do Frontend (Container 1)

Escrito em 16/11/2026, atualizado em 18/11/2026 depois do F5 e do External Data Service (E1 a E3) e em 19/11/2026 depois do F6. Responsável do módulo: Igor, que também faz todos os commits do repositório `-frontend`. Fontes: `especificacao-entrega2.md` (fluxos E1 a E7 e fichas CT1, CT3, CT6, CT9, CT13 e CT17), `desenho-core-api.md` e as pendências do Core API (comportamento real depois do C9), `direcao-visual.md` (guia de identidade de 08/10/2026) e o pacote `lemma-artes`. Em divergência valem `docs/contratos/` do Core API e este desenho; a Especificação entregue não é emendada.

Legenda:
- **[Contrato]**: já definido na Especificação ou no Core API. Só muda emendando a ficha.
- **[Marca]**: já decidido no guia de identidade.
- **[Sugestão]**: proposta deste documento, ainda não decidida.
- **[Aberto]**: decisão ainda não tomada.
- **[Decidido]**: decisão do responsável do módulo (Igor), com a data.
- **[Verificado]**: conferido por cálculo ou por fonte, com a data.

Em 17/11/2026 o Igor confirmou as decisões 1 a 4, 6 e 7 da seção 14, e em 18/11/2026 a 5 (histórico, opção D). O que é [Sugestão] nas seções 3 a 6 e 8 a 12 passa a valer como decidido, salvo onde a seção 14 diz o contrário.

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

[Verificado no F1, 16/11/2026] O woff2 latin do `@fontsource-variable/jost` tem a feature `tnum`: com `font-variant-numeric: tabular-nums` os 10 algarismos ficam com a mesma largura (580 unidades); sem ela variam de 450 a 600. Valores em coluna usam Jost com `tabular-nums`, sem recorrer à monoespaçada (que fica para endereço, hash e `taskId`).

A fonte do produto é decisão que o guia deixou aberta (seção 7, "uso da Jost em títulos ou textos"). Escolher a Jost é a opção mais coerente e a mais simples (uma fonte só); o custo é que ela é geométrica e pede um pouco mais de espaçamento de linha no corpo.

## 5. Direção visual: onde está o impacto

"Bonito e marcante" aqui não vem de efeito, vem de **contraste de superfícies, escala tipográfica, composição e poucos momentos de movimento bem feitos**, tudo dentro das regras da marca. Os cinco momentos:

1. **Entrada (cadastro e login).** Tela dividida. Um painel grande em azul-noite com o mascote em escala grande sobre o disco de apoio, o nome e uma frase curta. Ao lado, o formulário em fundo claro. No celular o painel vira uma faixa azul-noite no topo com o logo na versão escura [Decidido, 17/11/2026: no lugar do símbolo isolado, que o guia reserva para fundos claros], sem o mascote. É o único lugar onde o mascote aparece grande. As telas de entrada ocupam a tela inteira, sem o cabeçalho do app; a troca entre cadastro e login fica num link no formulário.
2. **Cartão de saldo.** O elemento central do app: um cartão azul sólido (`#2447C6`, texto branco, 7,5 : 1), o saldo em Jost 500 em escala grande, a unidade "ETH" menor, o selo "Sepolia · testnet", o endereço em chip com botão de copiar e os botões "Enviar" e "Receber". O coral entra como um único acento (um fio ou um ponto), nunca como texto.
3. **Painel de mercado.** Preço em destaque, variação dos 7 dias e o gráfico em SVG: área suave sob uma linha azul, ponto e valor ao passar o mouse, sem grade pesada.
4. **Acompanhamento da transação.** Uma linha do tempo vertical: "Solicitação aceita" (concluída) → "Aguardando confirmação" (indicador animado) → "Resultado da rede" (passo neutro, sem ícone de sucesso nem de erro, enquanto está `PENDING`) que vira "Confirmada" ou "Falhou" [Decidido e feito no F5, 17/11/2026: o terceiro passo não antecipa o resultado]. Na transição para o estado final, o ícone se desenha (traço de SVG). Aqui está o momento de maior movimento do app, e ele é opcional (`prefers-reduced-motion`).
5. **Carregamento e vazio.** Esqueletos (shimmer) no lugar de rodinhas. Estado vazio de atividade com o mascote pequeno ao lado de texto (é "boas-vindas", uso permitido). [Decidido, 17/11/2026] Só existe se o histórico da seção 7 entrar: sem ele, não se mostra "nenhuma atividade", porque seria falso (as transações existem, só não dá para listá-las).

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

- Cadastro: e-mail e senha. Validação no cliente igual à do Core API, só para dar resposta rápida; quem decide é o servidor. E-mail no formato simples e até 254 caracteres; senha com no mínimo 8 **caracteres** (code points, como o `codePointCount` do Core API: um emoji conta 1) e no máximo **72 bytes** em UTF-8 (conta com `TextEncoder`, não com `length`). Exemplo: `çãõé` tem 4 caracteres e 8 bytes, e o servidor recusa. Botão para mostrar a senha.
- Em `201`: **tela de confirmação** com o endereço público ("Sua carteira foi criada") e o botão "Entrar", com o e-mail já preenchido. Segue o E1 passo 5 e o E2 passo 8 (mostrar o endereço e abrir o login). Não faz login automático. Nunca pede nem mostra chave privada.
- Login: `200` guarda o token e vai a `/carteira`. `401 INVALID_CREDENTIALS` mostra a mensagem e não guarda nada.
- Botão desabilitado enquanto a requisição está em andamento.

### 6.2 Carteira (E3) e mercado (E6, E7)

- Saldo: `GET /wallet/balance` ao abrir, botão de atualizar e nova leitura depois de uma transação chegar ao estado final. Sem polling do saldo.
- Mercado: `GET /market/ethereum` (o `assetId` fixo é `ethereum`, como no E6 passo 1). Estados: carregando (esqueleto), ok, `429` (contagem regressiva pelo `Retry-After`, e o botão de atualizar desabilitado até acabar), `502` ("mercado indisponível" com botão de tentar de novo), qualquer outro erro.
- **Atenção ao limite global:** o Core API aceita 10 requisições de mercado por 60 s, **somando todos os usuários**. Se cada visita à carteira buscar o mercado, entrar e sair da tela esgota o limite. [Sugestão] guardar o último resultado **em memória por 60 s** e só buscar de novo depois disso ou por clique em atualizar. É simples (uma variável de módulo com horário) e evita que a própria demonstração gere `429`.
- O External Data Service existe desde 18/11/2026 (E1 a E3) e o `GET /market/ethereum` do Core API já devolve preço e série reais (provado com a CoinGecko real). O `502` segue tratado: o painel mostra "indisponível" e o resto da carteira não depende dele.
- Variação de 7 dias: calculada no cliente (último ponto contra o primeiro da série). Preço em dólar formatado em `pt-BR` (`US$ 3.200,45`).
- **Detalhes feitos no F6** [Decidido, 19/11/2026]: o cache é um estado de módulo com o último resultado bom (60 s), o fim do `429` e uma única requisição em voo para o app todo; o `502` não fica guardado (voltar à tela busca de novo), e o `429` sim (voltar segue a mesma contagem, sem nova chamada). Sem `Retry-After` legível, a espera é de 60 s. A primeira busca sai num `setTimeout(0)`, para a montagem dupla do `StrictMode` não gastar vaga com uma requisição cancelada. O corpo é conferido inteiro (`assetId`, `USD`, decimais planos, série de 1 a 1.000 pontos com instantes ISO UTC em ordem não decrescente); fora disso, erro, sem série parcial. Os instantes da série nunca são comparados com o relógio local (o último ponto é o da consulta e pode estar à frente dele); "Atualizado às" usa a hora local da resposta. A contagem do `429` fica fora do alerta, para o leitor de tela não a repetir a cada segundo. O corpo real foi aceito pela validação (169 pontos, preços com até 16 algarismos, texto exato).
- Link para o explorador (`https://sepolia.etherscan.io/tx/<hash>`) só com o hash validado (`^0x[0-9a-fA-F]{64}$`), em nova aba com `rel="noopener noreferrer"`.

### 6.3 "Receber" [Sugestão, opcional]

Para financiar a carteira na demonstração o usuário precisa do endereço. A tela (ou painel) "Receber" mostra o endereço completo, o botão de copiar e uma nota "isto é a rede de teste Sepolia: só receba ETH de teste". O QR code é um acréscimo barato (`qrcode.react`) e entra só se sobrar tempo no passo F7. [Sugestão para o F3] Seção recolhível na própria carteira (botão com `aria-expanded`), sem rota nova.

### 6.4 Envio (E4) e a janela de clique duplo

- Campos: endereço de destino e valor em ETH. O valor aceita vírgula ou ponto na digitação e é **enviado como texto** com ponto (`"0.01"`), sem passar por `Number`. O Core API aceita texto numérico no `amountEth` (decisão do C5). Regra no cliente: maior que zero, até 18 casas, até 20 dígitos inteiros. Endereço: `^0x[0-9a-fA-F]{40}$`. O checksum e a regra final são do servidor, e o `ADDRESS_INVALID` dele é mostrado.
- Duas etapas: formulário e **revisão** ("Você vai enviar X ETH para 0x…"), porque transação em blockchain não se desfaz. Sem botão "enviar tudo" (o Blockchain Service assina todo envio com limite de gás fixo de 500.000 e a rede exige adiantar o custo máximo; o usuário não consegue enviar o saldo inteiro). O texto de ajuda pede "deixe uma pequena folga para a taxa de rede".
- **Clique duplo.** O CT9/CT10 não tem idempotência: duas requisições são duas transações. Duas proteções: o botão fica desabilitado durante a requisição **e** o handler tem uma trava síncrona (uma `ref` que impede a segunda chamada antes de o React redesenhar), porque o `disabled` só vale depois do próximo render.
- **Sem retentativa automática do envio.** Se a requisição der timeout ou cair a conexão, não se sabe se o Core API aceitou. A tela diz "não foi possível confirmar se o envio foi aceito" e **não reenvia sozinha**; o usuário decide. (Hoje não há como conferir, ver seção 7.)
- **Quais falhas são "resultado incerto"** [Decidido e feito no F4, 17/11/2026]: `NETWORK_ERROR` (rede ou tempo esgotado de 20 s), `INTERNAL_ERROR` (o 500 pode vir depois de o Blockchain Service já ter recebido o pedido, porque o Core API chama o CT10 antes de gravar a linha local; também um 202 com corpo fora da ficha) e qualquer `code` que o Frontend não conhece. Nesses casos a tela fica na revisão, mostra o aviso, e o botão passa a "Enviar de novo". O aviso **não some** até o 202 ou a saída da tela, nem depois de um 502 ou de "Voltar e editar": editar e enviar depois de um resultado incerto ainda é enviar de novo. O `502 BLOCKCHAIN_UNAVAILABLE` é tratado como "não enviado", mas **sem idempotência isso não é garantido** (o Core API também responde 502 quando a chamada ao Blockchain Service estoura o tempo, e o pedido pode ter sido aceito lá): limitação a registrar no relatório final.
- **Erros do servidor no formulário.** `ADDRESS_INVALID` e `AMOUNT_INVALID` voltam à etapa do formulário com a mensagem no campo e o foco nele (o erro do campo não tem `role="alert"`, então o foco no campo é o que faz o leitor de tela ler a mensagem). `BLOCKCHAIN_UNAVAILABLE` e `REQUEST_INVALID` ficam como alerta na revisão.
- **Clique duplo entre etapas.** Um duplo clique em "Continuar" pode fazer o segundo clique cair no "Confirmar envio" desenhado logo depois no mesmo lugar. O botão ignora cliques com `event.detail > 1`; teclado e Enter têm `detail` 0 e passam, e o foco vai ao título ao trocar de etapa, então um Enter segurado não alcança o botão. A trava por `ref` continua sendo a proteção principal.
- **Valor com ponto.** `"1.000"` é 1 ETH (o ponto é decimal; não há separador de milhar). O texto de ajuda do campo avisa, e a revisão mostra o valor por extenso ("1 ETH"), o que deixa o engano visível antes do envio.
- **Sair da tela com o envio em voo.** A requisição não é cancelada (cancelar não desfaz o que o servidor já processou) e o resultado é ignorado; sem histórico (seção 7), o usuário perde o `taskId` nesse caso.
- Em `202`: vai para `/transacoes/{taskId}` (com `replace`, para o botão "voltar" não reabrir a revisão).

### 6.5 Acompanhamento (E5, P4)

- Faz `GET /transactions/{taskId}` a cada **3 s** enquanto `PENDING` [Sugestão: o worker do Blockchain Service roda a cada 5 s, o webhook traz o estado final na hora e cada polling custa só uma leitura de banco no Core API mais uma consulta de banco no Blockchain Service]. Para em `CONFIRMED` ou `FAILED`.
- Encadeia `setTimeout` depois de cada resposta (não `setInterval`), para nunca haver duas requisições em voo, e cancela tudo ao sair da tela.
- Aba escondida (`document.hidden`): pausa; ao voltar, consulta na hora.
- Qualquer erro que não seja `404` nem `401` (rede, 5xx ou código desconhecido) [Decidido e feito no F5, 17/11/2026]: mantém o último estado, mostra "Reconectando…" e aumenta o intervalo (3, 6, 10 s, e fica em 10). O Core API já devolve o último estado local se a consulta ativa falhar, então um 5xx aqui é o próprio Core API fora.
- `401 TOKEN_INVALID`: encerra a sessão e leva ao login. `404 TRANSACTION_NOT_FOUND`: "transação não encontrada" (também é o que um `taskId` de outro usuário recebe).
- **Sem tempo limite de task no backend (P4 em aberto).** Depois de 10 minutos em `PENDING`, o Frontend mostra o aviso "está demorando mais que o normal; você pode sair e voltar a esta página" e passa a consultar a cada 10 s. Não inventa um estado novo. [Feito no F5] Os 10 minutos contam **desde que a tela abriu**, não desde o envio: quem reabre o link horas depois só vê o aviso 10 minutos depois.
- Hash: aparece quando o Core API o informa. Enquanto `PENDING` ele é **provisório** (o Blockchain Service pode apagá-lo se a rede recusar), então é rotulado assim e o link do explorador só aparece em estado final. Em `CONFIRMED` mostra o link. Em `FAILED` com hash (`TRANSACTION_REVERTED`) também.
- Motivos de falha em português: `REJECTED_BY_NETWORK` ("A rede recusou a transação. Verifique se o saldo cobre o valor mais a taxa."), `TRANSACTION_REVERTED` ("A transação foi executada e revertida."), `INTERNAL_ERROR` ("Falha interna ao processar. Tente novamente.").
- Ao chegar a `CONFIRMED`, o saldo é considerado desatualizado e a carteira o relê ao voltar.
- **Detalhes feitos no F5** [Decidido, 17/11/2026]: o `taskId` da resposta é comparado sem diferenciar maiúsculas (o Core API devolve em minúsculas, conferido por `curl`); `status` fora de `PENDING`, `CONFIRMED` e `FAILED`, `amountEth` que não seja decimal simples, e hash ou motivo que não sejam texto tornam a resposta inválida; o texto do motivo de falha vem só do mapa local, nunca do servidor (código desconhecido mostra uma mensagem genérica); destino, valor e identificador têm botão de copiar; "Hash provisório" traz a frase de que ele pode sumir; o link do explorador avisa "(abre em nova aba)" ao leitor de tela; o esqueleto tem versão clara para o fundo claro. O ciclo do polling guarda o estado dentro do efeito, o que é seguro no `StrictMode`.

## 7. Histórico de transações [Decidido, 18/11/2026: opção D, sem chave de API, consulta no External Data Service]

O Core API **não tem rota para listar transações**: só `POST /transactions` e `GET /transactions/{taskId}`. Consequências:

- O usuário só chega a uma transação pelo `taskId` (a URL). Se fechar a aba durante um `PENDING` e não guardou o link, **não tem como reencontrá-la**.
- Também não há "atividade recente" na carteira, que é o que dá aparência de produto pronto a uma carteira.
- Depois de um timeout no envio, não há como conferir se a solicitação foi aceita.

Alternativas:

| Opção | O que é | Prós | Contras |
|---|---|---|---|
| A. Sem histórico | Só o acompanhamento por URL | Nenhum trabalho extra; atende a Entrega 1 e a Especificação, que não pedem histórico | Carteira "pelada"; transação pendente pode ser perdida de vista |
| B. Lista local | O Frontend guarda os `taskId` enviados no navegador (por usuário) e consulta cada um | Sem mudar o Core API | Some ao trocar de navegador ou limpar dados; mais consultas; não resolve o timeout do envio |
| C. Rota nova no Core API | `GET /transactions` (do usuário do token, mais recentes primeiro, com limite fixo, por exemplo 20) | Resolve os três pontos; é uma leitura do `eth_transaction` que já existe; um passo pequeno | Uma ficha nova (CT) e um passo C10 no Core API; fora da Especificação. Lista só o que a Lemma enviou (não mostra o que a carteira recebeu) |
| D. Histórico lido da blockchain | O External Data Service consulta um indexador público pelo endereço da carteira, o Core API repassa e o Frontend lista | Mostra também o que a carteira **recebeu** (faucet, abastecimento) e o que de fato está na rede; reencontra um envio mesmo quando o Core API não gravou a linha (o 500 do CT9); não depende do navegador | Mexe em três módulos e cria uma dependência externa nova (disponibilidade, limite de uso); só enxerga o que já foi minerado (sem `PENDING`, sem `REJECTED_BY_NETWORK`, sem `taskId`); fichas novas fora da Especificação |

**Recomendação (revista em 18/11/2026, depois do F5).** Se o histórico entrar, prefiro **D a C**. C é mais barato (um passo no Core API), mas lista só o que a Lemma enviou, e o primeiro evento de toda carteira é justamente o que ela **recebeu** (o abastecimento). D custa mais e é a única que mostra o que aconteceu na rede, inclusive um envio que o Core API não chegou a gravar. Se o tempo apertar, o mínimo é o atalho no `sessionStorage` descrito abaixo, ou A. Nada disso bloqueia o F6: o histórico não é requisito da Especificação nem da Entrega 1, e o painel de mercado (E6, E7) é; por isso o histórico vem **depois do F6**. [Decidido pelo Igor em 18/11/2026: opção D, com o Blockscout público e **sem chave de API**, e a consulta ao indexador no **External Data Service**, não no Blockchain Service. Limite e formato conferidos por `curl` em 18/11/2026; o caso do faucet que paga por contrato segue não testado, abaixo.]

### 7.1 Opção D em detalhe [Sugestão, 18/11/2026]

- **Por que o RPC sozinho não serve.** O JSON-RPC padrão não tem "listar as transações de um endereço". O `eth_getLogs` filtra eventos, e uma transferência simples de ETH não emite evento. Varrer bloco por bloco pelo PublicNode não é viável (milhares de blocos por dia e limite do provedor). É preciso um **indexador**.
- **Candidatos** [Verificado em 18/11/2026 na documentação e por `curl` no Blockscout]: o Blockscout público da Sepolia (`eth-sepolia.blockscout.com`, rota REST `/api/v2/addresses/{endereço}/transactions`, sem chave; [Verificado em 18/11/2026 por `curl`] a instância pública responde `x-ratelimit-limit: 180`, em janela fixa de 60 s alinhada ao minuto) e o Etherscan V2 (`chainid=11155111`, ação `txlist`, com chave gratuita de 5 chamadas por segundo e 100.000 por dia). Para o Etherscan, a documentação diz que o plano gratuito cobre só parte das redes e anuncia redução do máximo de registros por requisição na camada gratuita (vigência 01/07/2026, com `txlist` entre os endpoints afetados): **conferir se a Sepolia segue gratuita** antes de escolhê-lo. [Decidido] Blockscout, sem chave (180 requisições por minuto, verificado em 18/11/2026; suficiente com o cache de 12 s do External Data Service); chave gratuita só se o limite real apertar; Etherscan fica como reserva.
- **Onde fica** [Decidido, 18/11/2026]. O Frontend só fala com o Core API, e as integrações com APIs de terceiros ficam no External Data Service (que já traz a CoinGecko). Então: o External Data Service ganha uma operação de histórico por endereço (cliente do Blockscout, com ficha nova), o Core API ganha uma rota por analogia com `GET /wallet/balance` (o endereço vem do usuário do token, nunca da entrada) que chama o External Data Service, e o Frontend lista (F8). O Blockchain Service, já pronto e provado, **não muda**, e o Core API não chama o indexador direto. Divergência com a Especificação, a registrar no relatório: o External Data Service é descrito como integração de "APIs externas de mercado", e passa a servir também o histórico da carteira.
- **O que a lista mostra.** Hash (com link para o explorador), direção (enviada ou recebida, comparando com o endereço da carteira), a outra ponta, valor em ETH como **texto exato** (do valor em wei por `BigDecimal`, sem `double`), data e estado (confirmada ou falha na rede). Primeira página fixa (por exemplo 20), sem paginação.
- **Limites a aceitar e registrar.** (1) Só aparece o que foi minerado: o `PENDING` segue no acompanhamento do F5, e a janela é de poucos blocos (~12 s cada na Sepolia). (2) O indexador atrasa um pouco depois do bloco. (3) Indexador fora do ar não pode derrubar a carteira: a lista mostra "histórico indisponível" e o resto funciona (o 502 do saldo já segue esse padrão). (4) Transferências que chegam **por contrato** (alguns faucets pagam assim) são "transações internas" e não vêm na rota de transações normais: o depósito de 0,0005 ETH da carteira de demonstração apareceu como transação comum [Verificado em 18/11/2026], mas o caso do faucet que paga por contrato não foi testado. (5) Cache de 12 s por endereço no External Data Service [Feito no E3, 18/11/2026]. (6) Fichas novas, README e uma rodada do roteiro ponta a ponta.
- **Passos sugeridos** (nomes e numeração a definir): um no External Data Service (operação de histórico, ficha, testes, feito junto com o resto do serviço), um no Core API (rota, ficha, testes) e o F8 no Frontend.

**Custo e riscos do C10** (registrado em 17/11/2026; vale também para a rota do Core API na opção D, decidida em 18/11/2026): não há problema técnico; é decisão de escopo. (1) Reabre o Core API, que está completo e provado na Sepolia (C1 a C9, 392 testes), por uma rota que a Especificação entregue não tem: exige ficha nova, teste, atualização do README e uma nova rodada do roteiro ponta a ponta. (2) Precisa conferir se a tabela `eth_transaction` guarda destino, valor e data (sem isso a lista mostraria só estado e hash; na opção D não faz diferença, porque os dados vêm do indexador). (3) A banca não exige histórico; o ganho é de produto. Por isso a decisão ficou para depois do F5: com o fluxo principal funcionando e o tempo restante conhecido, escolhe-se C ou D (F8) ou o mínimo que não mexe nos outros módulos, que é guardar no `sessionStorage` o `taskId` da última transação enviada e mostrar um atalho "Acompanhar a última transação" na carteira.

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
| Dockerfile | Multi-stage: etapa Node faz o `npm ci` e o `npm run build`; etapa final `nginx-unprivileged` (tag fixa) serve a pasta `dist` com **fallback de SPA** (`try_files $uri /index.html`), usuário não root quando a imagem permitir |
| Compose do repositório | Serviço `frontend`, porta publicada em **`127.0.0.1:5173`** (o container escuta em **8080**, porque a imagem `nginx-unprivileged` roda sem root; mapeamento `127.0.0.1:5173:8080`) |
| Por que 5173 | É a origem que o Core API já libera (`CORS_ALLOWED_ORIGIN=http://localhost:5173`): **nenhuma mudança no Core API**. O Core API compara a origem como texto exato: abra `http://localhost:5173`, nunca `http://127.0.0.1:5173` |
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
  lib/         format.ts (ETH por texto), market.ts (USD e variação), instant.ts (datas), validate.ts
  styles/      index.css (Tailwind e os tokens da seção 4)
  assets/brand logos, símbolo, mascote e favicon copiados de lemma-artes
```

[Feito no F6, 19/11/2026] USD e variação ficam em `lib/market.ts`, não em `format.ts`: o `format.ts` passa pela varredura "ETH sem Number" e o mercado usa `Number` de propósito (só para exibir, seção 8).

Regras: página não chama `fetch`; só chama `api/`. `api/` não conhece React. A lógica de polling mora num hook testável com relógio falso. Os SVG da marca entram como arquivos, sem alteração.

## 13. Testes e ordem de implementação

### 13.1 Testes

1. **Unitários:** `format` (ETH por texto sem `Number`, casas, vírgula e ponto), validação de e-mail, senha (mínimo de 8 caracteres e máximo de 72 **bytes**), endereço e valor, mapa de erros, reviver decimal (com e sem `context`), cálculo da variação.
2. **Hooks com relógio falso:** `useTransactionPolling` (para em estado final; nunca duas requisições em voo; recua o intervalo em falha; pausa com a aba escondida; cancela ao sair; aviso aos 10 minutos) e o cache de 60 s do mercado.
3. **Componentes:** formulários (mensagens por `code`, botão desabilitado durante a requisição, trava de clique duplo com dois cliques seguidos gerando **uma** chamada), `RequireAuth`, tratamento de `TOKEN_INVALID`, contagem regressiva do `429`.
4. **Roteiro manual ponta a ponta** (Core API e Blockchain Service reais, na Sepolia): cadastrar, entrar, ver saldo, abastecer o usuário pelo procedimento já documentado no README do Core API ("Como abastecer a carteira de um usuário"), enviar, ver `PENDING` virar `CONFIRMED` sem recarregar, conferir o saldo; depois um envio que a rede recusa (valor acima do saldo) e ver `FAILED`. O teste de carga do E7 (H10.2) passa pelo Frontend só para ver a mensagem de limite.
5. **Verificações visuais** (manual, por tela): os contrastes da seção 4, foco visível, 360 px de largura, `prefers-reduced-motion`.

### 13.2 Passos

Um passo por card do OpenProject, um commit por mudança coerente, rodapé `OP#<id>`. Os commits do repositório saem da conta do Igor. Números dos cards levantados no histórico da revisão do backlog (18/10/2026): H05.3 (#878, envio) e H08.3 (#887, acompanhamento) confirmados pelo texto; H02.3 (#870), H03.2 (#872), H04.3 (#875) e H06.3 (#881) pela numeração das tasks do Frontend. O padrão se repete em todos os pares confirmados (o card do Core API é N e o do Frontend é N+1: H02.2 #869 → H02.3 #870, H03.1 #871 → H03.2 #872, H05.2 #877 → H05.3 #878, H08.2 #886 → H08.3 #887, H04.2 #874 → H04.3 #875, H06.2 #880 → H06.3 #881), o que dá confiança nos números; o Igor confere o título de cada um no OpenProject ao usá-lo.

| # | Passo | Pronto quando | Card |
|---|---|---|---|
| F1 | Esqueleto Vite + TS + Tailwind + Router; tokens da seção 4; fonte; Dockerfile, nginx e compose na porta 5173; ativos da marca; cabeçalho com o logo; cliente da API (erros, decimal, tempo limite); `.env.example`; `docs/desenho-frontend.md` no repositório | `docker compose up` serve o app em `http://localhost:5173` com o logo e o favicon; recarregar uma rota profunda não dá 404; testes do cliente e do reviver verdes | H01.5 (#1315, parte Frontend) e H01.2 (#865, parte Frontend). **Feito em 17/11/2026** (12 commits na branch `h01-5-frontend-esqueleto`; 56 testes; favicon "L" gerado da `Jost.ttf` conforme a seção 8 do guia) |
| F2 | Cadastro (com a tela de confirmação), login, `AuthContext`, `sessionStorage`, `RequireAuth`, tratamento centralizado de `TOKEN_INVALID` | Cadastrar, ver o endereço, entrar, recarregar mantendo a sessão, token vencido volta ao login, senha errada mostra a mensagem e não guarda token | H02.3 (#870, cadastro) e H03.2 (#872, login). **Feito e enviado em 17/11/2026** (7 commits, origin/main em `09a3dc1`; 155 testes; `lucide-react` 1.73.0; Core API exercitado com `curl` a partir da origem `http://localhost:5173`; roteiro de cadastro e login validado no navegador) |
| F3 | Carteira: cartão de saldo, copiar endereço, "Receber", esqueletos | Saldo real do Core API em texto, sem perda de dígitos; 502 do saldo mostra estado de erro com nova tentativa | H04.3 (#875). **Feito e enviado em 17/11/2026** (6 commits, origin/main em `2bc19b2`; 228 testes; saldo como texto exato, exibido cortado em 6 casas e nunca arredondado para cima, com a linha "Valor exato" quando há dígitos escondidos; validado no navegador com saldo real recebido pelo faucet) |
| F4 | Envio: formulário, revisão, trava de clique duplo, erros por `code` | Um envio real devolve `202` e abre `/transacoes/{taskId}`; dois cliques seguidos fazem **uma** chamada; endereço e valor inválidos mostram a mensagem certa | H05.3 (#878). **Feito e enviado em 17/11/2026** (4 commits, origin/main em `d0c762d`; 326 testes; envio real com saldo feito pelo navegador e conferido no Etherscan; o agente provou 202, `ADDRESS_INVALID` e `AMOUNT_INVALID` por `curl`) |
| F5 | Acompanhamento: polling, linha do tempo, hash, motivos de falha, aviso de demora | `PENDING` vira `CONFIRMED` sem recarregar; `FAILED` mostra o motivo; sair da tela cancela o polling; saldo atualiza ao voltar | H08.3 (#887). **Feito e enviado em 17/11/2026** (5 commits, origin/main em `c6fdcd3`; 438 testes; polling com recuo, pausa na aba escondida e aviso de demora; hash provisório sem link enquanto `PENDING`, link do Etherscan só em estado final; validado com envios reais pelo Core API) |
| F6 | Mercado: painel, gráfico SVG, cache de 60 s, `429` com contagem, `502` | Contra o External Data Service real ou um falso: preço e gráfico; `429` mostra a contagem e libera o botão ao fim; `502` mostra "indisponível" sem afetar o saldo | H06.3 (#881). **Feito em 19/11/2026** (7 commits; 530 testes; preço e série reais conferidos por `curl` pelo Core API e o corpo real aceito pela validação; `429` e `502` provados por testes e por um servidor falso temporário fora do repositório) |
| F7 | Acabamento: acessibilidade, movimento, 404, README do Frontend, roteiro manual ponta a ponta registrado | Roteiro 4 da seção 13.1 passa; contrastes e 360 px conferidos | H04.4 (#1317, parte Frontend) e cards de teste |
| F8 (se o histórico entrar: opção C ou D da seção 7) | Lista de atividade na carteira, depois do passo C10 no Core API (e, na D, da operação de histórico no External Data Service) | Lista das últimas transações do usuário, cada uma com link ao explorador (D) ou ao acompanhamento (C) | novo (a criar) |

Dependências: F1 antes de todos; F2 antes de F3 a F6; F4 antes de F5; F6 não depende de F4 nem de F5 e pode ser feito antes se convier; F8 depende do C10 e da operação de histórico no External Data Service. Ordem a partir do F5 [Decidido, 18/11/2026]: External Data Service (mercado primeiro, histórico depois), F6, C10 no Core API, F8, F7 por último, porque o F7 registra o roteiro ponta a ponta e deve cobrir tudo o que entrou.

## 14. Decisões e divergências

### Decisões (1 a 4 e 6 a 8 em 17/11/2026; a 5 em 18/11/2026)

1. **Camada de produto da seção 4** (tons derivados, Jost em tudo, um tema só). É decisão sua, porque o guia a deixou aberta.
2. **Cinco momentos visuais da seção 5**, em particular o mascote grande só na entrada.
3. **Sem bibliotecas de dados, formulários, gráfico e animação** (seção 3); gráfico em SVG próprio.
4. **Token em `sessionStorage`** (seção 9).
5. **Histórico:** opção D (seção 7), lida da blockchain pelo Blockscout público, sem chave, com a consulta no External Data Service. [Decidido, 18/11/2026]
6. **Mercado com cache de 60 s em memória** para não esgotar o limite global (seção 6.2).
7. **Cadastro termina na tela de confirmação com o endereço**, sem login automático (segue o E1/E2).
8. **Passos F1 a F7**, com os cards da seção 13.2. [Decidido]

Status: 1, 2, 3, 4, 6, 7 e 8 [Decidido, 17/11/2026]; 5 [Decidido, 18/11/2026]. O Blockscout foi conferido por `curl` em 18/11/2026 (limite de 180 por minuto e formato dos campos); o caso do faucet que paga por contrato segue não testado (seção 7.1).

### Abertos que não bloqueiam

- Tema escuro completo, QR code de "Receber" e histórico: ficam depois.
- External Data Service: construído em 18/11/2026 (E1 a E3, `main` em `9436ac7`, 87 testes); o mercado real já responde pelo Core API, e o histórico por endereço já existe no External Data Service (falta a rota do Core API, C10, e a lista, F8).
- Tempo limite de task e retentativa de webhook (P4): do backend; o Frontend só mostra o aviso de demora.
- A formulação final de "Frontend sem responsável" na Especificação: passa a valer "Igor", como decisão posterior à Entrega 2.

### Divergências da Especificação (vão ao relatório final)

1. **Responsável do Frontend:** a Especificação diz "sem responsável definido"; passa a ser o Igor (decidido em 16/11/2026).
2. **Limite de gás (P8):** o Blockchain Service assina com 500.000, não 21.000, e um envio a conta nova gastou ~204.600 no C9. Efeito no Frontend: sem botão "enviar tudo" e mensagem de folga.
3. **Mascote e interface:** o guia limita onde o mascote pode aparecer; a seção 5 respeita isso.
4. **Favicon:** o pacote `lemma-artes` (v2) traz o favicon com o rosto, que o guia (seção 8) diz ter sido descartado. O "L" oficial vive no kit `lemma-identidade-final/favicon/`, fora do Project; o repositório usa um "L" gerado da `Jost.ttf` (instância 500) com as medidas do guia. Trocar pelo do kit se ele estiver disponível.
5. **Porta interna:** 8080, não 80 (imagem `nginx-unprivileged`).
6. **Senha:** mínimo de 8 caracteres (code points) e máximo de 72 bytes, não "8 a 72 bytes".
7. **Histórico de transações:** a Especificação não tem histórico e descreve o External Data Service como integração de "APIs externas de mercado". Passa a existir um histórico por endereço, lido do Blockscout pelo External Data Service e repassado pelo Core API (decidido em 18/11/2026).