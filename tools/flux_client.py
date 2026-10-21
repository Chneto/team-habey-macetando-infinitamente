#!/usr/bin/env python3
"""
flux_client.py
Cliente de automação para geração de arte e sprites via FLUX Schnell no WebUI Forge local.
Conecta em http://127.0.0.1:7860/sdapi/v1/txt2img
Aplica geração determinística para todos os magos, monstros, chefes de marco e biomas.
Salva diretamente na fonte canônica: public/assets/sprites/ e espelha em assets/sprites/
"""

import sys
import os
import json
import base64
import urllib.request
import urllib.error
from pathlib import Path

# Safe encoding for Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

FORGE_API_URL = os.environ.get("FORGE_API_URL", "http://127.0.0.1:7860")
OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "sprites"
MIRROR_DIR = Path(__file__).resolve().parent.parent / "assets" / "sprites"

PROMPT_STYLE_PREFIX = (
    "masterpiece, 32-bit pixel art, arcane dark fantasy, vivid elemental magic lighting, "
    "sharp clean silhouette, dark obsidian rim light, high contrast, transparent black background, "
)
NEGATIVE_PROMPT = (
    "blurry, soft gradients, 3d CGI render, photorealistic, noise, deformed limbs, artifacts, "
    "low resolution, washed out colors, watermark, signature"
)

# Roster completo de entidades conforme Roadmap & Agents
ASSET_PROMPTS = {
    # 1. 10 Magos Elementais
    "mage_petrus_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "earth mage Petrus, heavy carved granite plate armor, four glowing levitating stone arms orbiting his shoulders, emerald geomancy runes, heroic portrait",
        "steps": 4, "width": 512, "height": 512
    },
    "mage_ignis_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "pyromancer Ignis, volcanic obsidian robes, crown of dancing violet flames, molten lava staff, intense glowing ruby eyes, heroic portrait",
        "steps": 4, "width": 512, "height": 512
    },
    "mage_marina_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "hydromancer Marina, flowing cyan tidal robes, oceanic coral diadem, levitating sphere of swirling vortex water, heroic portrait",
        "steps": 4, "width": 512, "height": 512
    },
    "mage_zephyr_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "aeromancer Zephyr, feathered storm mantle, twin gale wind daggers, swirling cyclone aura, glowing turquoise eyes, heroic portrait",
        "steps": 4, "width": 512, "height": 512
    },
    "mage_volt_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "electromancer Volt, conductive brass armor, crackling azure lightning arcs, plasma halo over head, energized spark staff, heroic portrait",
        "steps": 4, "width": 512, "height": 512
    },
    "mage_crya_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "cryomancer Crya, crystalline frost armor, diamond ice spikes on shoulders, arctic blizzard staff, freezing mist aura, heroic portrait",
        "steps": 4, "width": 512, "height": 512
    },
    "mage_flora_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "druid Flora, living ironwood bark armor, entwined glowing briars and thorns, blossoming bioluminescent lotus crown, heroic portrait",
        "steps": 4, "width": 512, "height": 512
    },
    "mage_umbra_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "shadow necromancer Umbra, tattered obsidian shroud, ethereal purple soul flame lantern, carved bone scythe, glowing hollow eyes, heroic portrait",
        "steps": 4, "width": 512, "height": 512
    },
    "mage_alchemius_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "alchemist Alchemius, plague doctor leather coat, brass distillation goggles, bandolier of volatile glowing toxic flasks, heroic portrait",
        "steps": 4, "width": 512, "height": 512
    },
    "mage_chronos_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "chronomancer Chronos, ancient clockwork mantle, floating brass gears, golden hourglass emitting temporal particles, heroic portrait",
        "steps": 4, "width": 512, "height": 512
    },

    # 2. Monstros de Horda & Minibosses
    "mob_skel_warrior": {
        "prompt": PROMPT_STYLE_PREFIX + "cursed skeleton legionnaire, cracked skull, rusty jagged scimitar, shattered bronze shield, glowing red eye sockets, sprite",
        "steps": 4, "width": 512, "height": 512
    },
    "mob_void_imp": {
        "prompt": PROMPT_STYLE_PREFIX + "void imp demon, leathery dark wings, glowing violet horns, barbed tail, sharp obsidian talons, sprite",
        "steps": 4, "width": 512, "height": 512
    },
    "mob_corrupt_gargoyle": {
        "prompt": PROMPT_STYLE_PREFIX + "winged stone gargoyle, mossy granite texture, glowing yellow menacing eyes, sharp claws, gothic monument sprite",
        "steps": 4, "width": 512, "height": 512
    },
    "mob_crystal_spider": {
        "prompt": PROMPT_STYLE_PREFIX + "translucent crystal cave spider, sharp amethyst legs, glowing venomous abdomen, multifaceted ruby eyes, sprite",
        "steps": 4, "width": 512, "height": 512
    },
    "miniboss_necromancer": {
        "prompt": PROMPT_STYLE_PREFIX + "elite lich necromancer miniboss, floating floating bone scepter, cursed emerald aura, floating spell runes, sprite",
        "steps": 4, "width": 512, "height": 512
    },

    # 3. Chefes Supremos de Marco (Apex Bosses)
    "boss_golem_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "Level 10 apex boss Tectonic Golem, towering ancient stone monolith, molten lava veins glowing between cracked boulders, monolithic fists, boss sprite",
        "steps": 4, "width": 512, "height": 512
    },
    "boss_phoenix_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "Level 20 apex boss Solar Phoenix, radiant divine firebird, blinding golden and ruby feathers, blazing solar corona, massive wingspan, boss sprite",
        "steps": 4, "width": 512, "height": 512
    },
    "boss_leviathan_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "Level 30 apex boss Abyssal Leviathan, colossal cosmic sea serpent, dark ethereal dorsal fins, glowing void Maw, eldritch aura, boss sprite",
        "steps": 4, "width": 512, "height": 512
    },
    "boss_archon_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "Final apex boss Void Archon overlord, multi-eyed shadowy leviathan, jagged bone crown, eldritch purple corona, menacing boss sprite",
        "steps": 4, "width": 512, "height": 512
    },

    # 4. Biomas de Arena
    "arena_ruins_floor": {
        "prompt": PROMPT_STYLE_PREFIX + "top-down seamless dark stone floor tile, etched mystical glowing glyphs, arcane dark cobblestone texture, dungeon ground",
        "steps": 4, "width": 512, "height": 512
    },
    "arena_magma_pit": {
        "prompt": PROMPT_STYLE_PREFIX + "top-down seamless volcanic basalt floor tile, glowing orange magma cracks, fiery embers, charred stone texture",
        "steps": 4, "width": 512, "height": 512
    },
    "arena_void_nexus": {
        "prompt": PROMPT_STYLE_PREFIX + "top-down seamless obsidian marble floor tile, cosmic starry galaxy fissures, glowing violet ethereal nebula runes",
        "steps": 4, "width": 512, "height": 512
    }
}

