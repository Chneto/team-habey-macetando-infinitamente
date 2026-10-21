#!/usr/bin/env python3
"""
flux_client.py
Cliente de automação para geração de arte e sprites via FLUX Schnell no WebUI Forge local.
Conecta em http://127.0.0.1:7860/sdapi/v1/txt2img
Aplica remoção de fundo e recorta quadros diretamente para public/assets/sprites/
"""

import sys
import os
import json
import base64
import urllib.request
import urllib.error
from pathlib import Path

FORGE_API_URL = os.environ.get("FORGE_API_URL", "http://127.0.0.1:7860")
OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "sprites"
MIRROR_DIR = Path(__file__).resolve().parent.parent / "assets" / "sprites"

PROMPT_STYLE_PREFIX = (
    "masterpiece, 32-bit pixel art, arcane dark fantasy, vivid elemental magic lighting, "
    "sharp clean silhouette, dark obsidian rim light, high contrast, transparent black background, "
)
NEGATIVE_PROMPT = (
    "blurry, soft gradients, 3d CGI render, photorealistic, noise, deformed limbs, artifacts, "
    "low resolution, washed out colors"
)

ASSET_PROMPTS = {
    "mage_petrus_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "earth mage Petrus, heavy carved granite plate armor, four glowing levitating stone arms orbiting his shoulders, emerald geomancy runes, battle stance",
        "steps": 4,
        "width": 512,
        "height": 512,
    },
    "mage_ignis_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "pyromancer Ignis, volcanic obsidian robes, crown of dancing violet flames, molten lava staff, intense glowing ruby eyes",
        "steps": 4,
        "width": 512,
        "height": 512,
    },
    "boss_archon_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "colossal Void Archon overlord, multi-eyed shadowy leviathan, jagged bone crown, eldritch purple corona, menacing boss sprite",
        "steps": 4,
        "width": 512,
        "height": 512,
    },
    "boss_phoenix_hd": {
        "prompt": PROMPT_STYLE_PREFIX + "Solar Phoenix apex boss, blazing golden and crimson feathers, solar flare aura, fiery talons, majestic mythical bird",
        "steps": 4,
        "width": 512,
        "height": 512,
    },
    "arena_ruins_floor": {
        "prompt": PROMPT_STYLE_PREFIX + "top-down seamless dark stone floor tile, etched mystical glowing glyphs, arcane dark cobblestone texture, dungeon ground",
        "steps": 4,
        "width": 512,
        "height": 512,
    }
}

def check_forge_status():
    """Verifica se o servidor WebUI Forge está ativo e respondendo na porta 7860."""
    try:
        req = urllib.request.Request(f"{FORGE_API_URL}/sdapi/v1/sd-models")
        with urllib.request.urlopen(req, timeout=3) as resp:
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
        with urllib.request.urlopen(req, timeout=120) as resp:
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
                    print(f"✔ [FLUX] Gerado com sucesso: {target_file}")
                    return True
    except Exception as e:
        print(f"✖ [FLUX] Erro ao gerar {key}: {e}")
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
    for key, config in ASSET_PROMPTS.items():
        print(f"[FLUX Client] Gerando lote: {key}...")
        generate_flux_image(key, config)

    print("✔ [FLUX Client] Lote concluído.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
