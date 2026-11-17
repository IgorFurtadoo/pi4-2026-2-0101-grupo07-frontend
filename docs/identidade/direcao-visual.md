# Guia de identidade visual — Lemma
 
Versão de 08/10/2026. Documento de trabalho da equipe. A identidade está fechada; este guia consolida as escolhas já feitas e não abre novas comparações. A identidade não é avaliada pela banca. As escolhas são estéticas, sem validação com usuários e sem pretensão de exclusividade comercial.
 
**Escopo.** Este guia trata só da marca: nome, logo, símbolo, mascote, paleta, tipografia da marca, favicon e regras de aplicação. Ele é independente de qualquer interface. Os exemplos ilustram as regras, mas não definem como o aplicativo funciona nem como as telas serão desenhadas. A seção 10 lista o que ficou fora.
 
Legenda: **[decidido]** decisão da equipe · **[verificado]** conferido por medida ou cálculo nos arquivos · **[leitura]** interpretação, não fato · **[exemplo]** ilustração sem obrigatoriedade · **[em aberto]** ainda falta registrar ou decidir · **[melhoria posterior]** não bloqueia o uso.
 
## 1. Resumo
 
| Item | Decisão |
|---|---|
| Nome | Lemma |
| Wordmark | Jost 400, inicial maiúscula, espaçamento 0, em contornos |
| Logo | Rosto compacto do mascote (símbolo) à esquerda do wordmark. Arquivos do pacote v2 |
| Mascote | Lêmure compacto aprovado, arquivo `lemma-mascote.svg` do pacote v2 |
| Paleta principal | Azul `#2447C6`, coral `#F47762`, branco suave `#F5F7FA`, azul-noite `#151D35` |
| Tipografia da marca | Jost (wordmark em 400, favicon em 500) |
| Favicon | “L” em Jost 500, branco suave `#F5F7FA` sobre quadrado azul-noite `#151D35` |
| Acabamento vetorial | Pequenos ajustes de contorno ficam como melhoria posterior |
 
## 2. Nome
 
- [decidido] **Lemma**, sempre com inicial maiúscula e o resto em minúsculas, no wordmark e no texto corrido.
- [leitura] O nome soa parecido com “lêmure”, o que liga o mascote ao nome. O risco é a grafia errada “Lemur” em buscas e na comunicação. Escrever sempre “Lemma” por extenso.
- [verificado em rodada anterior] Existe um protocolo DeFi chamado Lemma. Tratar como nome interno do projeto, sem registro verificado.
## 3. Logo
 
### 3.1 Composição
 
O logo (assinatura) é o símbolo, o rosto do mascote, à esquerda do wordmark “Lemma”. A composição é fixa. Usar sempre os arquivos do pacote, sem redesenhar nem redigitar o wordmark.
 
Medidas na prancheta do arquivo, 1320 × 480 unidades [verificado]:
 
| Medida | Valor |
|---|---|
| Proporção da prancheta | 2,75 : 1 |
| Área desenhada | 1249 × 391 (cerca de 3,2 : 1) |
| Símbolo | 485 × 391 (largura cerca de 1,24 × a altura) |
| Altura do wordmark (topo do “L” à linha de base) | 171 |
| Símbolo em relação ao wordmark | 2,3 × a altura do wordmark |
| Espaço entre símbolo e wordmark | 64, cerca de 0,37 × a altura do wordmark |
| Alinhamento vertical | wordmark centrado na altura do símbolo (diferença de 2 unidades) |
| Margens internas da prancheta | 26 a 47 unidades |
 
Regra de proporção: escalar sempre o arquivo inteiro, mantendo a proporção. Não esticar, não comprimir e não mudar a distância entre símbolo e wordmark.
 
### 3.2 Versões e fundos permitidos
 
| Versão | Arquivo | Fundo permitido | Cores |
|---|---|---|---|
| Claro | `lemma-logo-claro.svg/.png` | branco suave `#F5F7FA` ou branco | símbolo em quatro cores, wordmark azul |
| Escuro | `lemma-logo-escuro.svg/.png` | azul-noite `#151D35` | símbolo em quatro cores, wordmark branco suave |
| Fundo azul | `lemma-logo-fundo-azul.svg/.png` | azul `#2447C6` | símbolo com halo branco suave, wordmark branco suave |
| Uma tinta | `lemma-logo-uma-tinta.svg/.png` | qualquer fundo liso com contraste suficiente | uma cor, com vazados transparentes; a cor pode ser adaptada |
 