def check_forge_status():
    """Verifica se o servidor WebUI Forge está ativo e respondendo na porta 7860."""
    try:
        req = urllib.request.Request(f"{FORGE_API_URL}/sdapi/v1/sd-models")
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status == 200:
                models = json.loads(resp.read().decode('utf-8'))
                model_names = [m.get('model_name', m.get('title', '')) for m in models]
                print(f"[FLUX Client] WebUI Forge ONLINE em {FORGE_API_URL} ({len(models)} modelos detectados)")
                return True, model_names
    except Exception as e:
        print(f"[FLUX Client] WebUI Forge offline em {FORGE_API_URL}: {e}")
    return False, []

def generate_flux_image(key, config):
    """Envia requisição txt2img para o Forge e salva a imagem."""
    payload = {
        "prompt": config["prompt"],
        "negative_prompt": NEGATIVE_PROMPT,
        "steps": config.get("steps", 4),
        "cfg_scale": 1.0,
        "width": config.get("width", 512),
        "height": config.get("height", 512),
        "sampler_name": "Euler",
        "batch_size": 1,
        "n_iter": 1,
        "seed": 42
    }

    req_data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        f"{FORGE_API_URL}/sdapi/v1/txt2img",
        data=req_data,
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            if resp.status == 200:
                result = json.loads(resp.read().decode('utf-8'))
                images = result.get("images", [])
                if images:
                    img_data = base64.b64decode(images[0])
                    OUT_DIR.mkdir(parents=True, exist_ok=True)
                    MIRROR_DIR.mkdir(parents=True, exist_ok=True)

                    target_file = OUT_DIR / f"{key}.png"
                    mirror_file = MIRROR_DIR / f"{key}.png"
                    target_file.write_bytes(img_data)
                    mirror_file.write_bytes(img_data)
                    print(f"[OK] [FLUX] Gerado com sucesso: {target_file.name} ({len(img_data)} bytes)")
                    return True
    except Exception as e:
        print(f"[ERROR] [FLUX] Falha ao gerar {key}: {e}")
    return False

def main():
    print("=== [FLUX Client] Pipeline de Geração de Arte & Sprites ===")
    online, models = check_forge_status()

    if not online:
        print("[FLUX Client] O WebUI Forge não está aberto no momento.")
        print("  Dica: Execute 'D:\\AI_Art\\run.bat' para iniciar o Forge com FLUX Schnell na porta 7860.")
        print("  O gerador nativo JavaScript (tools/process_sprites.mjs) continua garantindo 100% dos assets operacionais.")
        return 0

    print(f"[FLUX Client] Modelos carregados: {models[:3]}...")
    
    # Processa os prompts
    keys_to_process = list(ASSET_PROMPTS.keys())
    if len(sys.argv) > 1:
        # Permite passar chaves específicas via linha de comando
        requested_keys = [k for k in sys.argv[1:] if k in ASSET_PROMPTS]
        if requested_keys:
            keys_to_process = requested_keys

    success_count = 0
    for key in keys_to_process:
        config = ASSET_PROMPTS[key]
        print(f"[FLUX Client] Gerando lote: {key}...")
        if generate_flux_image(key, config):
            success_count += 1

    print(f"[FLUX Client] Lote concluído: {success_count}/{len(keys_to_process)} imagens geradas com sucesso.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
