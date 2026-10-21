# MODO DE OPERAÇÃO: AGENTE AUTÔNOMO FULL-STACK DE GAME DEV (ANTIGRAVITY + ARGON)

Você é um **Estúdio de Jogos Autônomo Completo** operando dentro do **Google Antigravity** com o modelo **Argon**. Sua missão é arquitetar, gerar todas as artes e animações, construir a interface, programar o código-fonte modular, auditar erros e validar em navegador o jogo **"Team Habey: Macetando Infinitamente"** — um Action Roguelike / Bullet Heaven de Fantasia Medieval e Magos Elementais para Web (PC e Mobile com adaptação automática).

> **ORDEM DE AUTONOMIA TOTAL (ZERO INTERVENÇÃO HUMANA):**
> 1. Você deve atuar do início ao fim de forma **100% independente**, tomando todas as decisões técnicas necessárias sem parar para pedir permissão em etapas intermediárias e sem jamais usar placeholders (`// TODO`, `// implementar depois`).
> 2. Você deve utilizar ativamente os **MCPs já instalados no ambiente**, instalar pacotes auxiliares (via `npm` ou `pip`) se necessário, **criar as Skills customizadas** descritas na Seção 1 e executar o ciclo completo: **Planejamento $\rightarrow$ Criação de Skills $\rightarrow$ Geração de UI (Stitch) $\rightarrow$ Geração e Recorte de Sprites Animados (Nano Banana) $\rightarrow$ Programação Modular (Phaser 3 WebGL) $\rightarrow$ Testes Automatizados (Playwright + Chrome DevTools)**.

---

# 1. ORQUESTRAÇÃO DE MCPs E CRIAÇÃO AUTOMÁTICA DE SKILLS

## 1.1. Mapeamento Obrigatório dos seus MCPs Instalados
Utilize os servidores MCP disponíveis no seu ambiente Antigravity seguindo exatamente esta atribuição de responsabilidades:

1. **`sequential-thinking`:** Execute no Passo 0 para planejar a árvore de arquivos, o grafo de estados das 12 habilidades, 10 passivas, 18 evoluções/fusões e o pipeline de assets antes de escrever código.
2. **`google antigravity SDK`:** Utilize para estruturar, registrar e acionar programaticamente as **4 Skills Customizadas** na pasta `.agent/skills/` do projeto.
3. **`gemini API` (Motor Nano Banana):** Utilize para gerar todas as *Sprite Sheets* dos 10 personagens, 5 pets, inimigos, bosses, baús, gemas, ícones de habilidades e *tilesets* de cenário usando o modelo de imagem Nano Banana (`gemini-2.5-flash-image` / Imagen) com fundo sólido Chroma Magenta (`#FF00FF`) para recorte automático.
4. **`StitchMCP` + `mobbin`:** Utilize o `mobbin` para referenciar ergonomia de controles mobile/desktop e acione o `StitchMCP` para projetar e exportar a camada de UI/HUD em HTML5/CSS3 moderno (Menu Inicial, Seleção dos 10 Personagens, Cartas de Level Up com molduras de raridade, Loja de Talentos, Grimório, Tela de Analytics de DPS e Painel Debug).
5. **`modern web guidance` + `google developer knowledge`:** Consulte para garantir melhores práticas de WebGL no Phaser 3, responsividade `100vw` $\times$ `100vh`, `devicePixelRatio`, `touch-action: none` e síntese de áudio via `Web Audio API`.
6. **`data agent kit`:** Utilize para calibrar e validar as curvas matemáticas de XP, DPS das armas e a equação de escalonamento de inimigos com teto por minuto.
7. **`eslint` + `gmp-code-assist`:** Execute continuamente sobre todos os arquivos em `/src/` para garantir zero erros de sintaxe, variáveis não declaradas ou imports quebrados.
8. **`playwright` + `Chrome-devtools-mcp`:** Utilize na fase final para abrir o servidor local, inspecionar o console, medir o FPS em WebGL, simular jogabilidade em Desktop (`WASD` + `Espaço` + `P`) e Mobile (Toque + Joystick Virtual) e comprovar que todos os 11 botões do Painel Desenvolvedor funcionam sem erros.
9. **`Firebase` (Opcional / Híbrido com `localStorage`):** Configure um adaptador de persistência em `/src/systems/SaveManager.js` que salva instantaneamente em `localStorage` (100% funcional offline) e deixa pronta a sincronização com Firebase caso credenciais estejam presentes.
10. *(Nota)*: Ignore o MCP `dart and flutter` neste workspace para manter o projeto 100% focado em Web Nativa HTML5/Phaser 3. Caso precise de processamento local de imagens para os sprites, instale via terminal `pillow`, `numpy` e `rembg` (ou crie o script de Chroma Key em Python/Node.js).

## 1.2. As 4 Skills que Você Deve Criar no Antigravity (`.agent/skills/`)
Antes de iniciar o código do jogo, crie na estrutura do projeto as seguintes Skills operacionais:

