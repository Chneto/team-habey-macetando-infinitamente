# ⚔️ Team Habey: Macetando Infinitamente

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Phaser 3](https://img.shields.io/badge/Phaser-3.80-FF3E00?style=for-the-badge&logo=javascript&logoColor=white)](https://phaser.io/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-Deploy_Pages-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

> **Action Roguelike / Bullet Heaven Elemental de Fantasia Medieval Sombria** desenvolvido com **Phaser 3** e **Vite**, projetado para alta performance a 60 FPS no navegador (Desktop e Mobile).

---

## 🎮 Visão Geral

Em **Team Habey: Macetando Infinitamente**, você assume o manto de um dos 10 Magos Ancestrais em batalhas de sobrevivência contra hordas massivas e dinâmicas de monstros, mini-bosses periódicos e os colossais **Titãs de Ascensão** que emergem a cada 10 níveis.

O jogo apresenta um sistema de alquimia tática onde habilidades ativas e passivas se combinam para disparar **7 Reações Cruzadas Elementais**, além de **Evoluções de Sinergia (★)** e **Fusões Duplas (★★)** que libertam slots de inventário e multiplicam exponencialmente o poder do jogador.

---

## ✨ Principais Características

* **10 Magos Elementais Únicos**:
  * **Petrus, o Elfo de Pedra** *(Desbloqueado Inicialmente)*: Elfo ancestral com **4 braços de rocha flutuantes articulados** que disparam megálitos sísmicos e socos de terremoto.
  * **Ignis, Crya, Volt, Sylas, Zephyr, Alchemius, Solarius, Chronos e Nyx**: Cada qual com sua árvore de afinidades elementais, atributos e passivas inatas.
* **Sistema de Inventário 5 + 5 com Libertação de Slots**:
  * 12 Habilidades Ativas e 12 Habilidades Passivas.
  * **Evoluções de Sinergia (★)**: Ao atingir nível 5 em uma Ativa e sua Passiva correspondente, a passiva é absorvida e o slot é libertado para novos poderes!
  * **Fusões Duplas (★★)**: Duas armas ativas nível 5 se fundem em um artefato supremo, liberando 1 slot ativo no inventário!
* **7 Reações Cruzadas Elementais**:
  * *Erupção de Magma* (Terra + Fogo)
  * *Esmagamento Sísmico* (Gelo + Terra)
  * *Choque Térmico* (Fogo + Gelo)
  * *Combustão Tóxica* (Veneno + Fogo)
  * *Supercondutor* (Gelo + Raio)
  * *Turbilhão Elemental* (Vento + Fogo)
  * *Ruptura Dimensional* (Arcano + Qualquer)
* **Desafio Dinâmico e Chefes Decenais**:
  * Hordas coordenadas a cada 45 segundos (*Anel de Ferro*, *Debandada Relâmpago*, *Convergência Elemental*, *Cerco das Sombras*).
  * Minibosses e Bosses Principais com o relógio de arena travado.
  * **Titãs de Ascensão**: A cada 10 níveis alcançados (Lv. 10, 20, 30...), surge um Boss do Marco com 3 afixos aleatórios e pulsos radiais de choque!
* **Pets Autônomos de Suporte**:
  * Resgate jaulas pelo mapa para libertar companheiros que atacam, curam e concedem escudos.
* **Controles Responsivos**:
  * Teclado & Mouse (Desktop) e Joystick Virtual + Botão de Dash (Touch/Mobile).

---

## 🕹️ Controles

| Ação | Teclado | Mobile / Touch |
| :--- | :--- | :--- |
| **Mover Mago** | `W`, `A`, `S`, `D` ou `Setas` | Analógico Virtual (canto inferior esquerdo) |
| **Esquiva (Dash)** | `Espaço` | Botão `💨 DASH` (canto inferior direito) |
| **Painel de Desenvolvedor** | Tecla `P` | Botão `⚙️ DEV` (topo direito) |

---

## 🚀 Como Executar Localmente

### Pré-requisitos
* [Node.js](https://nodejs.org/) (versão 18 ou superior)
* npm (ou pnpm/yarn)

### Passos
```bash
# 1. Clone o repositório
git clone https://github.com/SEU-USUARIO/team-habey-macetando-infinitamente.git
cd team-habey-macetando-infinitamente

# 2. Instale as dependências
npm install

# 3. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse o endereço exibido no terminal (por padrão `http://localhost:5173/`).

---

## 📦 Build e Publicação

Para gerar o bundle estático otimizado para produção:
```bash
npm run build
```

Os arquivos finais serão emitidos na pasta `dist/`, prontos para serem servidos por qualquer servidor HTTP estático ou hospedados diretamente no **GitHub Pages**, **Vercel**, **Netlify** ou **Cloudflare Pages**.

---

## 🧪 Testes e Qualidade

O projeto conta com suíte automatizada de testes e simulação combinatória:

* **Validação de Balanceamento Monte Carlo**:
  ```bash
  npm run balance
  ```
* **Linter de Código**:
  ```bash
  npm run lint
  ```
* **Testes Ponta a Ponta (Playwright E2E)**:
  ```bash
  npm run qa
  ```

---

## 📜 Licença

Distribuído sob a Licença MIT. Consulte `LICENSE` para mais informações.