- [verificado] Wordmark azul sobre branco suave: 7,0 : 1. Wordmark branco suave sobre azul-noite: 15,5 : 1. Halo branco suave sobre azul: 7,0 : 1.
- [verificado] Sobre azul-noite, o azul da cabeça tem só 2,2 : 1. No escuro, quem desenha a cabeça é o rosto branco suave. Por isso o logo escuro não deve ser usado abaixo do tamanho mínimo.
- Fundos fora da tabela (coral, fotografias, gradientes, texturas, outras cores) não foram definidos. Se precisar, usar a versão de uma tinta sobre área lisa e conferir o contraste. Não colocar a versão em cores sobre fundo coral.
### 3.3 Área de proteção
 
- [decidido, LEIA-ME v2] Área livre ao redor do logo: **metade da altura do wordmark**.
- [verificado] Na prancheta, isso dá cerca de 86 unidades, ou 18% da altura total do arquivo. Exemplo: com o arquivo a 40 px de altura, cerca de 7 px livres em cada lado.
- [verificado] As margens internas da prancheta (26 a 47 unidades) são menores que a área de proteção. A área livre deve ser medida a partir do desenho, e não da borda do arquivo.
- [leitura] “Altura do wordmark” é lida aqui como a altura do “L”, a letra mais alta.
### 3.4 Tamanhos mínimos
 
| Elemento | Mínimo | Observação |
|---|---|---|
| Logo completo | 32 px de altura total (prancheta) | O LEIA-ME v2 recomenda 40 px em cabeçalhos. A 24 px de altura total o wordmark fica pequeno demais [leitura]. |
| Símbolo isolado | 24 px | Preferir 32 px. A 16 px vira uma mancha [leitura]. |
| 16 px ou menos | não usar logo nem símbolo | Usar o favicon (seção 8). |
 
[verificado] A 32 px de altura total, o “L” do wordmark tem cerca de 11 px; a 40 px, cerca de 14 px. Tamanhos para impressão não foram definidos.
 
### 3.5 Usos a evitar
 
- Redigitar o wordmark com a fonte em vez de usar o arquivo.
- Mudar a fonte, o peso, o espaçamento ou a caixa (“LEMMA”, “lemma”).
- Distorcer, girar, inclinar ou espelhar.
- Trocar a posição do símbolo ou mudar o espaço entre símbolo e wordmark.
- Recolorir partes da versão em cores ou usar cores fora da paleta.
- Aplicar sombra, contorno extra, brilho, gradiente ou transparência parcial.
- Usar a versão clara no escuro ou a escura no claro.
- Usar o logo completo como favicon ou abaixo do tamanho mínimo.
## 4. Símbolo
 
O símbolo é o rosto do mascote: cabeça azul, parte interna das orelhas coral, rosto branco suave e máscaras dos olhos e do focinho em azul-noite.
 
| Versão | Arquivo | Uso |
|---|---|---|
| Cores | `lemma-simbolo.svg/.png` | fundos claros |
| Fundo azul | `lemma-simbolo-fundo-azul.svg/.png` | fundo azul, com halo |
| Uma tinta | `lemma-simbolo-uma-tinta.svg/.png` | uma cor, com vazados transparentes |
 
- [verificado] Prancheta de 510 × 420 unidades, desenho de 485 × 391.
- O símbolo segue as mesmas regras de proporção, fundo e alteração do logo.
- [leitura, por analogia ao logo] Área livre de cerca de 22% da altura do símbolo, a mesma folga que ele tem dentro do logo.
## 5. Mascote
 
### 5.1 Aparência
 
[decidido] Lêmure compacto, sentado, em vista de três quartos.
 
- Cabeça grande, levemente inclinada, com orelhas arredondadas de parte interna coral.
- Rosto branco suave com máscaras azul-noite ao redor dos dois olhos e no focinho. Olhos brancos com pupilas escuras, olhando para o lado. Pequeno sorriso.
- Corpo azul com peito branco suave e uma faixa branca nas patas dianteiras.
- Pés em azul-noite.
- Cauda grande, enrolada atrás do corpo, à direita, em anéis: ponta coral, seguida de faixas branco suave e azul alternadas.
Intenção: proximidade, amizade e facilidade, sem abandonar a sobriedade da marca.
 
### 5.2 Cores
 
[verificado] O arquivo usa só as quatro cores da paleta principal. Participação aproximada na área desenhada:
 
| Cor | Partes | Área |
|---|---|---|
| Azul `#2447C6` | cabeça, corpo, anéis da cauda | cerca de 50% |
| Branco suave `#F5F7FA` | rosto, peito, faixas das patas e da cauda | cerca de 28% |
| Azul-noite `#151D35` | máscaras, pupilas, focinho, pés | cerca de 13% |
| Coral `#F47762` | orelhas, ponta da cauda | cerca de 9% |
 
O azul domina e o coral fica restrito a acentos. Essa distribuição faz parte do personagem e não deve ser invertida.
 