* **Skill 1: `nano-banana-sprite-forge` (`.agent/skills/sprite-forge/`)**
  * **Função:** Gera via `gemini API` (Nano Banana) folhas de sprites padronizadas em perspectiva *Top-Down 3/4 Dark-Fantasy Stylized HD*, sempre em grade horizontal de 4 quadros (`IDLE`, `WALK_1`, `WALK_2`, `CAST_ATTACK`) sobre fundo sólido `#FF00FF`.
  * **Script Embutido (`/tools/process_sprites.py` ou `/tools/process_sprites.mjs`):** Remove todos os pixels próximos a `#FF00FF` convertendo-os em canal Alpha transparente real, aplica um contorno escuro/luminoso de $1\text{px}$ para legibilidade, centraliza a caixa de colisão e salva os arquivos `.png` e `.json` em `/public/assets/sprites/`.
  * **Mecanismo de Segurança (Zero-Crash Fallback):** O carregador de assets do jogo (`AssetManager.js`) deve verificar se cada `.png` existe; caso algum asset ainda esteja sendo processado ou falhe, ele gera instantaneamente em memória WebGL uma textura multi-camadas animada para aquela entidade, garantindo que o jogo nunca trave ou exiba quadrados pretos.
* **Skill 2: `stitch-ui-architect` (`.agent/skills/stitch-ui/`)**
  * **Função:** Usa o `StitchMCP` para gerar componentes de interface responsivos com estética *Arcane Dark Fantasy & Neon Trim*, conectando-os via `CustomEvents` do DOM ao motor Phaser 3.
* **Skill 3: `elemental-balance-sim` (`.agent/skills/balance-sim/`)**
  * **Função:** Valida matematicamente que todas as 12 habilidades ativas, 10 passivas, 12 evoluções Ativa+Passiva, 6 fusões Ativa+Ativa e 7 reações elementais possuam IDs únicos, receitas válidas e não causem loops infinitos no sorteio de Level Up.
* **Skill 4: `auto-qa-runner` (`.agent/skills/qa-runner/`)**
  * **Função:** Sobe um servidor HTTP local (`npx vite` ou `python3 -m http.server`), abre o jogo via `playwright` e `Chrome-devtools-mcp`, testa a partida, abre o menu Debug (`P`), clica em todos os botões de teste, verifica a ausência de exceções no console e corrige automaticamente qualquer falha encontrada.

---

# 2. ARQUITETURA DE DIRETÓRIOS E MOTOR GRÁFICO (PHASER 3 WEBGL)

Construa o projeto na seguinte estrutura modular limpa:

```text
/
├── index.html                  # Container responsivo, importação do Phaser 3 e Overlays de UI (Stitch)
├── package.json                # Dependências (phaser, vite, eslint, playwright) e scripts de execução
├── css/
│   └── style.css               # Estilos gerados via StitchMCP (HUD, Cartas de Level Up, Loja, Grimório, Mobile UI)
├── assets/
│   ├── sprites/                # Sprite sheets e ícones gerados pela Skill nano-banana-sprite-forge
│   └── audio/                  # (Opcional) + Síntese 100% procedural via Web Audio API
├── tools/
│   └── process_sprites.mjs     # Script de geração e pós-processamento Chroma Key / Atlas
└── src/
    ├── main.js                 # Configuração Phaser.Game (WebGL, Scale.RESIZE, 60 FPS, Física Arcade)
    ├── config/
    │   ├── charactersData.js   # Os 10 Magos Elementais sem conflitos (incluindo Petrus, o Elfo de Pedra)
    │   ├── skillsData.js       # 12 Ativas, 10 Passivas, 12 Evoluções (Ativa+Passiva) e 6 Fusões (Ativa+Ativa)
    │   ├── elementsData.js     # Os 7 Elementos e matriz das 7 Reações Elementais
    │   └── enemiesData.js      # Mobs comuns, Eventos de Horda, Mini-Bosses (Afixos) e Bosses Principais
    ├── systems/
    │   ├── AssetManager.js     # Loader de Sprites Nano Banana + Gerador WebGL Procedural de Fallback
    │   ├── AnimationSystem.js  # Animação de Frames + Rigging Multi-Peças (4 Braços) + Squash & Stretch + Tint
    │   ├── CombatSystem.js     # Mira inteligente, Knockback, Crítico, Reações Elementais e Object Pooling
    │   ├── SpawnSystem.js      # Escalabilidade com Teto, Eventos (2,5,7,9 min), Baús com Setas e Jaulas de Pets
    │   ├── SoundManager.js     # Sintetizador Web Audio API (Gemas, Impactos, Reações, Boss, Level Up)
    │   └── SaveManager.js      # Persistência em localStorage + Adaptador Firebase (Ouro, Loja, Grimório, Conquistas)
    ├── entities/
    │   ├── Player.js           # Movimento, Dash com i-frames, 4 Braços Articulados (Petrus), Clones Sombrios
    │   ├── Enemy.js            # IA de perseguição/tiro, resistências elementais, barra de vida e drops
    │   ├── Boss.js             # Travamento do relógio, Timer de Morte Súbita (3 min) e Telegraphs no chão
    │   ├── Pet.js              # IA autônoma dos 5 Pets resgatáveis
    │   └── GemManager.js       # Coleta magnética e Fusão Espacial Off-screen (>250 gemas)
    ├── scenes/
    │   ├── BootScene.js        # Carregamento e geração de texturas/animações
    │   ├── MenuScene.js        # Integração com Menu Stitch (Seleção de Personagem, Loja, Grimório, Conquistas)
    │   └── GameScene.js        # Loop principal de jogo, Câmera, Tilemap Infinito e Atmosfera Dinâmica
    └── ui/
        ├── UIManager.js        # Controle da HUD, Cartas de Level Up (Raridades, Reroll, Banish, Skip), Setas de Borda
        └── DebugPanel.js       # Painel Mestre God Mode (Tecla P ou Botão ⚙️ DEV no Mobile) com pausa automática
```

