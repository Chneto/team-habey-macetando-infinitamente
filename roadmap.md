# 🗺️ Team Habey: Macetando Infinitamente — Roadmap Operacional de 20 Etapas

> **Modelo de Execução**: Ciclo Fechado Recursivo com Portões de Qualidade (Loop-Design-Check).
> **Versão Inicial do Ciclo**: Ciclo 1 (v1.1.0-alpha) -> Ciclo 2 (v1.2.0-beta) -> Maturidade Contínua.
> **Regra Fundamental**: A cada conclusão da Etapa 20, o sistema compila o relatório de maturidade, efetua a publicação e **reinicia na Etapa 01** para uma nova iteração de polimento sucessivo e aprofundamento.

---

## 📋 As 20 Etapas de Produção

### 🔹 ETAPA 01: Governança, Contratos & Barramento de Eventos
- **Agente Responsável**: `lead-orchestrator`
- **Atividades**:
  - Formalização dos documentos de governança: `agents.md` e `roadmap.md`.
  - Configuração do barramento de comunicação e verificação dos scripts do `package.json`.
- **Critério de Aceite (Merge Gate)**: Documentos comitados e validados; scripts de automação operacionais.

---

### 🔹 ETAPA 02: Centralização do Pipeline de Assets & Sprites
- **Agente Responsável**: `spritesheet-slicer`
- **Atividades**:
  - Modificar `tools/process_sprites.mjs` para apontar `OUT_DIR` diretamente para a fonte canônica `public/assets/sprites`.
  - Ajustar `src/systems/AssetManager.js` para garantir que o Vite e o runtime do Phaser acessem unicamente `public/assets/sprites`.
  - Eliminar redundâncias e desfasamento entre pastas antigas de assets.
- **Critério de Aceite (Merge Gate)**: `npm run sprites` atualiza diretamente a pasta servida pelo Vite e todas as referências carregam sem erro 404.

---

### 🔹 ETAPA 03: Blindagem e Migração do Sistema de Saves
- **Agente Responsável**: `progression-tuner`
- **Atividades**:
  - Implementar versionamento de save (`schemaVersion: 1.1`) e pipeline de migração em `src/systems/SaveManager.js`.
  - Adicionar salvaguarda contra dados corrompidos: backup em chave auxiliar (`habey_save_corrupted_backup`) antes de qualquer reset.
  - Tratar exceções de cota cheia (`QuotaExceededError`) emitindo evento de aviso para a interface.
  - Estruturar a interface de sincronização de nuvem/Firebase com status visível na UI.
- **Critério de Aceite (Merge Gate)**: Injeção de JSON inválido no localStorage não causa travamento e recupera o estado padrão com aviso legível.

---