### 5.3 Proporções
 
[verificado] Prancheta quadrada de 1254 × 1254 unidades, com fundo transparente. O desenho ocupa cerca de 873 × 875 unidades, ou seja, é praticamente tão largo quanto alto, com margem de 170 a 210 unidades em cada lado.
 
[leitura, medida aproximada] A cabeça ocupa cerca de metade da altura do personagem, e a cauda cerca de 40% da largura. A cabeça grande é o que o torna “compacto” e deve ser mantida.
 
### 5.4 Fundos
 
- [verificado] As partes branco suave têm a mesma cor do fundo branco suave, e os pés têm a mesma cor do fundo azul-noite. O mascote pode ser usado sobre os dois, mas perde o contorno do rosto e do peito no claro e o dos pés no escuro.
- [exemplo] Um disco ou área de apoio atrás do mascote resolve essa perda. Nos estudos foram usados `#C9D4F5` no claro e `#2B3659` no escuro. São exemplos de aplicação, não cores oficiais nem obrigatórias.
- Sobre azul `#2447C6`, o corpo se confunde com o fundo. Evitar, ou usar com área de apoio.
### 5.5 Usos permitidos
 
- Ilustração de apoio: boas-vindas, apresentação, ajuda, documentação, relatório, slides e materiais da banca.
- Um mascote por peça, com espaço ao redor, sem competir com o conteúdo principal.
- Com texto ao lado, nunca como portador único de uma mensagem.
- No logo e no ícone, só a versão simplificada (o símbolo). O personagem completo não substitui o logo.
- [leitura] É uma ilustração de marca, não um ícone nem um sinal. Não usar para indicar sucesso, erro, alerta ou progresso. Se o mascote for removido, nenhuma informação deve se perder.
- Movimento, se houver, deve ser opcional e respeitar a preferência de movimento reduzido do sistema.
### 5.6 Alterações a evitar
 
- Recolorir ou usar cores fora da paleta (por exemplo, coral nas máscaras ou azul nas orelhas).
- Usar a prévia raster original (PNG com fundo e cores aproximadas) no lugar do arquivo do pacote v2.
- Distorcer, esticar ou mudar a proporção da cabeça em relação ao corpo.
- Cortar orelhas, cauda ou pés, ou recortar só uma parte do corpo. O recorte aprovado é o símbolo.
- Mudar a pose, a expressão ou o olhar, ou criar novas versões sem aprovação da equipe.
- Adicionar acessórios, roupas, contornos, sombras, brilhos, gradientes ou texturas.
- Colocar texto dentro do desenho ou balões de fala atribuídos a ele.
- Espelhar. [leitura] Espelhar inverte o lado da cauda e do olhar e não está previsto.
## 6. Paleta principal
 
| Nome | Hex | RGB | Papel na marca |
|---|---|---|---|
| Azul | `#2447C6` | 36, 71, 198 | cor principal do símbolo, do mascote e do wordmark no claro |
| Coral | `#F47762` | 244, 119, 98 | acentos: orelhas e ponta da cauda |
| Branco suave | `#F5F7FA` | 245, 247, 250 | fundo claro, rosto do mascote, wordmark no escuro |
| Azul-noite | `#151D35` | 21, 29, 53 | fundo escuro, máscaras e pés do mascote |
 
Só estas quatro cores fazem parte da paleta oficial. Tons derivados usados nos estudos de tela não são cores da marca.
 
**Contrastes** [verificado, razão WCAG]. Texto precisa de 4,5 : 1; elementos gráficos, de 3 : 1.
 
| Par | Razão | Consequência |
|---|---|---|
| Branco suave e azul-noite | 15,5 : 1 | passa |
| Azul e branco | 7,5 : 1 | passa |
| Azul e branco suave | 7,0 : 1 | passa |
| Coral e azul-noite | 6,1 : 1 | passa |
| Coral e azul | 2,7 : 1 | não passa; só detalhe decorativo |
| Coral e branco suave | 2,6 : 1 | não passa; coral não é texto no claro |
| Azul e azul-noite | 2,2 : 1 | não passa; azul não serve como texto nem traço fino no escuro |
 
Regra: nenhuma informação depende do coral nem da diferença entre azul e coral. O coral é acento.
 
## 7. Tipografia da marca
 
- [decidido] **Jost** é a fonte da marca.
  - Wordmark: Jost 400, espaçamento 0, inicial maiúscula. [verificado] Os contornos dos arquivos são iguais aos da Jost 400.
  - Favicon: “L” em Jost 500.