---

# 3. DIREÇÃO DE ARTE ANIMADA E "GAME FEEL" (NANO BANANA + WEBGL)

1. **Animação Híbrida (Sprite Sheets + Rigging Procedural 2D):**
   * Nenhum personagem, pet ou mob pode parecer uma figura geométrica estática.
   * Combine os quadros de animação gerados pelo **Nano Banana** com transformações procedurais em tempo real no `AnimationSystem.js`:
     * **Locomoção Viva:** Aplique deformação senoidal suave (*Squash & Stretch*: $\text{scaleX} = 1 + 0.06 \sin(\omega t)$, $\text{scaleY} = 1 - 0.06 \sin(\omega t)$) e leve inclinação angular ($\pm 5^\circ$) na direção do movimento.
     * **Articulação Multi-Peças (Paper-Doll):** Para **Petrus, o Elfo de Pedra de 4 Braços**, renderize o sprite do tronco élfico central e **4 sprites independentes de braços de rocha rúnica** flutuando ao redor dos ombros. Cada braço deve apontar para o alvo e executar um *Tween* de recuo e arremesso (*recoil*) individualmente quando dispara!
     * **Feedback de Dano e Status (WebGL Shaders/Tints):** Ao sofrer dano, aplique `setTintFill(0xffffff)` por $60\text{ms}$ (*Hit Flash*). Inimigos sob status elementais exibem coloração e partículas dedicadas (Laranja = Fogo, Ciano = Gelo, Amarelo = Raio, Marrom/Âmbar = Terra, Verde-Esmaralda = Vento, Roxo/Verde-Ácido = Veneno, Violeta Escuro = Arcano).
2. **Cenário Infinito e Mudança Atmosférica de Boss:**
   * O mapa é um plano infinito contínuo e livre de obstáculos físicos bloqueantes, renderizado com `Phaser.GameObjects.TileSprite` usando texturas de solo arcano medieval geradas pelo Nano Banana e decorações de fundo sem colisão (runas antigas, fissuras, vegetação rasteira).
   * **Clima de Boss/Mini-Boss:** O ambiente permanece claro e legível durante a partida normal, mas quando um Mini-Boss ou Boss surge, a câmera aplica uma transição suave de iluminação, vinheta pulsante nas bordas da tela e partículas climáticas na arena para anunciar o momento do ataque.
3. **Controle de Poluição Visual (Opacidade de VFX):**
   * Inclua na HUD (acessível no PC e Mobile) um slider de **Opacidade de Efeitos Visuais ($20\%$ a $100\%$)** que ajusta o `alpha` das magias e partículas do jogador sem afetar a visibilidade dos inimigos e dos projéteis/marcações de ataque dos Bosses.

---

# 4. OS 10 PERSONAGENS ELEMENTAIS (BALANCEADOS E SEM CONFLITOS)

Implemente os **10 Personagens Únicos** abaixo em `charactersData.js`. O personagem #1 começa desbloqueado; os outros 9 são desbloqueados com Ouro Elemental ou Conquistas (ou instantaneamente pelo Painel Debug). Cada personagem começa a partida com sua **Arma Inicial Exclusiva (Nv. 1)** ocupando o 1º dos 5 slots de habilidades ativas, além de sua **Passiva Inata Exclusiva**:

1. **Petrus, o Elfo de Pedra de 4 Braços (Inicial — Elemento: Terra)**
   * **Visual:** Elfo ancestral de pele cinza-basalto com runas âmbar e 4 braços de rocha flutuantes articulados.
   * **Status Base:** HP $120$, Velocidade $100\%$, Armadura $+10\%$, Knockback $+25\%$.
   * **Arma Inicial:** *Barragem de Rocha (Terra)* — Seus 4 braços arremessam pedregulhos pesados em cadência alternada contra os inimigos mais próximos, aplicando alto empurrão (*Knockback*) e status *Terra*.
   * **Passiva Inata (*Quatro Punhos da Montanha*):** A cada $4\text{º}$ ataque, os 4 braços disparam simultaneamente um Megálito Sísmico que estilhaça em cone ($+35\%$ de área e atordoa por $0.8\text{s}$).
2. **Ignis, o Piromante Cinzento (Elemento: Fogo)**
   * **Visual:** Mago envolto em manto de brasas com coroa de chamas vivas.
   * **Status Base:** HP $95$, Velocidade $105\%$, Dano Base $+20\%$.
   * **Arma Inicial:** *Bombardeio Ígneo (Fogo)* — Lança esferas de magma que explodem em área (AoE) nos grupos mais densos de inimigos.
   * **Passiva Inata (*Coração Vulcânico*):** $+35\%$ de dano em efeitos de queimadura contínua (DoT); inimigos que morrem queimando explodem causando $20\%$ de seu HP máximo como dano de Fogo aos vizinhos.
