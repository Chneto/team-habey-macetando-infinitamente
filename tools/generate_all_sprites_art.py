#!/usr/bin/env python3
"""
generate_all_sprites_art.py
Gera arte pixel art de alta fidelidade e converte automaticamente em
folhas de sprites animadas de 4 quadros (idle, walkA, walkB, cast) com
canal alfa transparente para o Phaser 3.
Salva na pasta canônica public/assets/sprites/
"""

import sys
import os
import json
import base64
import io
import urllib.request
from pathlib import Path
from PIL import Image
import numpy as np

# Safe stdout for Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

FORGE_URL = os.environ.get("FORGE_URL", "http://127.0.0.1:7860")
OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "sprites"
OUT_DIR.mkdir(parents=True, exist_ok=True)

STYLE_PROMPT = (
    "masterpiece, 32-bit pixel art style, dark fantasy roguelike, sharp outlines, "
    "high contrast, vivid magic lighting, pitch black background, centered solo character sprite, clean silhouette"
)
NEGATIVE_PROMPT = "blurry, smooth 3d render, photo, realistic, background details, floor, frame, multiple characters, noise"

ROSTER = [
    # 1. Personagens (64x64 per frame, 4 frames = 256x64)
    {
        "key": "char_petrus",
        "frame_size": 64,
        "max_fit": 54,
        "prompt": f"{STYLE_PROMPT}, earth mage Petrus, carved heavy granite armor, glowing emerald geomancy runes, obsidian stones",
        "seed": 42
    },
    {
        "key": "char_ignis",
        "frame_size": 64,
        "max_fit": 54,
        "prompt": f"{STYLE_PROMPT}, pyromancer Ignis, volcanic dark robes, blazing violet flame crown, molten fire staff, fiery eyes",
        "seed": 105
    },
    {
        "key": "char_crya",
        "frame_size": 64,
        "max_fit": 54,
        "prompt": f"{STYLE_PROMPT}, cryomancer Crya, crystalline frost armor, sharp diamond ice spikes, glacial staff, pale blue mist",
        "seed": 204
    },
    {
        "key": "char_volt",
        "frame_size": 64,
        "max_fit": 54,
        "prompt": f"{STYLE_PROMPT}, electromancer Volt, conductive brass armor, crackling blue lightning arcs, plasma halo",
        "seed": 303
    },

    # 2. Demais Magos Elementais (64x64 per frame, 4 frames = 256x64)
    {
        "key": "char_sylas",
        "frame_size": 64,
        "max_fit": 54,
        "prompt": f"{STYLE_PROMPT}, nature druid Sylas, bark armor, emerald vine whip, glowing leaves mantle, forest spirit",
        "seed": 401
    },
    {
        "key": "char_zephyr",
        "frame_size": 64,
        "max_fit": 54,
        "prompt": f"{STYLE_PROMPT}, wind aeromancer Zephyr, feathered storm mantle, twin gale daggers, swirling turquoise wind cyclone",
        "seed": 505
    },
    {
        "key": "char_nyx",
        "frame_size": 64,
        "max_fit": 54,
        "prompt": f"{STYLE_PROMPT}, shadow warlock Nyx, ragged dark violet robes, floating astral grimoire, glowing purple soul lantern",
        "seed": 606
    },
    {
        "key": "char_solarius",
        "frame_size": 64,
        "max_fit": 54,
        "prompt": f"{STYLE_PROMPT}, sun paladin Solarius, radiant golden plate armor, solar warhammer, blazing sunburst crest",
        "seed": 707
    },
    {
        "key": "char_alchemius",
        "frame_size": 64,
        "max_fit": 54,
        "prompt": f"{STYLE_PROMPT}, plague alchemist, brass distillation goggles, bandolier of bubbling neon green chemical flasks",
        "seed": 808
    },
    {
        "key": "char_chronos",
        "frame_size": 64,
        "max_fit": 54,
        "prompt": f"{STYLE_PROMPT}, chronomancer Chronos, ancient clockwork mantle, floating golden gears, radiant temporal hourglass",
        "seed": 909
    },

    # 3. Demais Mobs e Inimigos (64x64 per frame, 4 frames = 256x64)
    {
        "key": "enemy_cultist",
        "frame_size": 64,
        "max_fit": 52,
        "prompt": f"{STYLE_PROMPT}, dark occult cultist, crimson ritual hood, skull mask, sacrificial bone dagger, dark aura",
        "seed": 111
    },
    {
        "key": "enemy_ghost",
        "frame_size": 64,
        "max_fit": 52,
        "prompt": f"{STYLE_PROMPT}, ethereal wraith banshee ghost, translucent pale cyan shroud, hollow glowing eyes, floating spirit",
        "seed": 222
    },
    {
        "key": "enemy_zombie",
        "frame_size": 64,
        "max_fit": 52,
        "prompt": f"{STYLE_PROMPT}, rotting plague zombie, tattered graveshroud, shambling posture, necrotic green slime",
        "seed": 333
    },
    {
        "key": "enemy_goblin",
        "frame_size": 64,
        "max_fit": 48,
        "prompt": f"{STYLE_PROMPT}, feral cave goblin, pointed ears, leather tunic, jagged spiked club, glowing yellow eyes",
        "seed": 444
    },
    {
        "key": "enemy_golem",
        "frame_size": 64,
        "max_fit": 54,
        "prompt": f"{STYLE_PROMPT}, heavy granite rock golem, mossy boulders, glowing orange core in chest, stone fists",
        "seed": 555
    },

    # 4. Demais Chefes & Mini-Bosses (96x96 per frame, 4 frames = 384x96)
    {
        "key": "boss_frost_warden",
        "frame_size": 96,
        "max_fit": 84,
        "prompt": f"{STYLE_PROMPT}, towering Frost Warden boss, glacial crystal armor, massive ice greathammer, subzero blizzard aura",
        "seed": 666
    },
    {
        "key": "boss_plague_alchemist",
        "frame_size": 96,
        "max_fit": 84,
        "prompt": f"{STYLE_PROMPT}, corrupted Plague Alchemist boss, bubbling cauldron backpack, twin acid throwers, glowing noxious fumes",
        "seed": 777
    },
    {
        "key": "boss_malakor",
        "frame_size": 96,
        "max_fit": 84,
        "prompt": f"{STYLE_PROMPT}, Demon Lord Malakor boss, obsidian horned crown, heavy hellfire greatsword, crimson volcanic wings",
        "seed": 888
    },
    {
        "key": "boss_vorath",
        "frame_size": 96,
        "max_fit": 84,
        "prompt": f"{STYLE_PROMPT}, ancient Shadow Dragon Vorath boss, dark amethyst scales, glowing void breath, massive shadowy wingspan",
        "seed": 999
    },
    {
        "key": "boss_kryos",
        "frame_size": 96,
        "max_fit": 84,
        "prompt": f"{STYLE_PROMPT}, Frost Lich Kryos boss, floating skeletal ribcage, frozen crown of icicles, levitating glacial orbs",
        "seed": 1010
    }
]