### 🔹 ETAPA 04: Acessibilidade & Gestão de Foco (A11y)
- **Agente Responsável**: `controls-a11y-lead`
- **Atividades**:
  - Corrigir a meta-tag de viewport em `index.html` para permitir zoom de leitura acessível (removendo `maximum-scale=1.0, user-scalable=no`).
  - Adicionar semântica de acessibilidade nos modais (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`).
  - Implementar retenção de foco (focus trap) ao abrir modais e restauração de foco ao fechá-los.
- **Critério de Aceite (Merge Gate)**: Navegação de teclado via `Tab` circula dentro dos modais abertos sem vazar para o jogo de fundo.

---

### 🔹 ETAPA 05: Integração do FLUX Forge Local & Automação de Prompts
- **Agente Responsável**: `flux-art-director`
- **Atividades**:
  - Configurar script cliente em `tools/flux_client.py` conectando à API do Forge em `http://127.0.0.1:7860/sdapi/v1/txt2img`.
  - Estabelecer os templates de prompt para o estilo *Pixel Art Dark Fantasy 32-bit com iluminação mágica vibrante*.
  - Configurar parâmetros determinísticos (Euler/FlowMatch, 4 a 8 passos para FLUX Schnell, sampler fixo).
- **Critério de Aceite (Merge Gate)**: Script gera imagem de teste via API do Forge e armazena na fila de processamento.

---

### 🔹 ETAPA 06: Geração & Refinamento de Arte: Os 10 Magos Elementais
- **Agente Responsável**: `character-architect` & `flux-art-director`
- **Atividades**:
  - Geração dos retratos em alta definição e folhas de animação para os 10 Magos (Petrus, Ignis, Marina, Zephyr, etc.).
  - Remoção de fundo automática (canal alfa limpo) e enquadramento das poses de ação.
- **Critério de Aceite (Merge Gate)**: 10 spritesheets completos em `public/assets/sprites/` com transparência perfeita.

---

### 🔹 ETAPA 07: Geração & Refinamento de Arte: Bestiário & Chefes de Marco
- **Agente Responsável**: `bestiary-designer` & `flux-art-director`
- **Atividades**:
  - Geração de sprites para mobs de horda, atiradores corrompidos e os Chefes Supremos a cada 10 níveis (Golem Rochoso no Nv 10, Fênix Solar no Nv 20, Leviatã no Nv 30, etc.).
  - Criação dos indicadores visuais de telegrafia de golpe (círculos e cones de perigo).
- **Critério de Aceite (Merge Gate)**: Spritesheets dos inimigos e chefes salvos e integrados aos templates de dados.

---

### 🔹 ETAPA 08: Geração & Refinamento de Arte: Biomas, Terrenos e Ícones
- **Agente Responsável**: `arena-cartographer` & `flux-art-director`
- **Atividades**:
  - Geração de texturas de terreno contínuas para o mapa infinito (Piso arcano de pedra rúnica, vegetação mística, cristais energéticos).
  - Geração de ícones temáticos para as 12 Armas, 12 Passivas e Fusões Duplas.
- **Critério de Aceite (Merge Gate)**: Texturas repetíveis sem costuras visuais e ícones nítidos em 64x64.

---

### 🔹 ETAPA 09: Rigging, Atlas & Animações Fluidas
- **Agente Responsável**: `spritesheet-slicer` & `character-animator`
- **Atividades**:
  - Processamento dos atlas de textura com recorte pixel-perfect.
  - Registro de ciclos de animação (`idle`, `walk`, `cast`, `hit`, `death`) no `AssetManager.js`.
  - Refinamento do movimento orbital e impacto dos 4 braços articulados de pedra do Petrus.
- **Critério de Aceite (Merge Gate)**: Todas as entidades animam no Phaser sem tremores ou distorções de proporção.

---

### 🔹 ETAPA 10: Otimização de Performance & Pooling de Memória
- **Agente Responsável**: `performance-optimizer`
- **Atividades**:
  - Substituir instanciação dinâmica repetitiva em `GameScene.js` (como poeira mágica e partículas no chão) por pools reutilizáveis ou emissores de partículas estáticos.
  - Implementar pool dedicado para orbes de experiência, textos de dano flutuante e projéteis arcanos.
- **Critério de Aceite (Merge Gate)**: Eliminação de picos de Garbage Collection (GC) e FPS cravado em 60 mesmo com centenas de entidades.

---

### 🔹 ETAPA 11: Modularização da Lógica de Combate
- **Agente Responsável**: `combat-balancer`
- **Atividades**:
  - Desacoplar `src/systems/CombatSystem.js` em submódulos especializados:
    - `src/systems/combat/ElementalReactionMatrix.js` (gerenciamento das 7 reações elementais).
    - `src/systems/combat/DamageCalculator.js` (fórmula de críticos, resistências e bônus de armas).
    - `src/systems/combat/PetrusArmRig.js` (física orbital e ataque dos braços de pedra).
- **Critério de Aceite (Merge Gate)**: `CombatSystem.js` enxuto e submódulos cobertos por testes unitários sem quebra de comportamento.

---

### 🔹 ETAPA 12: Modularização & Refatoração da UI/UX
- **Agente Responsável**: `ui-ux-designer`
- **Atividades**:
  - Desacoplar `src/ui/UIManager.js` em submódulos de responsabilidade única:
    - `src/ui/components/HUDView.js` (barra de vida, nível, tempo, contadores de abates e DPS).
    - `src/ui/components/LevelUpModal.js` (seleção de upgrades com animação de cartas mágicas).
    - `src/ui/components/GrimoireView.js` (visualização de sinergias, armas e fusões).
    - `src/ui/components/TalentShopView.js` (árvore de talentos permanentes).
- **Critério de Aceite (Merge Gate)**: UI modularizada, manutenível e com código limpo.

---

### 🔹 ETAPA 13: Shaders, Iluminação & Efeitos de Impacto (VFX)
- **Agente Responsável**: `vfx-shader-engineer`
- **Atividades**:
  - Implementação de filtros de iluminação pós-processamento para a atmosfera sombria.
  - Efeitos dinâmicos de impacto crítico (screenshake proporcional, clarão espectral e rastro de partículas elementais).
  - Telegrafia luminosa nos ataques em área dos Chefes Supremos.
- **Critério de Aceite (Merge Gate)**: Efeitos visuais visualmente impactantes sem comprometer a taxa de quadros.

---

### 🔹 ETAPA 14: Engenharia Sonora & Áudio Dinâmico
- **Agente Responsável**: `audio-architect`
- **Atividades**:
  - Criação de paisagem sonora adaptativa com Web Audio API.
  - Efeitos sonoros dedicados para cada elemento (impacto trovejante de rocha, estalo ígneo, corte de vento, etc.).
  - Transição de trilha de tensão ao surgir horda ou Boss de Marco.
- **Critério de Aceite (Merge Gate)**: Áudio limpo, sem estalos e com suporte a atalho de mudo instantâneo.

---

### 🔹 ETAPA 15: Simulação & Balanceamento Matemático de Sobrevivência
- **Agente Responsável**: `combat-balancer`
- **Atividades**:
  - Execução de simulações em `tools/validate_balance.mjs` testando todas as 12 Armas, Fusões Duplas e Magos.
  - Ajuste de curvas de dano dos monstros para garantir desafio crescente sem picos impossíveis.
  - Reforço do desafio dos Bosses a cada 10 níveis (habilidades de investida, barreiras de escudo e lacaios de proteção).
- **Critério de Aceite (Merge Gate)**: `npm run balance` passa com 100% de conformidade com tempo de jogo pretendido (15-20 min por run).

---

### 🔹 ETAPA 16: Reforço de Controles Multi-Plataforma
- **Agente Responsável**: `controls-a11y-lead`
- **Atividades**:
  - Suporte suave a Gamepad analógico (Xbox/DualShock) com assistência de mira e vibração tátil (Gamepad Haptics API se disponível).
  - Virtual joystick mobile com detecção dinâmica de toque sem bloquear botões de pausa ou menus.
- **Critério de Aceite (Merge Gate)**: Jogabilidade fluida e responsiva em desktop, notebook e dispositivos móveis.

---

### 🔹 ETAPA 17: Automação do CI/CD com Quality Gates
- **Agente Responsável**: `evolution-judge` & `lead-orchestrator`
- **Atividades**:
  - Atualizar `.github/workflows/deploy.yml` para acionar verificações em Pull Requests e antes de qualquer deploy.
  - Incluir etapas obrigatórias: `npm run lint` e `npm run balance` antes de `npm run build`.
- **Critério de Aceite (Merge Gate)**: Workflow do GitHub Actions estruturado com portões de qualidade rígidos.

---

### 🔹 ETAPA 18: Suite de Testes E2E com Playwright & DevTools
- **Agente Responsável**: `qa-e2e-tester`
- **Atividades**:
  - Execução da suite de testes automatizados via `tools/qa_runner.mjs`.
  - Simulação de gameplay de 3 minutos, subida de nível, abertura de modais e derrota de chefe.
  - Verificação de ausência de erros ou avisos graves no console do navegador.
- **Critério de Aceite (Merge Gate)**: `npm run qa` passa sem nenhuma falha registrada e screenshots de evidência gravados.

---

### 🔹 ETAPA 19: Build de Produção, Deploy & Verificação Online
- **Agente Responsável**: `evolution-judge`
- **Atividades**:
  - Executar `npm run build` e confirmar integridade do diretório `dist/`.
  - Commit das melhorias no repositório GitHub e disparo da publicação no GitHub Pages.
  - Verificação ao vivo da URL `https://chneto.github.io/team-habey-macetando-infinitamente/`.
- **Critério de Aceite (Merge Gate)**: Deploy verde e jogo online carregando com todas as novas características ativas.

---

### 🔹 ETAPA 20: Retrospectiva do Ciclo & Reabertura do Loop (Maturidade Contínua)
- **Agente Responsável**: `evolution-judge`
- **Atividades**:
  - Compilação do relatório de maturidade do ciclo concluído (estatísticas de balanceamento, FPS, novas artes e correções).
  - Bump da versão semântica (ex: v1.1.0 -> v1.2.0).
  - **Reinicialização do Loop**: Reabertura da Etapa 01 com novas metas de aprofundamento estético e mecânico para a próxima iteração.
- **Critério de Aceite (Merge Gate)**: Relatório de evolução publicado e pipeline reposicionado para o próximo ciclo de melhoria contínua.