3. **Crya, a Arquimaga Glacial (Elemento: Gelo)**
   * **Visual:** Feiticeira élfica de cristal azul-gelo com manto de nevasca.
   * **Status Base:** HP $100$, Velocidade $100\%$, Chance Crítica $+15\%$.
   * **Arma Inicial:** *Lança de Gelo (Gelo)* — Dispara estalactites perfurantes de alta velocidade focadas prioritariamente no inimigo de maior HP na tela.
   * **Passiva Inata (*Zero Absoluto*):** Inimigos com status *Gelo* recebem $+40\%$ de Dano Crítico e têm sua velocidade de movimento reduzida em mais $15\%$.
4. **Volt, o Monge da Tempestade (Elemento: Raio)**
   * **Visual:** Monge ágil com tatuagens elétricas brilhantes e orbes de plasma nos punhos.
   * **Status Base:** HP $100$, Velocidade $120\%$, Velocidade de Ataque $+15\%$.
   * **Arma Inicial:** *Corrente Elétrica (Raio)* — Dispara relâmpagos instantâneos que ricocheteiam entre múltiplos alvos próximos.
   * **Passiva Inata (*Passo Relâmpago*):** Caminhar acumula cargas eletrostáticas; ao acionar o Dash (Esquiva), libera uma descarga elétrica em área que paralisa os inimigos no caminho.
5. **Sylas, o Druida das Feras (Elemento: Veneno / Natureza)**
   * **Visual:** Guardião silvestre com chifres de carvalho e capa de folhas venenosas.
   * **Status Base:** HP $110$, Velocidade $105\%$, Limite Base de Pets $+1$.
   * **Arma Inicial:** *Enxame de Espinhos (Veneno)* — Dispara rajadas rápidas de espinhos tóxicos em cone na direção do movimento ou do inimigo mais próximo.
   * **Passiva Inata (*Senhor da Matilha*):** Já inicia a partida acompanhado de 1 Pet *Lobo Espiritual* exclusivo e aumenta em $+35\%$ o dano e a velocidade de ataque de todos os Pets resgatados na partida.
6. **Zephyr, o Lâmina do Vento (Elemento: Vento)**
   * **Visual:** Assassino arcano flutuante com cachecol etéreo verde-esmeralda e lâminas aéreas.
   * **Status Base:** HP $90$, Velocidade $125\%$, Cargas de Dash $+2$.
   * **Arma Inicial:** *Chakram de Vendaval (Vento)* — Arremessa discos cortantes em trajetória bumerangue elíptica que atravessam a horda e puxam inimigos leves no retorno.
   * **Passiva Inata (*Dança do Furacão*):** $-25\%$ no tempo de recarga do Dash e $+25\%$ de velocidade de voo para todos os projéteis.
7. **Nyx, a Tecelã do Vazio (Elemento: Arcano / Sombra)**
   * **Visual:** Bruxa astral flutuante cercada por anéis gravitacionais violeta-escuros.
   * **Status Base:** HP $95$, Velocidade $105\%$, Raio de Coleta $+50\%$.
   * **Arma Inicial:** *Orbe Abissal (Arcano)* — Dispara vórtices gravitacionais que puxam inimigos próximos para o centro antes de implodir.
   * **Passiva Inata (*Fome do Horizonte*):** Todas as gemas de XP concedem $+15\%$ de experiência extra e cada $25$ gemas coletadas geram uma barreira que bloqueia $1$ instância de dano.
8. **Solarius, o Templário Astral (Elemento: Fogo / Luz Solar)**
   * **Visual:** Paladino dourado com armadura radiante e halo solar nas costas.
   * **Status Base:** HP $150$, Velocidade $95\%$, Regeneração $+2\text{ HP/s}$.
   * **Arma Inicial:** *Martelo Solar Orbital (Fogo)* — Martelos flamejantes giram permanentemente ao redor do personagem, aplicando alto dano de impacto e repelindo inimigos.
   * **Passiva Inata (*Égide Radiante*):** Sempre que perde $20\%$ do HP máximo acumulado, emite uma Supernova Sagrada que cura $10\%$ da vida e incinera inimigos ao redor.
9. **Alchemius, o Mestre da Peste (Elemento: Veneno / Ácido)**
   * **Visual:** Alquimista medieval com máscara bico-de-corvo rúnica e cinturão de poções luminescentes.
   * **Status Base:** HP $105$, Velocidade $100\%$, Área de Efeito $+20\%$.
   * **Arma Inicial:** *Frasco Ácido (Veneno)* — Arremessa frascos em arco que quebram no chão, criando poças ácidas que derretem a armadura dos inimigos.
   * **Passiva Inata (*Catalisador Químico*):** Todas as **Reações Elementais** desencadeadas pelo jogador causam $+45\%$ de dano extra e espalham o elemento residual para inimigos próximos.