def generate_image(prompt, seed=42):
    payload = {
        "prompt": prompt,
        "negative_prompt": NEGATIVE_PROMPT,
        "steps": 20,
        "cfg_scale": 7.0,
        "width": 512,
        "height": 512,
        "sampler_name": "Euler a",
        "seed": seed
    }
    req = urllib.request.Request(
        f"{FORGE_URL}/sdapi/v1/txt2img",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        b64 = data["images"][0]
        return Image.open(io.BytesIO(base64.b64decode(b64)))

def process_and_create_spritesheet(raw_img, frame_size=64, max_fit=54):
    """Remove o fundo preto, recorta o sujeito e gera a folha de 4 quadros."""
    rgba = raw_img.convert("RGBA")
    arr = np.array(rgba)

    # Identifica fundo escuro próximo a preto (limiar de luma)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    dark_mask = (r < 28) & (g < 28) & (b < 28)
    arr[dark_mask, 3] = 0

    keyed_img = Image.fromarray(arr)
    bbox = keyed_img.getbbox()
    if bbox:
        cropped = keyed_img.crop(bbox)
    else:
        cropped = keyed_img

    # Ajusta tamanho para caber no quadro mantendo proporção
    cropped.thumbnail((max_fit, max_fit), Image.Resampling.LANCZOS)
    cw, ch = cropped.size

    # Monta spritesheet de 4 quadros
    sheet_width = frame_size * 4
    sheet_height = frame_size
    sheet = Image.new("RGBA", (sheet_width, sheet_height), (0, 0, 0, 0))

    for f in range(4):
        ox = f * frame_size + (frame_size - cw) // 2
        # Bobbing e leve animação de caminhada/ataque
        bob = 0 if f == 0 else (-2 if f == 1 else (2 if f == 2 else -3))
        oy = (frame_size - ch) // 2 + bob
        sheet.paste(cropped, (ox, oy), cropped)

    return sheet, cropped

def main():
    print("=== [Art Forge] Gerando Sprites Reais via Stable Diffusion / Forge ===")
    
    # Processa cada entidade do elenco
    for item in ROSTER:
        key = item["key"]
        print(f"-> Gerando arte para: {key} (frame: {item['frame_size']}x{item['frame_size']})...")
        try:
            raw = generate_image(item["prompt"], item["seed"])
            # Salva também a versão HD original de retrato
            hd_path = OUT_DIR / f"{key}_hd.png"
            raw.save(hd_path)

            # Gera a folha de sprites animada de 4 quadros
            sheet, _ = process_and_create_spritesheet(raw, item["frame_size"], item["max_fit"])
            sheet_path = OUT_DIR / f"{key}.png"
            sheet.save(sheet_path)
            print(f"   [OK] Folha animada salva em: {sheet_path.name} ({sheet.size})")
        except Exception as e:
            print(f"   [ERRO] Falha ao processar {key}: {e}")

    print("=== [Art Forge] Lote concluído com sucesso! ===")

if __name__ == "__main__":
    main()