- Licença SIL Open Font License (OFL). O arquivo `Jost.ttf` e a licença acompanham o pacote.
- O wordmark é usado sempre como arquivo em contornos. A fonte só é necessária para gerar novas peças da marca, como o favicon.
- [em aberto] O uso da Jost em títulos ou textos de comunicação (slides, relatório) não foi decidido. A tipografia do produto está fora deste guia (seção 10).
## 8. Favicon
 
- [decidido] “L” em Jost 500, branco suave `#F5F7FA` sobre quadrado azul-noite `#151D35`. O favicon com o rosto da v2 foi descartado.
- [verificado] Contraste do “L” sobre o quadrado: 15,5 : 1.
- [verificado] Prancheta de 180 × 180, quadrado inteiro sem cantos arredondados desenhados. O “L” ocupa 59 × 104 unidades (cerca de 58% da altura) e está centrado nos dois eixos. A haste tem 17,7 unidades de espessura e a base 15,9.
- Arquivos: `favicon.svg`, `favicon.ico` (16, 32 e 48 px), `favicon-16x16.png`, `favicon-32x32.png`, `favicon-64x64.png` e `apple-touch-icon.png` (180 px), todos opacos.
- Não substituir pelo logo nem pelo símbolo em 16 px.
## 9. Arquivos da marca
 
No kit `lemma-identidade-final`, o que pertence a este guia:
 
| Pasta | Conteúdo |
|---|---|
| `marca/` | logo (claro, escuro, fundo azul, uma tinta), símbolo (cores, fundo azul, uma tinta) e mascote, em SVG e PNG com transparência; `LEIA-ME-v2.md` |
| `favicon/` | favicon “L” (SVG, ICO, PNG) e `LEIA-ME.md` |
| `fontes/` | `Jost.ttf` e licença OFL |
 
[verificado] Os SVGs do pacote v2 têm só caminhos, sem imagem embutida, fonte, filtro ou referência externa, e usam só as quatro cores da paleta.
 
O kit também contém `css/`, `referencia.html`, o `LEIA-ME.md` da raiz e a nota sobre a Source Sans 3. Esses arquivos são estudos de aplicação feitos antes desta correção de escopo. Foram mantidos como estão, mas não fazem parte do guia e não são requisitos do produto. O mesmo vale para os artefatos “Logo Lemma aplicado”, “Tipografia da interface” e “Interface Lemma”.
 
## 10. Fora do escopo
 
Estes pontos não fazem parte da identidade visual e não são decididos por este guia:
 
- Tipografia do produto: fonte da interface, tamanhos de texto, alturas de linha e algarismos tabulares. A aprovação da Source Sans 3 foi retirada.
- Tons derivados para a interface (superfícies, linhas, textos secundários, azul claro, verdes de estado). Saíram da paleta oficial.
- Cabeçalho, cartão de saldo, botões, listas, formulários, estados de transação, mensagens do sistema, telas e layout em geral.
- Em que telas do aplicativo o mascote aparece. A seção 5 diz como usá-lo, não onde ele entra no produto.
As telas produzidas até aqui serviram como estudos visuais para testar a marca. As características delas não devem virar requisitos.
 
## 11. Pendências
 
- [melhoria posterior] Pequenos ajustes nos contornos do símbolo e do mascote: degraus no topo das máscaras, recorte reto na parte interna da orelha esquerda, irregularidades na cauda. Só aparecem em ampliação.
- [em aberto] Origem do mascote: a imagem de partida foi gerada pela equipe com uma ferramenta de geração de imagens. Falta registrar no relatório a ferramenta, a data e os termos de uso. Essa informação não consta nos arquivos.
- [em aberto] Uso da Jost em materiais de comunicação (seção 7).
## 12. Histórico resumido
 
- Nome: comparados Lemma, Nonius, Ellipsis (parado por colisão), Lexeme, Siglum e Radix (descartado por colisão). Os registros do teste foram inventados para o exercício e não valem como pesquisa. Lemma foi escolhido por preferência estética.
- Wordmark: Jost 400, espaçamento 0, depois de comparar pesos, espaçamentos e famílias.
- Símbolos: três quadrados, Arco, L em sobreposição e Seixo partido, todos descartados com a adoção do mascote.
- Paletas: ameixa e cobre (não aprovada), azul e coral (adotada).
- 08/10/2026: pacote v1 do logo recebido e conferido; pacote v2 recebido, conferido e adotado; favicon da v2 descartado; favicon “L” definido em Jost 500, branco suave sobre azul-noite.
- 08/10/2026: correção de escopo. O documento passou a ser só o guia de identidade. Saíram as decisões de interface (cabeçalho, saldo, botões, estados, mensagens, telas, layout), a Source Sans 3, os tamanhos de texto do produto e os tons derivados. Os discos atrás do mascote ficaram como exemplo.