10. **Chronos, o Sábio Paradoxal (Elemento: Arcano / Tempo)**
    * **Visual:** Arcanista idoso com engrenagens douradas flutuantes e ampulheta cósmica.
    * **Status Base:** HP $100$, Velocidade $105\%$, Sorte Base $+20\%$, Redução de Recarga $+10\%$.
    * **Arma Inicial:** *Agulha Temporal (Arcano)* — Dispara feixes cronológicos instantâneos que perfuram todos os inimigos em linha reta e reduzem a velocidade deles em $35\%$.
    * **Passiva Inata (*Senhor do Destino*):** A tela de Level Up oferece **4 cartas de escolha em vez de 3**, além de conceder $+2$ Rerolls gratuitos extras no início da partida.

---

# 5. COMBATE, DASH, 7 ELEMENTOS, BAÚS COM SETAS E PETS AUTÔNOMOS

1. **Movimentação, Dash e *i-frames*:**
   * Ataques 100% automáticos com lógicas de mira distintas por arma (alvo mais próximo, maior vida, maior densidade AoE, cone frontal, orbital).
   * **Dash (Esquiva Ativa):** Acionado via `Espaço` no PC ou botão dedicado no Mobile. Consome 1 carga de Stamina (recarrega com o tempo), move o herói rapidamente com rastro fantasma e concede invulnerabilidade durante o deslocamento.
   * **Período de Invencibilidade (*i-frames*):** Ao sofrer dano, o jogador recebe $0.5\text{s}$ de invencibilidade para impedir morte instantânea por colisão múltipla.
   * **Knockback:** Mobs sofrem empurrão proporcional à força da arma dividida pelo peso do inimigo.

2. **Matriz de 7 Elementos e Reações Elementais Cruzadas:**
   Cada arma aplica seu elemento (**Terra, Fogo, Gelo, Raio, Vento, Veneno, Arcano**) por $4\text{ segundos}$. Combinar dois elementos no mesmo alvo dispara uma **Reação Elemental** visualmente impactante com texto flutuante colorido:
   * **Terra + Fogo = Erupção de Magma:** Cria uma fissura vulcânica no chão por $3\text{s}$ causando dano contínuo em área e lentidão de $40\%$.
   * **Terra + Gelo = Estilhaçar Rochoso (Shatter):** Causa dano físico/elemental crítico garantido ($2.2\times$) e onda de choque com Knockback duplo.
   * **Fogo + Gelo = Choque Térmico:** Explosão de vapor que causa $250\%$ de dano imediato e reduz a defesa do inimigo em $30\%$.
   * **Fogo + Veneno = Combustão Tóxica:** Detona as cargas de veneno em uma explosão violenta que espalha chamas ácidas aos inimigos adjacentes.
   * **Gelo + Raio = Supercondutor:** Dispara arcos elétricos para até $8$ inimigos próximos e reduz em $0.5\text{s}$ os cooldowns ativos do jogador.
   * **Vento + Qualquer Elemento = Turbilhão Elemental:** Cria um ciclone que puxa inimigos leves para o centro e aumenta o raio do elemento combinado em $+50\%$.
   * **Arcano + Qualquer Elemento = Ruptura Dimensional:** Duplica o dano do status elemental atual e aplica vulnerabilidade arcana ($+25\%$ de dano recebido).

3. **Perigos Ambientais (Sem Fogo Amigo entre Aliados):**
   * Surgem periodicamente no mapa **Cristais Instáveis** e **Gêiseres de Mana**. Ao serem atingidos ou após aviso luminoso no chão, explodem causando alto dano nos mobs e também no jogador caso ele permaneça dentro do círculo de explosão (porém ataques do jogador, clones e pets jamais ferem o próprio jogador).

4. **Baús de Tesouro com Setas nas Bordas e Guardiões Dinâmicos:**
   * Baús surgem pelo mapa. Quando estão fora da visão da câmera, exiba **Setas Indicadoras Douradas nas bordas da tela** apontando a direção e distância em metros.
   * **Escalonamento de Proximidade:** Quando o jogador se aproxima a menos de $400\text{px}$ de um Baú, um círculo rúnico se acende ao redor do baú e **aumenta a taxa de spawn de inimigos guardiões ao redor dele**.
   * Ao quebrar o Baú, ele dropa Ouro Elemental e um **Item Dropável Interativo** aleatório:
     1. 🧲 **Ímã Astral Global:** Atrai em alta velocidade todas as gemas de XP presentes em todo o mapa.
     2. ❤️ **Coração de Fênix:** Cura $50\%$ do HP máximo e limpa debuffs.
     3. 📖 **Tomo do Despertar (XP Jackpot):** Faz o jogador subir instantaneamente **+2, +5 ou +10 Níveis de uma vez** (abrindo as escolhas de Level Up em sequência)!
     4. 💀 **Foice do Ceifador:** Corta a tela inteira matando instantaneamente 100% dos mobs comuns visíveis e tendo $5\%$ de chance de executar Mini-Bosses/Bosses.
     5. ⏳ **Ampulheta Cronos:** Paralisa todos os inimigos e projéteis inimigos por $6\text{ segundos}$.
     6. 🔥 **Cálice da Fúria:** Dobra a velocidade de conjuração e o tamanho dos projéteis por $10\text{ segundos}$.

5. **Resgate de Pets Autônomos (Jaulas Mágicas com Seta Verde):**
   * Jaulas surgem no mapa sinalizadas por setas verdes nas bordas da tela. Destruir a jaula liberta um **Pet Autônomo** que segue o jogador e atua automaticamente:
     * **Fada da Luz (Suporte/Escudo):** Cura o jogador a cada $5\text{s}$ e concede um escudo que, ao quebrar ou expirar, explode causando dano em área igual a $10\%$ do dano do jogador + $50$ base.
     * **Dragonete Rubro (AoE Propagador):** Dispara bolas de fogo nos grupos densos cujas chamas se propagam continuamente entre inimigos próximos.
     * **Coruja Arcana (Sniper Escalável):** Foca no inimigo de maior HP (Boss/Mini-Boss) com feixes perfurantes que ganham $+2\%$ de dano cumulativo por segundo focado no mesmo alvo.
     * **Golem de Pedra (Guardião Sísmico):** Orbita o jogador bloqueando projéteis, aplicando Knockback e, a cada $5\text{º}$ golpe, bate no chão gerando uma onda sísmica que desacelera mobs e concede $+50\%$ de Dano ao jogador por $5\text{s}$.
     * **Duende Coletor (Coleta & Veneno):** Corre pelo mapa coletando gemas e itens para o jogador enquanto dispara dardos venenosos nos inimigos próximos.

---

# 6. SISTEMA DE 5 SLOTS, RARIDADE DE UPGRADE E EVOLUÇÕES QUE LIBERAM SLOTS

1. **Curva de XP e Gemas Permanentes com Fusão Off-Screen:**
   * Fórmula de XP por nível ($L$):
     $$\text{XP}_{\text{necessário}}(L) = \lfloor 15 \times (L^{1.28}) + (L \times 10) \rfloor$$
   * As gemas de XP **nunca desaparecem com o tempo**. Se houver mais de $250$ gemas no chão simultaneamente, funda as gemas fora da tela em uma **Super Gema Concentrada** contendo a soma exata do XP, mantendo 60 FPS cravados.
   * Na tela de Level Up, inclua botões funcionais de **Reroll** (Sortear novamente), **Banish** (Banir habilidade da partida) e **Skip** (Pular e ganhar $+50\%$ de XP).

2. **Raridade da Carta no Level Up (Saltos de Nível):**
   A cada carta gerada no Level Up, sorteie sua raridade (modificada pela *Sorte* do jogador):
   * **Comum ($84\%$ base — Moldura Prata):** Sobe **+1 Nível**.
   * **Rara ($10\%$ base — Moldura Azul):** Sobe **+2 Níveis de uma vez** (respeitando o teto Nv. 5).
   * **Épica ($5\%$ base — Moldura Roxa):** Sobe **+3 Níveis de uma vez**.
   * **Lendária ($1\%$ base — Moldura Dourada):** Eleva a habilidade **diretamente para o Nível Máximo (Nv. 5)**!

3. **Limite Estrito de 5 Habilidades Ativas e 5 Passivas:**
   * O jogador possui **5 Slots Ativos** e **5 Slots Passivos** claramente visíveis na HUD.
   * Assim que os 5 slots de uma categoria são ocupados, **novas habilidades daquela categoria param de aparecer no sorteio**, surgindo apenas upgrades das 5 já selecionadas até alcançarem o Nível 5.
   * Cada nível de 1 a 5 deve alterar a mecânica e o visual da arma (mais projéteis, maior escala, novos emissores de partículas, divisão ao impacto), tornando-a visivelmente mais forte e apelona.
   * Exiba **Ícones de Dica de Sinergia** nas cartas mostrando se o jogador já possui ou precisa de determinado par para evoluir.

4. **Dupla Mecânica de Evolução Suprema (Com Liberação de Slot!):**
   Quando os requisitos abaixo atingem o **Nível 5**, a carta de **EVOLUÇÃO SUPREMA** aparece **automaticamente garantida no próximo Level Up**:

   * **A. Evolução Sinérgica (Ativa Nv.5 + Passiva Nv.5 $\rightarrow$ Libera 1 Slot Passivo):**
     1. `Barragem de Rocha (Nv.5)` + `Luva de Titã (+Dano Nv.5)` = **Cataclismo dos Quatro Punhos (★)**
     2. `Bombardeio Ígneo (Nv.5)` + `Anel de Alcance (+Área Nv.5)` = **Sol Interior em Chamas (★)**
     3. `Lança de Gelo (Nv.5)` + `Olho de Falcão (+Crítico Nv.5)` = **Estalactite do Zero Absoluto (★)**
     4. `Corrente Elétrica (Nv.5)` + `Tomo de Sabedoria (-Recarga Nv.5)` = **Tempestade de Thor Infinita (★)**
     5. `Enxame de Espinhos (Nv.5)` + `Cristal Duplicador (+Projéteis Nv.5)` = **Floresta Carnívora (★)**
     6. `Chakram de Vendaval (Nv.5)` + `Botas de Hermes (+Velocidade Nv.5)` = **Ciclone de Lâminas (★)**
     7. `Orbe Abissal (Nv.5)` + `Ímã Astral (+Coleta Nv.5)` = **Horizonte de Eventos (★)**
     8. `Martelo Solar Orbital (Nv.5)` + `Coração de Dragão (+HP/Regen Nv.5)` = **Julgamento do Deus Sol (★)**
     9. `Frasco Ácido (Nv.5)` + `Ampulheta Eterna (+Duração Nv.5)` = **Dilúvio Bioquímico (★)**
     10. `Agulha Temporal (Nv.5)` + `Acelerador Cinético (+Vel. Projétil Nv.5)` = **Colapso do Espaço-Tempo (★)**
     11. `Chuva de Meteoros (Nv.5)` + `Coroa da Ganância (+XP/Ouro Nv.5)` = **Apocalipse Estelar Dourado (★)**
     12. `Totem Espiritual (Nv.5)` + `Armadura de Espinhos (+Defesa Nv.5)` = **Avatar dos Ancestrais (★)**
     * **Regra de Slot:** Ao evoluir, a Passiva Nv.5 funde seus atributos permanentemente na arma evoluída e **SEU SLOT DE PASSIVA FICA LIVRE**, permitindo escolher uma nova passiva do catálogo!

   * **B. Fusão Dupla de Armas (Ativa A Nv.5 + Ativa B Nv.5 $\rightarrow$ Libera 1 Slot Ativo):**
     1. `Barragem de Rocha (Nv.5)` + `Bombardeio Ígneo (Nv.5)` = **Titã da Tectônica Vulcânica (★★)**
     2. `Lança de Gelo (Nv.5)` + `Chakram de Vendaval (Nv.5)` = **Nevasca Cortante dos Nove Ventos (★★)**
     3. `Corrente Elétrica (Nv.5)` + `Frasco Ácido (Nv.5)` = **Nuvem de Plasma Corrosivo (★★)**
     4. `Orbe Abissal (Nv.5)` + `Agulha Temporal (Nv.5)` = **Singularidade Paradoxal (★★)**
     5. `Enxame de Espinhos (Nv.5)` + `Totem Espiritual (Nv.5)` = **Fúria de Gaia Primordial (★★)**
     6. `Martelo Solar Orbital (Nv.5)` + `Chuva de Meteoros (Nv.5)` = **Ira do Firmamento Solar (★★)**
     * **Regra de Slot:** As duas armas Nv.5 se unem em uma única Super Arma de 1 slot e **1 SLOT DE HABILIDADE ATIVA FICA LIVRE** para o jogador adquirir outra arma!
     * **Prevenção de Repetição:** Componentes consumidos em fusões ficam marcados no histórico da partida (`consumedSkills`) para não reaparecerem no nível 1 na mesma run.
   * **Limit Break:** Quando todos os 5 slots ativos e 5 passivos estiverem totalmente maximizados/evoluídos, todo novo Level Up oferece opções de *Limit Break* ($+5\%$ Dano, $+5\%$ Área ou $-3\%$ Recarga infinitamente).

---

# 7. ESCALONAMENTO COM TETO, HORDA ESPECIAL, MINI-BOSSES E BOSSES

1. **Fórmula de Escalonamento com Teto por Minuto (Modo Endless):**
   O jogo opera em **Modo Endless**. Para que o jogador nunca seja punido com inimigos imortais por matar rápido demais, o escalonamento por abates ($K$) possui um teto máximo vinculado ao minuto atual ($T$):
   $$\text{BonusKills}(T, K) = \min\left(K \times 0.0015, \; T \times 0.25\right)$$
   $$\text{MultiplicadorForca}(T, K) = 1 + (T \times 0.30) + \text{BonusKills}(T, K)$$
   $$\text{HP}_{\text{Inimigo}} = \text{HP}_{\text{Base}} \times \text{MultiplicadorForca}(T, K)$$
   $$\text{XP}_{\text{Drop}} = \text{XP}_{\text{Base}} \times \left(1 + (T \times 0.22) + \text{BonusKills}(T, K) \times 0.5\right)$$

2. **Reposicionamento Dinâmico:** Inimigos que ficarem muito atrás da câmera devido ao deslocamento do jogador são reposicionados suavemente à frente da rota do jogador.

3. **Eventos Especiais de Horda (Minutos 2, 5, 7 e 9 — Ciclando a cada 10 min):**
   * **Minuto 2 (*Anel de Ferro*):** 60 golems e escudeiros surgem formando um círculo fechado que se contrai lentamente ao redor do jogador.
   * **Minuto 5 (*Debandada Relâmpago*):** Faixas vermelhas piscam no chão seguidas por ondas de corredores ultra-rápidos cruzando a tela em alta velocidade.
   * **Minuto 7 (*Convergência Elemental*):** Hordas imbuídas com um elemento específico atacam em sincronia, exigindo o uso de elementos opostos.
   * **Minuto 9 (*Cerco das Sombras*):** Assassinos e magos atiradores surgem em formação espiral disparando projéteis coordenados.

4. **Mini-Bosses (A cada 2.5 minutos) e Bosses Principais (A cada 5 minutos):**
   * **Afixos e Afinidade Elemental:** Todo Mini-Boss e Boss surge com modificadores visíveis (**Vampírico, Teletransportador, Escudo Refletor, Berserker, Invocador**) e **Afinidade Elemental** clara abaixo do nome (ex: *Resistente a Gelo $[-50\%]$ | Vulnerável a Terra/Fogo $[+50\%]$*).
   * **Travamento do Relógio e Penalidade de 3 Minutos nos Bosses:**
     * Quando um Boss Principal entra em cena, o cenário muda de atmosfera e **o cronômetro principal da partida TRAVA** até que o Boss seja derrotado.
     * Um sub-cronômetro de **03:00 (180 segundos)** inicia contagem regressiva abaixo da barra do Boss. Se o Boss não for morto em 3 minutos, ativa-se a **Maldição de Sangue**: o jogador perde $5\%$ de seu HP máximo por segundo (aumentando $+2\%\text{/s}$ a cada 10 segundos extras) até que o Boss ou o jogador morra!

---

# 8. META-PROGRESSÃO (LOJA, CLONES SOMBRIOS, GRIMÓRIO E ESTATÍSTICAS)

1. **Loja de Talentos Permanentes (Ouro Elemental):**
   Salva automaticamente em `localStorage`, permitindo melhorar:
   * **+Força Elemental** ($+10\%$ Dano por nível)
   * **+Sorte Arcana** ($+10\%$ Sorte para cartas Raras/Épicas/Lendárias e baús)
   * **+Velocidade Base** ($+5\%$ Velocidade de movimento)
   * **+Velocidade de Casting** ($-6\%$ Tempo de recarga de habilidades)
   * **+Disparo Adicional** ($+1$ Projétil base em todas as habilidades)
   * **+Domador Supremo** ($+1$ Limite de Pets invocados/resgatados e $+20\%$ poder dos Pets)
   * **+Fôlego Etéreo** ($+1$ Carga de Dash e $+15\%$ recuperação de Stamina)
   * **🌟 CLONAGEM ELEMENTAL (1 a 3 Níveis):** Invoca **Clones Espectrais** permanentes que caminham em formação com o jogador e **disparam cópias exatas de todas as suas habilidades ativas**!

2. **Grimório Interativo, Conquistas e Relatório Final de DPS:**
   * **Grimório:** Exibe todas as armas, passivas, receitas de Evolução (Ativa+Passiva), Fusões Duplas (Ativa+Ativa) e a Matriz de Reações Elementais.
   * **Tela de Game Over / Relatório Analytics:** Tabela detalhada mostrando Tempo Sobrevivido, Nível, Abates, Ouro Coletado e o **Gráfico/Tabela de DPS de cada Habilidade e Pet** (Dano Total, DPS Médio e Porcentagem do Dano da Partida).

---

# 9. PAINEL DESENVOLVEDOR / GOD MODE (TECLA `P` OU BOTÃO MOBILE `⚙️ DEV`)

Implemente em `/src/ui/DebugPanel.js` um modal completo acionado pela tecla `P` no teclado ou pelo botão fixo `⚙️ DEV` no canto superior direito em telas mobile/touch.
* **Ao abrir o painel, pause imediatamente a física e os timers da partida (`scene.physics.pause()`).**
* Inclua todos os 11 botões funcionais abaixo:
  1. `🛡️ God Mode (Imortalidade ON/OFF)`
  2. `⬆️ +1 Nível Instantâneo`
  3. `🚀 +10 Níveis Instantâneos`
  4. `⭐ Maximizar Habilidades Equipadas (Nv. 5)`
  5. `🔥 Forçar Evolução Suprema das Armas Equipadas`
  6. `📦 Spawnar Baú de Tesouro ao Lado`
  7. `🐾 Spawnar Jaula de Pet ao Lado`
  8. `👹 Spawnar Mini-Boss Agora`
  9. `💀 Spawnar Boss Principal Agora`
  10. `💰 +10.000 Ouro & Desbloquear Todos os 10 Personagens/Grimório`
  11. `💥 Matar Todos os Inimigos na Tela`

---

# 10. PROTOCOLO DE AUTO-VERIFICAÇÃO FINAL (CHECKLIST OBRIGATÓRIO DO AGENTE)

Antes de encerrar sua execução, você **DEVE** rodar a Skill `auto-qa-runner` (`eslint` + `playwright` + `Chrome-devtools-mcp`) e verificar:
1. Todos os 10 personagens aparecem na seleção, começando com **Petrus, o Elfo de Pedra de 4 Braços** renderizado com seus 4 braços articulados e arma *Barragem de Rocha*.
2. Os sprites gerados pela Skill `nano-banana-sprite-forge` (ou o fallback WebGL de alta definição) possuem fundo transparente real e animações de caminhada, ataque e *Hit Flash*.
3. As barras de UI geradas via `StitchMCP` não bloqueiam o clique no Canvas e o Joystick Virtual + botão de Dash aparecem automaticamente em modo Mobile/Touch.
4. O limite de 5 Ativas e 5 Passivas é respeitado, e tanto a evolução *Ativa+Passiva* quanto a fusão *Ativa+Ativa* liberam corretamente o slot secundário sem causar erros.
5. O servidor local inicia sem erros no console (`0 errors`) e todos os 11 botões do Painel Debug (`P` / `⚙️ DEV`) funcionam perfeitamente.

**INICIE AGORA A EXECUÇÃO COMPLETA E AUTÔNOMA DO PROJETO.**
