import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { CHARACTERS_DATA } from '../src/config/charactersData.js';
import {
  ENEMY_TYPES,
  PETS_DATA
} from '../src/config/enemiesData.js';

const OUT_DIR = path.resolve(process.cwd(), 'public/assets/sprites');
fs.mkdirSync(OUT_DIR, { recursive: true });

function writeSpriteFile(filename, buffer) {
  fs.writeFileSync(path.join(OUT_DIR, filename), buffer);
}

// CRC32 Table for PNG chunk encoding
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodeRGBAtoPNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function hexToRgb(hexInt) {
  return [(hexInt >> 16) & 0xff, (hexInt >> 8) & 0xff, hexInt & 0xff];
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function setPixel(rgba, width, height, x, y, r, g, b, a = 255) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= width || iy >= height) return;
  // Prevent accidental Chroma Magenta (#FF00FF) inside opaque art
  if (r > 205 && g < 55 && b > 205) {
    g = 58;
  }
  const idx = (iy * width + ix) * 4;
  rgba[idx] = clampByte(r);
  rgba[idx + 1] = clampByte(g);
  rgba[idx + 2] = clampByte(b);
  rgba[idx + 3] = clampByte(a);
}

/**
 * Smooth volumetric ellipse with optional dark inner border for crisp armor/cloth separation
 */
function fillEllipse(rgba, width, height, cx, cy, rx, ry, rgb, shade = 1.0, rimDarken = 0.52) {
  if (rx <= 0 || ry <= 0) return;
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d2 = dx * dx + dy * dy;
      if (d2 <= 1.0) {
        // Smooth radial + top-left directional highlight (no step seams!)
        const highlight = Math.max(0, -dx * 0.22 - dy * 0.28);
        let light = (1.12 + highlight - 0.36 * d2 - 0.14 * dy) * shade;
        if (d2 > 0.78 && rimDarken < 1.0) {
          light *= rimDarken;
        }
        setPixel(rgba, width, height, x, y, rgb[0] * light, rgb[1] * light, rgb[2] * light, 255);
      }
    }
  }
}

/**
 * Trapezoid / Tapered Armor & Robe Renderer (eliminates "round ball" torso look!)
 */
function fillTrapezoid(rgba, width, height, cx, yTop, yBot, topHalfW, botHalfW, rgb, shade = 1.0, rimDarken = 0.5) {
  const minY = Math.floor(yTop);
  const maxY = Math.ceil(yBot);
  const spanY = Math.max(1, maxY - minY);
  for (let y = minY; y <= maxY; y++) {
    const t = (y - minY) / spanY;
    const hw = topHalfW + (botHalfW - topHalfW) * t;
    const x0 = Math.floor(cx - hw);
    const x1 = Math.ceil(cx + hw);
    for (let x = x0; x <= x1; x++) {
      const nx = hw > 0 ? (x - cx) / hw : 0;
      const isEdge = Math.abs(nx) > 0.84 || t < 0.08 || t > 0.91;
      // Cloth/Armor vertical fold & cylindrical shading
      const fold = 0.07 * Math.cos(nx * Math.PI * 2.5);
      let light = (1.14 - 0.28 * nx * nx - 0.16 * t + fold) * shade;
      if (isEdge) light *= rimDarken;
      setPixel(rgba, width, height, x, y, rgb[0] * light, rgb[1] * light, rgb[2] * light, 255);
    }
  }
}

function fillRing(rgba, width, height, cx, cy, rOuter, rInner, rgb, shade = 1.0, flattenY = 1.0) {
  const x0 = Math.floor(cx - rOuter);
  const x1 = Math.ceil(cx + rOuter);
  const y0 = Math.floor(cy - rOuter * flattenY);
  const y1 = Math.ceil(cy + rOuter * flattenY);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = (y - cy) / flattenY;
      const d = Math.hypot(dx, dy);
      if (d <= rOuter && d >= rInner) {
        const light = shade * (1.08 - 0.15 * (dy / rOuter));
        setPixel(rgba, width, height, x, y, rgb[0] * light, rgb[1] * light, rgb[2] * light, 255);
      }
    }
  }
}

function fillTriangle(rgba, width, height, x1, y1, x2, y2, x3, y3, rgb, shade = 1.0, rimDarken = 0.65) {
  const minX = Math.floor(Math.min(x1, x2, x3));
  const maxX = Math.ceil(Math.max(x1, x2, x3));
  const minY = Math.floor(Math.min(y1, y2, y3));
  const maxY = Math.ceil(Math.max(y1, y2, y3));
  const denom = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
  if (Math.abs(denom) < 0.0001) return;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / denom;
      const b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / denom;
      const c = 1 - a - b;
      if (a >= -0.01 && b >= -0.01 && c >= -0.01) {
        const edge = a < 0.09 || b < 0.09 || c < 0.09 ? rimDarken : 1.0;
        const grad = (0.94 + 0.24 * c) * edge;
        setPixel(
          rgba,
          width,
          height,
          x,
          y,
          rgb[0] * shade * grad,
          rgb[1] * shade * grad,
          rgb[2] * shade * grad,
          255
        );
      }
    }
  }
}

function drawLine(rgba, width, height, x1, y1, x2, y2, radius, rgb, shade = 1.0) {
  const dist = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2));
  for (let i = 0; i <= dist; i++) {
    const t = i / dist;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    fillEllipse(rgba, width, height, px, py, radius, radius, rgb, shade, 0.85);
  }
}

function fillChromaMagenta(rgba, width, height) {
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 0;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = 255;
  }
}

/**
 * Chroma Key removal (#FF00FF -> Alpha 0) + 1px dark/luminous outline
 */
function applyChromaKeyAndOutline(rgba, width, height, outlineRgb = [14, 10, 24]) {
  const alphaMask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const dist = Math.hypot(r - 255, g - 0, b - 255);
    if (dist < 65) {
      rgba[i * 4] = 0;
      rgba[i * 4 + 1] = 0;
      rgba[i * 4 + 2] = 0;
      rgba[i * 4 + 3] = 0;
      alphaMask[i] = 0;
    } else {
      alphaMask[i] = 1;
    }
  }

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (alphaMask[idx] === 0) {
        const hasOpaqueNeighbor =
          alphaMask[idx - 1] === 1 ||
          alphaMask[idx + 1] === 1 ||
          alphaMask[idx - width] === 1 ||
          alphaMask[idx + width] === 1;
        if (hasOpaqueNeighbor) {
          const p = idx * 4;
          rgba[p] = outlineRgb[0];
          rgba[p + 1] = outlineRgb[1];
          rgba[p + 2] = outlineRgb[2];
          rgba[p + 3] = 250;
        }
      }
    }
  }
}

/**
 * Draws a dark-fantasy shadowed visor/hood recess with bold glowing 3x2 eyes!
 */
function drawHeroicVisage(rgba, width, height, cx, cy, eyeRgb, spread = 3) {
  // Shadowed brow recess
  fillEllipse(rgba, width, height, cx, cy, spread + 2.8, 2.4, [14, 12, 24], 1.0, 1.0);
  // Left glowing eye (2x2 with white spark)
  setPixel(rgba, width, height, cx - spread - 1, cy, eyeRgb[0], eyeRgb[1], eyeRgb[2]);
  setPixel(rgba, width, height, cx - spread, cy, 255, 255, 255);
  setPixel(rgba, width, height, cx - spread, cy + 1, eyeRgb[0], eyeRgb[1], eyeRgb[2]);
  // Right glowing eye (2x2 with white spark)
  setPixel(rgba, width, height, cx + spread + 1, cy, eyeRgb[0], eyeRgb[1], eyeRgb[2]);
  setPixel(rgba, width, height, cx + spread, cy, 255, 255, 255);
  setPixel(rgba, width, height, cx + spread, cy + 1, eyeRgb[0], eyeRgb[1], eyeRgb[2]);
}

/**
 * Bespoke Character Frame Renderer (64x64 per frame, 4 frames):
 * Uses V-tapered armor & flared mage cloaks, shadowed hood visors, belts, and detailed iconic weapons!
 */
function drawCharacterFrame(rgba, width, height, ox, oy, fw, fh, frameIdx, char) {
  const cx = ox + fw / 2;
  const cy = oy + fh / 2;
  const primaryRgb = hexToRgb(char.primaryColor);
  const accentRgb = hexToRgb(char.accentColor);

  const walkOffset = frameIdx === 1 ? -3.5 : frameIdx === 2 ? 3.5 : 0;
  const bobY = frameIdx === 1 || frameIdx === 2 ? -2 : frameIdx === 3 ? -3 : 0;
  const castExtend = frameIdx === 3 ? 5 : 0;

  // 1. Back-Layer Cape / Halo / Scarf / Gears
  if (char.id === 'solarius') {
    // 8-Ray Radiant Solar Halo + Crimson Templar Mantle
    fillRing(rgba, width, height, cx, cy - 10 + bobY, 18, 13.5, [253, 224, 71], 1.2);
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4 + frameIdx * 0.12;
      fillTriangle(
        rgba,
        width,
        height,
        cx + Math.cos(ang - 0.15) * 15,
        cy - 10 + bobY + Math.sin(ang - 0.15) * 15,
        cx + Math.cos(ang + 0.15) * 15,
        cy - 10 + bobY + Math.sin(ang + 0.15) * 15,
        cx + Math.cos(ang) * 23,
        cy - 10 + bobY + Math.sin(ang) * 23,
        [251, 191, 36],
        1.3
      );
    }
    fillTrapezoid(rgba, width, height, cx, cy - 4 + bobY, cy + 19 + bobY, 11, 16, [185, 28, 28], 0.95);
  } else if (char.id === 'zephyr') {
    const wave = frameIdx === 1 ? -4 : frameIdx === 2 ? 4 : frameIdx === 3 ? -6 : 0;
    fillTriangle(rgba, width, height, cx - 5, cy - 7 + bobY, cx - 26, cy - 15 + wave, cx - 22, cy - 3 + wave, [16, 185, 129], 1.2);
    fillTriangle(rgba, width, height, cx - 4, cy - 4 + bobY, cx - 25, cy + 3 - wave, cx - 18, cy + 11 - wave, [52, 211, 153], 1.15);
  } else if (char.id === 'chronos') {
    fillRing(rgba, width, height, cx - 15, cy - 9 + bobY, 7, 4, [251, 191, 36], 1.25);
    fillRing(rgba, width, height, cx + 15, cy - 9 + bobY, 7, 4, [251, 191, 36], 1.25);
    fillTrapezoid(rgba, width, height, cx, cy - 3 + bobY, cy + 19 + bobY, 10, 15, [30, 27, 75], 0.9);
  } else if (char.id === 'nyx') {
    fillRing(rgba, width, height, cx, cy + 2 + bobY, 21, 17, [168, 85, 247], 1.15, 0.52);
  } else if (char.id === 'alchemius') {
    // Pressurized Alchemical Tank on back
    fillTrapezoid(rgba, width, height, cx - 12, cy - 10 + bobY, cy + 4 + bobY, 4.5, 4.5, [132, 204, 22], 1.2);
  } else {
    // Heroic Flowing Cloak Back-Layer
    fillTrapezoid(rgba, width, height, cx, cy - 3 + bobY, cy + 18 + bobY, 10, 15, primaryRgb, 0.72);
  }

  // 2. Boots / Greaves / Void Tendrils
  if (char.id === 'nyx') {
    for (let t = -1; t <= 1; t++) {
      fillTriangle(
        rgba,
        width,
        height,
        cx + t * 5 - 3,
        cy + 12 + bobY,
        cx + t * 5 + 3,
        cy + 12 + bobY,
        cx + t * 6 + walkOffset * 0.5,
        cy + 23 + bobY,
        [126, 34, 206],
        1.1
      );
    }
  } else {
    const bootRgb = char.id === 'solarius' ? [217, 119, 6] : char.id === 'petrus' ? [87, 83, 78] : [30, 34, 48];
    fillTrapezoid(rgba, width, height, cx - 6, cy + 13 + walkOffset, cy + 22 + walkOffset, 3.5, 4.5, bootRgb, 1.0);
    fillTrapezoid(rgba, width, height, cx + 6, cy + 13 - walkOffset, cy + 22 - walkOffset, 3.5, 4.5, bootRgb, 1.0);
  }

  // 3. Flared Lower Robe / Armored Tassets (Trapezoidal instead of round ball!)
  fillTrapezoid(rgba, width, height, cx, cy + 3 + bobY, cy + 16 + bobY, 8.5, 13.5, primaryRgb, 0.95);
  // Center Tabard / Robe Sash hanging from belt
  fillTrapezoid(rgba, width, height, cx, cy + 3 + bobY, cy + 16 + bobY, 3.8, 5.2, accentRgb, 1.15);

  // 4. Heroic V-Tapered Upper Torso / Breastplate
  fillTrapezoid(rgba, width, height, cx, cy - 7 + bobY, cy + 4 + bobY, 12.5, 8.5, primaryRgb, 1.12);

  // Waist Belt & Metallic Buckle
  drawLine(rgba, width, height, cx - 8, cy + 3 + bobY, cx + 8, cy + 3 + bobY, 1.6, [30, 25, 38], 1.0);
  fillEllipse(rgba, width, height, cx, cy + 3 + bobY, 2.8, 2.2, accentRgb, 1.35);

  // Sculpted Shoulder Pauldrons
  fillEllipse(rgba, width, height, cx - 12, cy - 4 + bobY, 5.5, 4.8, accentRgb, 1.15, 0.45);
  fillEllipse(rgba, width, height, cx + 12, cy - 4 + bobY, 5.5, 4.8, accentRgb, 1.15, 0.45);

  // 5. Character-Specific Chestplate Details
  if (char.id === 'petrus') {
    // Molten magma fissure veins carved into basalt breastplate
    drawLine(rgba, width, height, cx - 7, cy - 6 + bobY, cx, cy + 1 + bobY, 1.6, [245, 158, 11], 1.4);
    drawLine(rgba, width, height, cx + 7, cy - 6 + bobY, cx, cy + 1 + bobY, 1.6, [245, 158, 11], 1.4);
    drawLine(rgba, width, height, cx, cy + 1 + bobY, cx, cy + 5 + bobY, 1.5, [253, 224, 71], 1.45);
    // Golden titan torc / runic collar
    drawLine(rgba, width, height, cx - 6, cy - 7 + bobY, cx + 6, cy - 7 + bobY, 1.8, [251, 191, 36], 1.35);
  } else if (char.id === 'solarius') {
    drawLine(rgba, width, height, cx, cy - 6 + bobY, cx, cy + 2 + bobY, 1.8, [254, 249, 195], 1.35);
    drawLine(rgba, width, height, cx - 5, cy - 3 + bobY, cx + 5, cy - 3 + bobY, 1.8, [254, 249, 195], 1.35);
  } else if (char.id === 'alchemius') {
    drawLine(rgba, width, height, cx - 8, cy - 5 + bobY, cx + 8, cy + 3 + bobY, 2.0, [45, 40, 35], 1.0);
    fillEllipse(rgba, width, height, cx - 4, cy - 3 + bobY, 2.2, 2.8, [163, 230, 53], 1.35);
    fillEllipse(rgba, width, height, cx + 1, cy - 1 + bobY, 2.2, 2.8, [56, 189, 248], 1.35);
    fillEllipse(rgba, width, height, cx + 5, cy + 1 + bobY, 2.2, 2.8, [251, 191, 36], 1.35);
  } else if (char.id === 'volt') {
    drawLine(rgba, width, height, cx - 7, cy - 5 + bobY, cx - 2, cy + 1 + bobY, 1.3, [56, 189, 248], 1.4);
    drawLine(rgba, width, height, cx + 7, cy - 5 + bobY, cx + 2, cy + 1 + bobY, 1.3, [56, 189, 248], 1.4);
  } else {
    fillEllipse(rgba, width, height, cx, cy - 2 + bobY, 3.2, 3.2, accentRgb, 1.35);
  }

  // 6. Arms & Signature Weapons
  const leftArmX = cx - 14 - castExtend * 0.35;
  const leftArmY = cy + 1 + bobY - walkOffset * 0.4;
  const rightArmX = cx + 14 + castExtend * 0.8;
  const rightArmY = cy + bobY + walkOffset * 0.4;

  if (char.id === 'petrus') {
    // Petrus has heavy rock-plated gauntlets at his sides; his 4 floating articulated stone arms are rigged via AnimationSystem
    fillEllipse(rgba, width, height, leftArmX, leftArmY, 4.8, 5.5, [120, 113, 108], 1.15, 0.45);
    fillEllipse(rgba, width, height, rightArmX, rightArmY, 4.8, 5.5, [120, 113, 108], 1.15, 0.45);
    // Gold knuckle bands & amber runic veins on gauntlets
    fillEllipse(rgba, width, height, leftArmX, leftArmY + 1, 2.4, 2.4, [251, 191, 36], 1.4);
    fillEllipse(rgba, width, height, rightArmX, rightArmY + 1, 2.4, 2.4, [251, 191, 36], 1.4);
  } else {
    fillEllipse(rgba, width, height, leftArmX, leftArmY, 4.0, 4.8, primaryRgb, 1.05);
    fillEllipse(rgba, width, height, rightArmX, rightArmY, 4.0, 4.8, primaryRgb, 1.05);
  }

  if (char.id === 'ignis') {
    drawLine(rgba, width, height, rightArmX + 2, rightArmY - 12, rightArmX + 2, rightArmY + 12, 1.7, [120, 53, 15], 1.05);
    fillEllipse(rgba, width, height, rightArmX + 2, rightArmY - 14, 5.2, 5.2, [249, 115, 22], 1.35);
    fillEllipse(rgba, width, height, rightArmX + 2, rightArmY - 14, 2.6, 2.6, [254, 249, 195], 1.4);
    fillEllipse(rgba, width, height, leftArmX - 2, leftArmY - 2, 4.2, 4.2, [249, 115, 22], 1.3);
  } else if (char.id === 'crya') {
    drawLine(rgba, width, height, rightArmX + 2, rightArmY - 13, rightArmX + 2, rightArmY + 11, 1.6, [186, 230, 253], 1.15);
    fillTriangle(rgba, width, height, rightArmX - 3, rightArmY - 12, rightArmX + 7, rightArmY - 12, rightArmX + 2, rightArmY - 22, [56, 189, 248], 1.35);
    fillTriangle(rgba, width, height, rightArmX - 2, rightArmY - 15, rightArmX + 6, rightArmY - 15, rightArmX + 2, rightArmY - 9, [224, 242, 254], 1.35);
  } else if (char.id === 'volt') {
    // Thunder drum nodes behind shoulders + plasma fists
    fillEllipse(rgba, width, height, cx - 15, cy - 13 + bobY, 3.2, 3.2, [250, 204, 21], 1.35);
    fillEllipse(rgba, width, height, cx + 15, cy - 13 + bobY, 3.2, 3.2, [250, 204, 21], 1.35);
    fillEllipse(rgba, width, height, leftArmX - 2, leftArmY, 5.2, 5.2, [250, 204, 21], 1.38);
    fillEllipse(rgba, width, height, leftArmX - 2, leftArmY, 2.5, 2.5, [255, 255, 255], 1.4);
    fillEllipse(rgba, width, height, rightArmX + 2, rightArmY, 5.2, 5.2, [56, 189, 248], 1.38);
    fillEllipse(rgba, width, height, rightArmX + 2, rightArmY, 2.5, 2.5, [255, 255, 255], 1.4);
  } else if (char.id === 'sylas') {
    drawLine(rgba, width, height, rightArmX + 2, rightArmY - 12, rightArmX + 1, rightArmY + 12, 1.9, [101, 67, 33], 1.05);
    fillEllipse(rgba, width, height, rightArmX + 2, rightArmY - 14, 4.8, 4.8, [132, 204, 22], 1.35);
    fillEllipse(rgba, width, height, rightArmX + 2, rightArmY - 14, 2.2, 2.2, [236, 252, 203], 1.4);
  } else if (char.id === 'zephyr') {
    fillRing(rgba, width, height, rightArmX + 3, rightArmY, 6.8, 3.2, [110, 231, 183], 1.35);
    fillRing(rgba, width, height, leftArmX - 3, leftArmY, 6.2, 3.0, [52, 211, 153], 1.3);
  } else if (char.id === 'nyx') {
    fillEllipse(rgba, width, height, rightArmX + 3, rightArmY - 2, 5.8, 5.8, [192, 132, 252], 1.35);
    fillEllipse(rgba, width, height, rightArmX + 3, rightArmY - 2, 2.8, 2.8, [15, 10, 28], 1.0);
    // Floating Astral Grimoire on left side
    fillTrapezoid(rgba, width, height, leftArmX - 3, leftArmY - 5, leftArmY + 3, 4.2, 4.2, [88, 28, 135], 1.25);
    drawLine(rgba, width, height, leftArmX - 3, leftArmY - 4, leftArmX - 3, leftArmY + 2, 1.2, [253, 224, 71], 1.35);
  } else if (char.id === 'solarius') {
    drawLine(rgba, width, height, rightArmX + 3, rightArmY - 12, rightArmX + 3, rightArmY + 10, 1.8, [180, 83, 9], 1.1);
    fillTrapezoid(rgba, width, height, rightArmX + 3, rightArmY - 16, rightArmY - 10, 6.5, 5.5, [253, 224, 71], 1.35);
    // Sun Tower Shield on left arm
    fillTrapezoid(rgba, width, height, leftArmX - 2, leftArmY - 6, leftArmY + 8, 6.0, 4.0, [251, 191, 36], 1.25);
    fillEllipse(rgba, width, height, leftArmX - 2, leftArmY, 2.5, 2.5, [254, 249, 195], 1.4);
  } else if (char.id === 'alchemius') {
    fillEllipse(rgba, width, height, rightArmX + 3, rightArmY - 2, 4.8, 5.2, [163, 230, 53], 1.35);
    fillEllipse(rgba, width, height, rightArmX + 3, rightArmY - 6, 2.2, 2.0, [226, 232, 240], 1.2);
  } else if (char.id === 'chronos') {
    drawLine(rgba, width, height, rightArmX + 2, rightArmY - 13, rightArmX + 2, rightArmY + 11, 1.7, [217, 119, 6], 1.15);
    fillTriangle(rgba, width, height, rightArmX - 2, rightArmY - 19, rightArmX + 6, rightArmY - 19, rightArmX + 2, rightArmY - 13, [56, 189, 248], 1.35);
    fillTriangle(rgba, width, height, rightArmX - 2, rightArmY - 9, rightArmX + 6, rightArmY - 9, rightArmX + 2, rightArmY - 15, [253, 224, 71], 1.35);
  }

  // 7. Head, Hood/Helmet & Character-Specific Visage
  const skinRgb =
    char.id === 'petrus'
      ? [140, 136, 146]
      : char.id === 'solarius'
      ? [251, 191, 36]
      : [215, 200, 192];

  if (char.id === 'petrus' || char.id === 'crya') {
    fillTriangle(rgba, width, height, cx - 6, cy - 15 + bobY, cx - 6, cy - 10 + bobY, cx - 16, cy - 14 + bobY, skinRgb, 1.1);
    fillTriangle(rgba, width, height, cx + 6, cy - 15 + bobY, cx + 6, cy - 10 + bobY, cx + 16, cy - 14 + bobY, skinRgb, 1.1);
  }

  // Outer Hood / Helmet Cowl
  fillEllipse(rgba, width, height, cx, cy - 13 + bobY, 8.8, 8.2, primaryRgb, 1.12, 0.45);
  // Inner Face / Visor
  fillEllipse(rgba, width, height, cx, cy - 12 + bobY, 6.2, 5.8, skinRgb, 1.06, 0.75);

  if (char.id === 'alchemius') {
    // Plague Doctor Crow-Beak Mask & Neon Green Goggles
    fillEllipse(rgba, width, height, cx, cy - 19 + bobY, 12.5, 3.0, [24, 30, 42], 1.0);
    fillTriangle(rgba, width, height, cx - 4, cy - 13 + bobY, cx + 4, cy - 10 + bobY, cx + 13, cy - 8 + bobY, [226, 232, 240], 1.2);
    fillEllipse(rgba, width, height, cx - 3, cy - 13 + bobY, 2.4, 2.2, [163, 230, 53], 1.4, 0.4);
    fillEllipse(rgba, width, height, cx + 3, cy - 13 + bobY, 2.4, 2.2, [163, 230, 53], 1.4, 0.4);
    return;
  }

  // Shadowed Brow & Glowing Eyes for all other characters
  drawHeroicVisage(rgba, width, height, cx, cy - 12 + bobY, accentRgb, 3);

  // Crowns, Antlers, Hats, Helmets & Beards
  if (char.id === 'ignis') {
    const flicker = frameIdx % 2 === 0 ? -1.5 : 1.0;
    fillTriangle(rgba, width, height, cx - 8, cy - 17 + bobY, cx - 2, cy - 17 + bobY, cx - 6, cy - 26 + bobY + flicker, [249, 115, 22], 1.35);
    fillTriangle(rgba, width, height, cx - 4, cy - 18 + bobY, cx + 4, cy - 18 + bobY, cx, cy - 28 + bobY - flicker, [253, 224, 71], 1.4);
    fillTriangle(rgba, width, height, cx + 2, cy - 17 + bobY, cx + 8, cy - 17 + bobY, cx + 6, cy - 26 + bobY + flicker, [249, 115, 22], 1.35);
  } else if (char.id === 'crya') {
    fillTriangle(rgba, width, height, cx - 7, cy - 18 + bobY, cx - 2, cy - 18 + bobY, cx - 5, cy - 25 + bobY, [56, 189, 248], 1.35);
    fillTriangle(rgba, width, height, cx - 3, cy - 19 + bobY, cx + 3, cy - 19 + bobY, cx, cy - 28 + bobY, [224, 242, 254], 1.4);
    fillTriangle(rgba, width, height, cx + 2, cy - 18 + bobY, cx + 7, cy - 18 + bobY, cx + 5, cy - 25 + bobY, [56, 189, 248], 1.35);
  } else if (char.id === 'sylas') {
    drawLine(rgba, width, height, cx - 5, cy - 18 + bobY, cx - 13, cy - 26 + bobY, 1.8, [120, 53, 15], 1.15);
    drawLine(rgba, width, height, cx - 9, cy - 22 + bobY, cx - 5, cy - 27 + bobY, 1.4, [132, 204, 22], 1.35);
    drawLine(rgba, width, height, cx + 5, cy - 18 + bobY, cx + 13, cy - 26 + bobY, 1.8, [120, 53, 15], 1.15);
    drawLine(rgba, width, height, cx + 9, cy - 22 + bobY, cx + 5, cy - 27 + bobY, 1.4, [132, 204, 22], 1.35);
  } else if (char.id === 'nyx') {
    fillEllipse(rgba, width, height, cx, cy - 18 + bobY, 13.5, 3.2, [59, 7, 100], 1.15);
    fillTriangle(rgba, width, height, cx - 8, cy - 18 + bobY, cx + 8, cy - 18 + bobY, cx + 2, cy - 29 + bobY, [107, 33, 168], 1.25);
  } else if (char.id === 'chronos') {
    fillTriangle(rgba, width, height, cx - 5, cy - 9 + bobY, cx + 5, cy - 9 + bobY, cx, cy + 5 + bobY, [241, 245, 249], 1.2);
    fillEllipse(rgba, width, height, cx, cy - 19 + bobY, 6.5, 2.4, [251, 191, 36], 1.35);
  } else if (char.id === 'solarius') {
    // Golden Paladin T-Visor Cross & Helmet Wings
    drawLine(rgba, width, height, cx, cy - 15 + bobY, cx, cy - 8 + bobY, 1.3, [120, 53, 15], 0.9);
    fillTriangle(rgba, width, height, cx - 7, cy - 15 + bobY, cx - 7, cy - 19 + bobY, cx - 15, cy - 23 + bobY, [254, 240, 138], 1.3);
    fillTriangle(rgba, width, height, cx + 7, cy - 15 + bobY, cx + 7, cy - 19 + bobY, cx + 15, cy - 23 + bobY, [254, 240, 138], 1.3);
  } else if (char.id === 'volt') {
    fillTriangle(rgba, width, height, cx - 6, cy - 18 + bobY, cx, cy - 18 + bobY, cx - 4, cy - 26 + bobY, [250, 204, 21], 1.35);
    fillTriangle(rgba, width, height, cx, cy - 18 + bobY, cx + 6, cy - 18 + bobY, cx + 5, cy - 26 + bobY, [254, 249, 195], 1.4);
  } else if (char.id === 'petrus') {
    // Basalt Horn Crown, Glowing Amber Forehead Sigil & Golden Ear Cuffs
    fillTriangle(rgba, width, height, cx - 6, cy - 18 + bobY, cx + 6, cy - 18 + bobY, cx, cy - 27 + bobY, [120, 113, 108], 1.25);
    fillTriangle(rgba, width, height, cx - 8, cy - 17 + bobY, cx - 4, cy - 17 + bobY, cx - 8, cy - 23 + bobY, [87, 83, 78], 1.15);
    fillTriangle(rgba, width, height, cx + 4, cy - 17 + bobY, cx + 8, cy - 17 + bobY, cx + 8, cy - 23 + bobY, [87, 83, 78], 1.15);
    fillEllipse(rgba, width, height, cx, cy - 16 + bobY, 2.6, 2.6, [253, 224, 71], 1.45);
    fillEllipse(rgba, width, height, cx - 7, cy - 12 + bobY, 1.8, 1.8, [251, 191, 36], 1.35);
    fillEllipse(rgba, width, height, cx + 7, cy - 12 + bobY, 1.8, 1.8, [251, 191, 36], 1.35);
  }
}

/**
 * Bespoke Enemy Mob Renderer (64x64 per frame, 4 frames):
 * Distinct silhouettes, armor plates, skulls, fangs, and weapons!
 */
function drawEnemyMobFrame(rgba, width, height, ox, oy, fw, fh, frameIdx, enemy) {
  const cx = ox + fw / 2;
  const cy = oy + fh / 2;
  const walk = frameIdx === 1 ? -3.5 : frameIdx === 2 ? 3.5 : 0;
  const bob = frameIdx === 1 || frameIdx === 2 ? -2 : frameIdx === 3 ? -3 : 0;
  const lunge = frameIdx === 3 ? 5 : 0;

  switch (enemy.id) {
    case 'goblin_runner': {
      const skin = [101, 163, 13];
      const leather = [120, 53, 15];
      // Scurrying legs
      fillTrapezoid(rgba, width, height, cx - 6 + walk, cy + 12, cy + 20, 3, 4, leather, 0.95);
      fillTrapezoid(rgba, width, height, cx + 6 - walk, cy + 12, cy + 20, 3, 4, leather, 0.95);
      // Bulging Plunder Sack on left back
      fillEllipse(rgba, width, height, cx - 10, cy + 2 + bob, 7.5, 8.5, [161, 98, 7], 1.05, 0.5);
      // Hunched Raider Vest & Spiked Shoulder
      fillTrapezoid(rgba, width, height, cx, cy - 2 + bob, cy + 12 + bob, 9.5, 7.5, leather, 1.05);
      fillEllipse(rgba, width, height, cx + 9, cy - 2 + bob, 4.5, 4.0, [100, 116, 139], 1.1);
      // Wide Pointed Goblin Ears
      fillTriangle(rgba, width, height, cx - 6, cy - 10 + bob, cx - 6, cy - 5 + bob, cx - 19, cy - 11 + bob, skin, 1.1);
      fillTriangle(rgba, width, height, cx + 6, cy - 10 + bob, cx + 6, cy - 5 + bob, cx + 19, cy - 11 + bob, skin, 1.1);
      // Feral Goblin Head, Glowing Red Eyes & White Fangs
      fillEllipse(rgba, width, height, cx, cy - 8 + bob, 8.2, 7.2, skin, 1.12, 0.5);
      drawHeroicVisage(rgba, width, height, cx, cy - 9 + bob, [239, 68, 68], 3);
      setPixel(rgba, width, height, cx - 2, cy - 4 + bob, 255, 255, 255);
      setPixel(rgba, width, height, cx + 2, cy - 4 + bob, 255, 255, 255);
      // Jagged Rusty Cleaver in right hand
      drawLine(rgba, width, height, cx + 11 + lunge, cy + 3 + bob, cx + 15 + lunge, cy + 3 + bob, 1.8, leather, 1.0);
      fillTriangle(
        rgba,
        width,
        height,
        cx + 14 + lunge,
        cy - 1 + bob,
        cx + 14 + lunge,
        cy + 6 + bob,
        cx + 25 + lunge,
        cy + 2 + bob,
        [226, 232, 240],
        1.25
      );
      break;
    }

    case 'skeleton_warrior': {
      const bone = [226, 232, 240];
      const darkBone = [148, 163, 184];
      // Bony legs
      drawLine(rgba, width, height, cx - 5, cy + 9, cx - 6, cy + 20 + walk, 2.0, darkBone, 1.0);
      drawLine(rgba, width, height, cx + 5, cy + 9, cx + 6, cy + 20 - walk, 2.0, darkBone, 1.0);
      // Pelvis & Dark tattered loincloth
      fillTrapezoid(rgba, width, height, cx, cy + 7 + bob, cy + 14 + bob, 7.5, 5.0, [51, 65, 85], 0.95);
      // Dark Necrotic Chest Cavity with Glowing Cyan Core & 3 White Ribs
      fillTrapezoid(rgba, width, height, cx, cy - 5 + bob, cy + 7 + bob, 8.5, 6.5, [15, 23, 42], 1.0);
      fillEllipse(rgba, width, height, cx, cy + 1 + bob, 3.8, 4.5, [56, 189, 248], 1.35);
      for (let r = -3; r <= 3; r += 3) {
        drawLine(rgba, width, height, cx - 7, cy + r + bob, cx + 7, cy + r + bob, 1.4, bone, 1.15);
      }
      // Spiked Iron Pauldrons
      fillEllipse(rgba, width, height, cx - 11, cy - 4 + bob, 4.8, 4.2, [71, 85, 105], 1.1);
      fillEllipse(rgba, width, height, cx + 11, cy - 4 + bob, 4.8, 4.2, [71, 85, 105], 1.1);
      // Round Runic Shield on left arm
      fillEllipse(rgba, width, height, cx - 14, cy + 3 + bob, 7.2, 8.2, [51, 65, 85], 1.1, 0.45);
      fillRing(rgba, width, height, cx - 14, cy + 3 + bob, 7.0, 5.2, [148, 163, 184], 1.2);
      fillEllipse(rgba, width, height, cx - 14, cy + 3 + bob, 2.8, 3.2, [56, 189, 248], 1.35);
      // Runic Broadsword with Crossguard on right arm
      drawLine(rgba, width, height, cx + 14 + lunge, cy + 6 + bob, cx + 20 + lunge, cy - 15 + bob, 2.2, bone, 1.3);
      drawLine(rgba, width, height, cx + 11 + lunge, cy + 2 + bob, cx + 18 + lunge, cy + 4 + bob, 1.6, [251, 191, 36], 1.25);
      // Detailed Skull with Deep Eye Sockets, Nasal Cavity & Jaw Teeth
      fillEllipse(rgba, width, height, cx, cy - 13 + bob, 7.8, 6.8, bone, 1.18, 0.5);
      fillTrapezoid(rgba, width, height, cx, cy - 8 + bob, cy - 4 + bob, 4.5, 3.5, bone, 1.05);
      drawHeroicVisage(rgba, width, height, cx, cy - 13 + bob, [56, 189, 248], 3);
      setPixel(rgba, width, height, cx, cy - 10 + bob, 15, 23, 42);
      break;
    }

    case 'stone_golem': {
      const rock = [120, 113, 108];
      const darkRock = [68, 64, 60];
      const magma = [249, 115, 22];
      // Heavy Pillar Legs
      fillTrapezoid(rgba, width, height, cx - 9, cy + 10 + walk * 0.7, cy + 22 + walk * 0.7, 5.5, 6.5, darkRock, 0.95);
      fillTrapezoid(rgba, width, height, cx + 9, cy + 10 - walk * 0.7, cy + 22 - walk * 0.7, 5.5, 6.5, darkRock, 0.95);
      // Broad Angular Basalt Torso (V-Tapered Monolith)
      fillTrapezoid(rgba, width, height, cx, cy - 9 + bob, cy + 12 + bob, 18, 12, rock, 1.08);
      fillEllipse(rgba, width, height, cx - 17, cy - 5 + bob, 7.5, 6.8, darkRock, 1.12, 0.45);
      fillEllipse(rgba, width, height, cx + 17, cy - 5 + bob, 7.5, 6.8, darkRock, 1.12, 0.45);
      // Glowing Magma Core & Fissures
      fillEllipse(rgba, width, height, cx, cy + bob, 5.0, 5.0, magma, 1.38);
      fillEllipse(rgba, width, height, cx, cy + bob, 2.5, 2.5, [254, 240, 138], 1.4);
      drawLine(rgba, width, height, cx - 10, cy - 6 + bob, cx + 10, cy + 6 + bob, 1.4, magma, 1.3);
      drawLine(rgba, width, height, cx + 10, cy - 6 + bob, cx - 10, cy + 6 + bob, 1.4, magma, 1.3);
      // Angular Craggy Head with Glowing Visor Slit
      fillTrapezoid(rgba, width, height, cx, cy - 18 + bob, cy - 8 + bob, 7.5, 9.5, darkRock, 1.15);
      drawLine(rgba, width, height, cx - 5, cy - 13 + bob, cx + 5, cy - 13 + bob, 1.8, [253, 224, 71], 1.4);
      // Colossal Crusher Fists
      fillTrapezoid(rgba, width, height, cx - 20, cy + 1 + bob - walk, cy + 14 + bob - walk, 5.5, 7.0, rock, 1.12);
      fillTrapezoid(rgba, width, height, cx + 20 + lunge, cy + 1 + bob + walk, cy + 14 + bob + walk, 6.0, 7.5, rock, 1.12);
      break;
    }

    case 'arcane_cultist': {
      const robe = [107, 33, 168];
      const darkRobe = [59, 7, 100];
      const gold = [250, 204, 21];
      // Flared Occult Vestments
      fillTrapezoid(rgba, width, height, cx, cy - 4 + bob, cy + 20 + bob, 9.0, 15.5, darkRobe, 0.95);
      fillTrapezoid(rgba, width, height, cx, cy - 6 + bob, cy + 9 + bob, 12.0, 9.0, robe, 1.1);
      // Golden Rune Stola & Apron
      fillTrapezoid(rgba, width, height, cx, cy - 4 + bob, cy + 19 + bob, 3.0, 4.5, gold, 1.25);
      // Pointed Cultist Cowl & Curved Demon Horns
      fillTriangle(rgba, width, height, cx - 9, cy - 8 + bob, cx + 9, cy - 8 + bob, cx, cy - 26 + bob, robe, 1.18);
      fillTriangle(rgba, width, height, cx - 7, cy - 14 + bob, cx - 4, cy - 16 + bob, cx - 14, cy - 23 + bob, gold, 1.3);
      fillTriangle(rgba, width, height, cx + 4, cy - 16 + bob, cx + 7, cy - 14 + bob, cx + 14, cy - 23 + bob, gold, 1.3);
      // Void-Black Hood Interior with 3 Glowing Eyes
      fillEllipse(rgba, width, height, cx, cy - 12 + bob, 6.2, 5.5, [12, 8, 22], 1.0, 1.0);
      drawHeroicVisage(rgba, width, height, cx, cy - 11 + bob, [244, 63, 94], 3);
      setPixel(rgba, width, height, cx, cy - 14 + bob, 253, 224, 71);
      // Skull-Topped Void Staff & Eldritch Sphere
      drawLine(rgba, width, height, cx + 15, cy - 14 + bob, cx + 15, cy + 17 + bob, 1.7, [217, 119, 6], 1.15);
      fillEllipse(
        rgba,
        width,
        height,
        cx + 15 + lunge * 0.5,
        cy - 16 + bob,
        frameIdx === 3 ? 6.2 : 4.2,
        frameIdx === 3 ? 6.2 : 4.2,
        [192, 132, 252],
        1.4
      );
      break;
    }

    case 'lightning_stalker': {
      // Sleek Articulated Voltaic Wolf-Beast with Haunches, Jaws & Dorsal Spines
      const body = [30, 58, 138];
      const darkBody = [15, 23, 42];
      const volt = [250, 204, 21];
      const cyan = [56, 189, 248];
      const stride = frameIdx === 1 ? 5.5 : frameIdx === 2 ? -5.5 : frameIdx === 3 ? 7 : 0;
      // Hind & Fore Legs with Paws
      drawLine(rgba, width, height, cx - 10, cy + 4 + bob, cx - 15 - stride, cy + 18, 2.6, darkBody, 1.0);
      drawLine(rgba, width, height, cx - 4, cy + 5 + bob, cx - 2 + stride, cy + 18, 2.5, body, 1.05);
      drawLine(rgba, width, height, cx + 6, cy + 5 + bob, cx + 9 - stride, cy + 18, 2.5, body, 1.05);
      drawLine(rgba, width, height, cx + 11, cy + 4 + bob, cx + 17 + stride, cy + 17, 2.6, cyan, 1.25);
      // Muscular Beast Torso & Haunches
      fillEllipse(rgba, width, height, cx - 7, cy + 2 + bob, 8.5, 7.0, body, 1.05, 0.5);
      fillEllipse(rgba, width, height, cx + 4, cy + 1 + bob, 10.5, 7.8, body, 1.12, 0.5);
      // Jagged Yellow Lightning Dorsal Spines
      for (let s = -10; s <= 6; s += 5) {
        fillTriangle(rgba, width, height, cx + s - 3, cy - 5 + bob, cx + s + 3, cy - 5 + bob, cx + s - 1, cy - 16 + bob, volt, 1.38);
      }
      // Crackling Lightning Tail
      fillTriangle(rgba, width, height, cx - 13, cy - 1 + bob, cx - 13, cy + 4 + bob, cx - 26, cy - 9 - bob, volt, 1.35);
      // Fierce Lupine Head, Ears & Glowing Cyan Jaws
      fillEllipse(rgba, width, height, cx + 14 + lunge * 0.4, cy - 4 + bob, 7.5, 6.2, body, 1.15, 0.5);
      fillTriangle(rgba, width, height, cx + 10, cy - 9 + bob, cx + 15, cy - 9 + bob, cx + 11, cy - 17 + bob, cyan, 1.3);
      fillTriangle(rgba, width, height, cx + 17, cy - 7 + bob, cx + 17, cy - 1 + bob, cx + 26 + lunge * 0.5, cy - 4 + bob, body, 1.2);
      setPixel(rgba, width, height, cx + 16, cy - 6 + bob, 254, 240, 138);
      setPixel(rgba, width, height, cx + 17, cy - 6 + bob, 255, 255, 255);
      break;
    }

    case 'shadow_assassin':
    default: {
      const armor = [49, 16, 66];
      const crimson = [239, 68, 68];
      const blade = [226, 232, 240];
      // Agile Shinobi Greaves
      fillTrapezoid(rgba, width, height, cx - 7 + walk, cy + 11, cy + 20, 3.2, 4.0, armor, 1.0);
      fillTrapezoid(rgba, width, height, cx + 7 - walk, cy + 11, cy + 20, 3.2, 4.0, armor, 1.0);
      // Billowing Crimson Shadow Scarf
      fillTriangle(rgba, width, height, cx - 4, cy - 8 + bob, cx - 23, cy - 18 - walk, cx - 18, cy - 4, crimson, 1.2);
      // V-Tapered Shinobi Armor with Crimson X-Harness
      fillTrapezoid(rgba, width, height, cx, cy - 6 + bob, cy + 11 + bob, 11.5, 7.5, armor, 1.1);
      drawLine(rgba, width, height, cx - 8, cy - 4 + bob, cx + 8, cy + 8 + bob, 1.5, crimson, 1.3);
      drawLine(rgba, width, height, cx + 8, cy - 4 + bob, cx - 8, cy + 8 + bob, 1.5, crimson, 1.3);
      // Horned Demon-Oni Head & Glowing Slit Eyes
      fillEllipse(rgba, width, height, cx, cy - 12 + bob, 8.0, 7.2, armor, 1.12, 0.45);
      fillTriangle(rgba, width, height, cx - 7, cy - 15 + bob, cx - 3, cy - 16 + bob, cx - 11, cy - 24 + bob, crimson, 1.35);
      fillTriangle(rgba, width, height, cx + 3, cy - 16 + bob, cx + 7, cy - 15 + bob, cx + 11, cy - 24 + bob, crimson, 1.35);
      drawHeroicVisage(rgba, width, height, cx, cy - 12 + bob, crimson, 3);
      // Twin Reverse-Grip Katar Blades
      fillTriangle(rgba, width, height, cx - 12, cy + bob, cx - 12, cy + 6 + bob, cx - 26 - lunge, cy + 3 + bob, blade, 1.3);
      fillTriangle(rgba, width, height, cx + 12, cy + bob, cx + 12, cy + 6 + bob, cx + 26 + lunge, cy + 3 + bob, crimson, 1.35);
      break;
    }
  }
}

/**
 * Bespoke Pet Creature Renderer (48x48 per frame, 4 frames)
 */
function drawPetFrame(rgba, width, height, ox, oy, fw, fh, frameIdx, pet) {
  const cx = ox + fw / 2;
  const cy = fh / 2 + (frameIdx % 2 === 1 ? -2.5 : 1.5);
  const flap = frameIdx === 1 ? -5 : frameIdx === 2 ? 4 : frameIdx === 3 ? -6 : 0;
  const rgb = hexToRgb(pet.color);

  switch (pet.id) {
    case 'light_fairy': {
      fillEllipse(rgba, width, height, cx - 11, cy - 4 + flap * 0.6, 7.5, 5, [254, 249, 195], 1.25);
      fillEllipse(rgba, width, height, cx + 11, cy - 4 + flap * 0.6, 7.5, 5, [254, 249, 195], 1.25);
      fillEllipse(rgba, width, height, cx - 9, cy + 5 - flap * 0.4, 5.5, 4, [253, 224, 71], 1.15);
      fillEllipse(rgba, width, height, cx + 9, cy + 5 - flap * 0.4, 5.5, 4, [253, 224, 71], 1.15);
      fillTrapezoid(rgba, width, height, cx, cy - 2, cy + 9, 4.0, 6.5, rgb, 1.2);
      fillEllipse(rgba, width, height, cx, cy - 6, 5.2, 5.0, [255, 255, 255], 1.25);
      fillRing(rgba, width, height, cx, cy - 13, 5, 3, [253, 224, 71], 1.35, 0.5);
      drawHeroicVisage(rgba, width, height, cx, cy - 6, [56, 189, 248], 2);
      break;
    }

    case 'crimson_drake': {
      fillTriangle(rgba, width, height, cx - 4, cy, cx - 20, cy - 10 + flap, cx - 15, cy + 6 + flap, [185, 28, 28], 1.15);
      fillTriangle(rgba, width, height, cx + 4, cy, cx + 20, cy - 10 + flap, cx + 15, cy + 6 + flap, [185, 28, 28], 1.15);
      drawLine(rgba, width, height, cx, cy + 6, cx - 12, cy + 15, 2.2, rgb, 1.05);
      fillEllipse(rgba, width, height, cx, cy + 2, 7.5, 7, rgb, 1.12);
      fillEllipse(rgba, width, height, cx, cy - 6, 6.5, 5.5, rgb, 1.2);
      fillTriangle(rgba, width, height, cx - 5, cy - 9, cx - 2, cy - 9, cx - 7, cy - 16, [253, 224, 71], 1.3);
      fillTriangle(rgba, width, height, cx + 2, cy - 9, cx + 5, cy - 9, cx + 7, cy - 16, [253, 224, 71], 1.3);
      drawHeroicVisage(rgba, width, height, cx, cy - 6, [254, 240, 138], 2);
      if (frameIdx === 3) {
        fillEllipse(rgba, width, height, cx + 11, cy - 5, 4.5, 3.5, [253, 224, 71], 1.4);
      }
      break;
    }

    case 'arcane_owl': {
      fillEllipse(rgba, width, height, cx - 12, cy + flap * 0.5, 7, 4.5, [2, 132, 199], 1.15);
      fillEllipse(rgba, width, height, cx + 12, cy + flap * 0.5, 7, 4.5, [2, 132, 199], 1.15);
      fillEllipse(rgba, width, height, cx, cy + 2, 8, 8.5, rgb, 1.1);
      fillEllipse(rgba, width, height, cx, cy + 4, 5, 5.5, [224, 242, 254], 1.2);
      fillTriangle(rgba, width, height, cx - 6, cy - 6, cx - 2, cy - 6, cx - 8, cy - 13, [186, 230, 253], 1.25);
      fillTriangle(rgba, width, height, cx + 2, cy - 6, cx + 6, cy - 6, cx + 8, cy - 13, [186, 230, 253], 1.25);
      fillEllipse(rgba, width, height, cx - 3, cy - 3, 2.8, 2.8, [253, 224, 71], 1.35);
      fillEllipse(rgba, width, height, cx + 3, cy - 3, 2.8, 2.8, [253, 224, 71], 1.35);
      fillTriangle(rgba, width, height, cx - 2, cy - 1, cx + 2, cy - 1, cx, cy + 3, [245, 158, 11], 1.25);
      break;
    }

    case 'stone_golem_pet': {
      fillTrapezoid(rgba, width, height, cx, cy - 6, cy + 9, 9.5, 7.0, [120, 113, 108], 1.1);
      fillEllipse(rgba, width, height, cx - 12, cy + 2 + flap * 0.4, 4.5, 5.5, [87, 83, 78], 1.15);
      fillEllipse(rgba, width, height, cx + 12, cy + 2 - flap * 0.4, 4.5, 5.5, [87, 83, 78], 1.15);
      fillEllipse(rgba, width, height, cx, cy + 1, 3.8, 3.8, [245, 158, 11], 1.4);
      drawHeroicVisage(rgba, width, height, cx, cy - 4, [253, 224, 71], 2);
      break;
    }

    case 'collector_imp': {
      fillEllipse(rgba, width, height, cx - 7, cy + 2, 6, 6.5, [234, 179, 8], 1.25);
      fillTrapezoid(rgba, width, height, cx, cy - 2, cy + 9, 6.0, 5.0, rgb, 1.1);
      fillEllipse(rgba, width, height, cx, cy - 5, 6, 5.5, rgb, 1.18);
      fillTriangle(rgba, width, height, cx - 5, cy - 5, cx - 13, cy - 8, cx - 6, cy - 1, rgb, 1.15);
      fillTriangle(rgba, width, height, cx + 5, cy - 5, cx + 13, cy - 8, cx + 6, cy - 1, rgb, 1.15);
      drawHeroicVisage(rgba, width, height, cx, cy - 5, [239, 68, 68], 2);
      break;
    }

    case 'spirit_wolf':
    default: {
      const stride = frameIdx === 1 ? 4 : frameIdx === 2 ? -4 : 0;
      drawLine(rgba, width, height, cx - 7, cy + 5, cx - 10 - stride, cy + 13, 2, rgb, 1.05);
      drawLine(rgba, width, height, cx + 6, cy + 5, cx + 10 + stride, cy + 13, 2, rgb, 1.05);
      fillEllipse(rgba, width, height, cx - 1, cy + 2, 10.5, 6, rgb, 1.15);
      fillTriangle(rgba, width, height, cx - 9, cy + 1, cx - 9, cy + 5, cx - 19, cy - 4 - flap * 0.5, [110, 231, 183], 1.3);
      fillEllipse(rgba, width, height, cx + 8, cy - 3, 6, 5, rgb, 1.2);
      fillTriangle(rgba, width, height, cx + 5, cy - 6, cx + 9, cy - 6, cx + 7, cy - 14, [167, 243, 208], 1.3);
      fillTriangle(rgba, width, height, cx + 11, cy - 5, cx + 11, cy, cx + 18, cy - 2, rgb, 1.25);
      setPixel(rgba, width, height, cx + 10, cy - 4, 255, 255, 255);
      break;
    }
  }
}

/**
 * Bespoke Boss & Mini-Boss Sheet Renderer (96x96 per frame, 4 frames = 384x96):
 * Every Boss and Mini-Boss has a distinct silhouette, anatomy, headgear, and signature weapon!
 */
function drawBossSheet(key, config) {
  const fw = 96;
  const fh = 96;
  const frames = 4;
  const width = fw * frames;
  const height = fh;
  const rgba = Buffer.alloc(width * height * 4);
  fillChromaMagenta(rgba, width, height);

  const bodyRgb = hexToRgb(config.bodyHex);
  const armorRgb = hexToRgb(config.armorHex);
  const glowRgb = hexToRgb(config.glowHex);

  for (let f = 0; f < frames; f++) {
    const ox = f * fw;
    const cx = ox + fw / 2;
    const bob = f === 1 ? -2.5 : f === 2 ? 2.5 : f === 3 ? -3.5 : 0;
    const wingBeat = f === 1 ? -5 : f === 2 ? 4 : f === 3 ? -7 : 0;
    const step = f === 1 ? -4 : f === 2 ? 4 : 0;
    const castRaise = f === 3 ? -5 : 0;
    const cy = fh / 2 + 2 + bob;

    if (config.style === 'volcano_colossus') {
      // === MINI-BOSS: COLOSSO DE MAGMA (Hulking Basalt & Magma Juggernaut with Giant Molten Fists) ===
      // 1. Twin Erupting Volcanic Chimneys + Magma Plumes
      fillTrapezoid(rgba, width, height, cx - 19, cy - 33, cy - 8, 8, 12, bodyRgb, 1.1);
      fillTrapezoid(rgba, width, height, cx + 19, cy - 33, cy - 8, 8, 12, bodyRgb, 1.1);
      fillEllipse(rgba, width, height, cx - 19, cy - 33, 6.5, 3.5, glowRgb, 1.45);
      fillEllipse(rgba, width, height, cx + 19, cy - 33, 6.5, 3.5, glowRgb, 1.45);
      fillEllipse(rgba, width, height, cx - 19, cy - 38 + wingBeat * 0.4, 3.5, 3.5, [254, 240, 138], 1.4);
      fillEllipse(rgba, width, height, cx + 19, cy - 38 - wingBeat * 0.4, 3.5, 3.5, [254, 240, 138], 1.4);

      // 2. Massive Pillar Stompers
      fillTrapezoid(rgba, width, height, cx - 14, cy + 14 + step, cy + 35 + step, 9, 11, bodyRgb, 0.95);
      fillTrapezoid(rgba, width, height, cx + 14, cy + 14 - step, cy + 35 - step, 9, 11, bodyRgb, 0.95);
      drawLine(rgba, width, height, cx - 18, cy + 28 + step, cx - 10, cy + 28 + step, 2.0, glowRgb, 1.35);
      drawLine(rgba, width, height, cx + 10, cy + 28 - step, cx + 18, cy + 28 - step, 2.0, glowRgb, 1.35);

      // 3. Hulking Cracked Basalt Torso & Furnace Grate Belly
      fillTrapezoid(rgba, width, height, cx, cy - 16, cy + 18, 29, 22, bodyRgb, 1.08);
      fillTrapezoid(rgba, width, height, cx, cy - 14, cy + 12, 25, 18, armorRgb, 1.14);
      // Furnace core & vertical iron grate bars
      fillEllipse(rgba, width, height, cx, cy - 1, 11, 10, glowRgb, 1.4);
      fillEllipse(rgba, width, height, cx, cy - 1, 6.5, 6.0, [254, 240, 138], 1.45);
      for (let gx = -6; gx <= 6; gx += 4) {
        drawLine(rgba, width, height, cx + gx, cy - 10, cx + gx, cy + 8, 1.6, bodyRgb, 0.9);
      }

      // 4. Craggy Magma Boulders for Shoulders & Two Colossal Molten Fists
      fillEllipse(rgba, width, height, cx - 28, cy - 8, 11, 10, bodyRgb, 1.15, 0.4);
      fillEllipse(rgba, width, height, cx + 28, cy - 8, 11, 10, bodyRgb, 1.15, 0.4);
      const leftSlam = f === 3 ? 6 : step;
      const rightSlam = f === 3 ? -8 : -step;
      fillEllipse(rgba, width, height, cx - 32, cy + 10 + leftSlam, 10.5, 11.5, armorRgb, 1.2, 0.45);
      fillEllipse(rgba, width, height, cx + 32, cy + 10 + rightSlam, 10.5, 11.5, armorRgb, 1.2, 0.45);
      // Lava knuckles
      for (let k = -4; k <= 4; k += 4) {
        fillEllipse(rgba, width, height, cx - 32 + k, cy + 16 + leftSlam, 2.5, 2.5, glowRgb, 1.4);
        fillEllipse(rgba, width, height, cx + 32 + k, cy + 16 + rightSlam, 2.5, 2.5, glowRgb, 1.4);
      }

      // 5. Sunk-Into-Shoulders Obsidian Juggernaut Head & 3 Blazing Furnace Eyes
      fillTrapezoid(rgba, width, height, cx, cy - 26, cy - 11, 11, 14, bodyRgb, 1.18);
      drawLine(rgba, width, height, cx - 6, cy - 19, cx + 6, cy - 19, 2.2, [254, 240, 138], 1.45);
      setPixel(rgba, width, height, cx, cy - 22, 254, 240, 138);
      drawLine(rgba, width, height, cx - 8, cy - 14, cx + 8, cy - 14, 1.8, glowRgb, 1.35);
    } else if (config.style === 'plague_vats') {
      // === MINI-BOSS: ALQUIMISTA DA PESTE (Hunched Plague Doctor with Bio-Acid Vats, Crow Beak & Censer Flail) ===
      // 1. Twin Pressurized Bio-Acid Glass Vats on Back + Bubbling Tubes
      fillTrapezoid(rgba, width, height, cx - 21, cy - 30, cy + 2, 7.5, 7.5, [20, 45, 15], 1.1);
      fillTrapezoid(rgba, width, height, cx + 21, cy - 30, cy + 2, 7.5, 7.5, [20, 45, 15], 1.1);
      fillTrapezoid(rgba, width, height, cx - 21, cy - 22 + step * 0.5, cy + 1, 6.0, 6.0, glowRgb, 1.35);
      fillTrapezoid(rgba, width, height, cx + 21, cy - 22 - step * 0.5, cy + 1, 6.0, 6.0, glowRgb, 1.35);
      fillEllipse(rgba, width, height, cx - 21, cy - 30, 7.5, 3.0, [163, 230, 53], 1.3);
      fillEllipse(rgba, width, height, cx + 21, cy - 30, 7.5, 3.0, [163, 230, 53], 1.3);

      // 2. Boots & Tattered Alchemist Trenchcoat
      fillTrapezoid(rgba, width, height, cx - 10, cy + 18 + step, cy + 34 + step, 5.5, 7.5, bodyRgb, 0.95);
      fillTrapezoid(rgba, width, height, cx + 10, cy + 18 - step, cy + 34 - step, 5.5, 7.5, bodyRgb, 0.95);
      fillTrapezoid(rgba, width, height, cx, cy - 12, cy + 24, 18, 26, bodyRgb, 1.05);
      fillTrapezoid(rgba, width, height, cx, cy - 12, cy + 14, 21, 16, armorRgb, 1.15);

      // 3. Diagonal Bandolier of 3 Glowing Elixir Flasks across Chest
      drawLine(rgba, width, height, cx - 16, cy - 11, cx + 16, cy + 9, 3.0, [65, 42, 22], 1.1);
      for (const [fx, fy] of [[-8, -6], [0, -1], [8, 4]]) {
        fillEllipse(rgba, width, height, cx + fx, cy + fy, 3.8, 4.2, glowRgb, 1.4);
        setPixel(rgba, width, height, cx + fx - 1, cy + fy - 1, 236, 252, 203);
      }

      // 4. Left Hand: Giant Acid Syringe Injector; Right Hand: Swinging Spore Censer Flail
      drawLine(rgba, width, height, cx - 28, cy - 4, cx - 38, cy - 18 + castRaise, 3.2, glowRgb, 1.35);
      drawLine(rgba, width, height, cx - 38, cy - 18 + castRaise, cx - 43, cy - 24 + castRaise, 1.4, [255, 255, 255], 1.4);
      // Right hand staff + swinging chain + spiked toxic censer ball
      drawLine(rgba, width, height, cx + 24, cy - 8, cx + 34, cy - 22 + castRaise, 2.5, [120, 90, 50], 1.15);
      drawLine(rgba, width, height, cx + 34, cy - 22 + castRaise, cx + 34, cy + 8 - castRaise, 1.5, [200, 210, 190], 1.2);
      fillEllipse(rgba, width, height, cx + 34, cy + 14 - castRaise, 7.5, 7.5, armorRgb, 1.2);
      fillEllipse(rgba, width, height, cx + 34, cy + 14 - castRaise, 4.5, 4.5, glowRgb, 1.45);

      // 5. Hunched Plague Doctor Hood, Glowing Goggles & Long Curved Crow Beak
      fillEllipse(rgba, width, height, cx, cy - 20, 12, 11, bodyRgb, 1.15, 0.45);
      // Long Crow Beak projecting forward-right
      fillTriangle(rgba, width, height, cx - 2, cy - 22, cx + 4, cy - 14, cx + 20, cy - 16, [215, 225, 205], 1.25);
      // Twin Toxic Goggle Lenses
      fillEllipse(rgba, width, height, cx - 5, cy - 21, 3.5, 3.2, glowRgb, 1.45);
      fillEllipse(rgba, width, height, cx + 4, cy - 21, 3.5, 3.2, glowRgb, 1.45);
      setPixel(rgba, width, height, cx - 5, cy - 21, 255, 255, 255);
      setPixel(rgba, width, height, cx + 4, cy - 21, 255, 255, 255);
    } else if (config.style === 'frost_warden') {
      // === MINI-BOSS: GUARDIÃO DA GEADA (Glacial Citadel Knight with Ice Shield, Halberd & Icicle Crown) ===
      // 1. Radiant Frost Halo + 6 Back-Mounted Glacial Shards
      fillRing(rgba, width, height, cx, cy - 6, 31, 25, glowRgb, 1.25);
      for (const ang of [-135, -110, -70, -45]) {
        const rad = (ang * Math.PI) / 180;
        fillTriangle(
          rgba,
          width,
          height,
          cx + Math.cos(rad) * 18 - 3,
          cy - 6 + Math.sin(rad) * 18,
          cx + Math.cos(rad) * 18 + 3,
          cy - 6 + Math.sin(rad) * 18,
          cx + Math.cos(rad) * 38,
          cy - 6 + Math.sin(rad) * 38 + wingBeat * 0.4,
          [224, 242, 254],
          1.35
        );
      }

      // 2. Greaves & Faceted Glacial Plate Armor
      fillTrapezoid(rgba, width, height, cx - 11, cy + 16 + step, cy + 34 + step, 6.5, 8.5, bodyRgb, 0.95);
      fillTrapezoid(rgba, width, height, cx + 11, cy + 16 - step, cy + 34 - step, 6.5, 8.5, bodyRgb, 0.95);
      fillTrapezoid(rgba, width, height, cx, cy + 4, cy + 22, 16, 22, bodyRgb, 1.0);
      fillTrapezoid(rgba, width, height, cx, cy - 14, cy + 6, 24, 15, armorRgb, 1.18);
      // Diamond Frost Core
      fillTriangle(rgba, width, height, cx - 7, cy - 3, cx + 7, cy - 3, cx, cy - 12, glowRgb, 1.4);
      fillTriangle(rgba, width, height, cx - 7, cy - 3, cx + 7, cy - 3, cx, cy + 6, [224, 242, 254], 1.4);

      // 3. Left Hand: Tower Glacial Bulwark Shield
      fillTrapezoid(rgba, width, height, cx - 29, cy - 12, cy + 16, 9, 6, armorRgb, 1.25);
      fillTrapezoid(rgba, width, height, cx - 29, cy - 9, cy + 12, 6, 3.5, glowRgb, 1.4);

      // 4. Right Hand: Tall Frost Halberd with Crescent Axe Blade
      drawLine(rgba, width, height, cx + 31, cy - 28 + castRaise, cx + 31, cy + 28, 2.6, [224, 242, 254], 1.3);
      fillTriangle(rgba, width, height, cx + 31, cy - 24 + castRaise, cx + 43, cy - 14 + castRaise, cx + 31, cy - 6 + castRaise, glowRgb, 1.4);
      fillTriangle(rgba, width, height, cx + 28, cy - 26 + castRaise, cx + 34, cy - 26 + castRaise, cx + 31, cy - 39 + castRaise, [255, 255, 255], 1.45);

      // 5. Greathelm with 5-Spire Icicle Crown & Cyan Visor Slit
      fillEllipse(rgba, width, height, cx, cy - 21, 11.5, 10.5, bodyRgb, 1.15, 0.45);
      for (const ix of [-8, -4, 0, 4, 8]) {
        const ih = ix === 0 ? 19 : Math.abs(ix) === 4 ? 15 : 11;
        fillTriangle(rgba, width, height, cx + ix - 2.5, cy - 26, cx + ix + 2.5, cy - 26, cx + ix, cy - 26 - ih, [224, 242, 254], 1.4);
      }
      drawLine(rgba, width, height, cx - 7, cy - 21, cx + 7, cy - 21, 2.2, glowRgb, 1.45);
    } else if (config.style === 'eclipse_void') {
      // === BOSS: VORATH, DEVORADOR DO ECLIPSE (Floating Eldritch Void Sovereign with 5 Eyes & Void Scythe) ===
      // 1. Giant Dark-Sun Eclipse Halo + 6 Writhing Void Tentacles (No Walk Boots — Floating Void Robes!)
      fillRing(rgba, width, height, cx, cy - 10, 35, 27, glowRgb, 1.3);
      fillRing(rgba, width, height, cx, cy - 10, 27, 21, [10, 6, 20], 1.0);
      for (let w = -1; w <= 1; w += 2) {
        fillTriangle(rgba, width, height, cx + w * 10, cy - 8, cx + w * 44, cy - 28 + wingBeat, cx + w * 38, cy + 8 + wingBeat, armorRgb, 1.18);
        drawLine(rgba, width, height, cx + w * 12, cy + 8, cx + w * 34, cy + 28 - wingBeat, 3.0, glowRgb, 1.3);
        drawLine(rgba, width, height, cx + w * 8, cy + 14, cx + w * 22, cy + 36 + wingBeat * 0.5, 2.5, armorRgb, 1.25);
      }

      // 2. Floating Tapered Astral Mantle & Singularity Vortex Core
      fillTrapezoid(rgba, width, height, cx, cy + 2, cy + 34, 20, 7, bodyRgb, 1.05);
      fillTrapezoid(rgba, width, height, cx, cy - 15, cy + 8, 25, 16, armorRgb, 1.16);
      fillRing(rgba, width, height, cx, cy - 3, 10.5, 5.5, glowRgb, 1.42);
      fillEllipse(rgba, width, height, cx, cy - 3, 5.5, 5.5, [8, 4, 16], 1.0);

      // 3. Left Hand: Floating Singularity Eye-Orb; Right Hand: Crescent Void Reaper Scythe
      fillRing(rgba, width, height, cx - 31, cy - 4 - wingBeat * 0.4, 7.5, 4.0, glowRgb, 1.4);
      fillEllipse(rgba, width, height, cx - 31, cy - 4 - wingBeat * 0.4, 3.5, 3.5, [255, 255, 255], 1.4);
      drawLine(rgba, width, height, cx + 28, cy - 30 + castRaise, cx + 32, cy + 28, 2.5, glowRgb, 1.3);
      // Curved Reaper Scythe Blade sweeping left from top of pole
      fillTriangle(rgba, width, height, cx + 30, cy - 32 + castRaise, cx + 28, cy - 22 + castRaise, cx + 4, cy - 27 + castRaise, [243, 232, 255], 1.42);

      // 4. Eldritch Crown & 5 Glowing Eyes of the Abyss
      fillEllipse(rgba, width, height, cx, cy - 22, 12, 11, bodyRgb, 1.15, 0.45);
      fillTriangle(rgba, width, height, cx - 9, cy - 28, cx + 9, cy - 28, cx, cy - 42, glowRgb, 1.38);
      for (const [ex, ey] of [[-6, -21], [-3, -23], [0, -25], [3, -23], [6, -21]]) {
        setPixel(rgba, width, height, cx + ex, cy + ey, 255, 255, 255);
        setPixel(rgba, width, height, cx + ex, cy + ey + 1, 216, 180, 254);
      }
    } else if (config.style === 'kryos') {
      // === BOSS: KRYOS, O SOBERANO DE CRISTAL (Prismatic Crystal Dragon-Monarch with Diamond Greatsword) ===
      // 1. Multi-Faceted Prismatic Crystal Dragon Wings & Draconic Tail
      for (let w = -1; w <= 1; w += 2) {
        fillTriangle(rgba, width, height, cx + w * 10, cy - 10, cx + w * 44, cy - 32 + wingBeat, cx + w * 38, cy - 4 + wingBeat, [186, 230, 253], 1.35);
        fillTriangle(rgba, width, height, cx + w * 10, cy - 6, cx + w * 40, cy - 2 + wingBeat, cx + w * 30, cy + 18 + wingBeat, armorRgb, 1.22);
        drawLine(rgba, width, height, cx + w * 10, cy - 10, cx + w * 43, cy - 30 + wingBeat, 2.4, [255, 255, 255], 1.45);
      }
      // Articulated Crystal Dragon Tail sweeping to the left
      drawLine(rgba, width, height, cx, cy + 16, cx - 26, cy + 32 - step, 4.5, armorRgb, 1.2);
      fillTriangle(rgba, width, height, cx - 24, cy + 29 - step, cx - 28, cy + 35 - step, cx - 36, cy + 33 - step, [224, 242, 254], 1.4);

      // 2. Dragon-Claw Greaves & Sovereign Diamond-Scale Armor
      fillTrapezoid(rgba, width, height, cx - 12, cy + 16 + step, cy + 34 + step, 6.5, 9.0, bodyRgb, 0.98);
      fillTrapezoid(rgba, width, height, cx + 12, cy + 16 - step, cy + 34 - step, 6.5, 9.0, bodyRgb, 0.98);
      fillTrapezoid(rgba, width, height, cx, cy + 4, cy + 21, 16, 22, bodyRgb, 1.05);
      fillTrapezoid(rgba, width, height, cx, cy - 15, cy + 6, 25, 16, armorRgb, 1.2);
      // Crystalline Star-Burst Core
      fillTriangle(rgba, width, height, cx - 8, cy - 3, cx + 8, cy - 3, cx, cy - 13, [255, 255, 255], 1.45);
      fillTriangle(rgba, width, height, cx - 8, cy - 3, cx + 8, cy - 3, cx, cy + 7, glowRgb, 1.4);

      // 3. Spiked Crystal Pauldrons & Sovereign Diamond Greatsword
      fillTriangle(rgba, width, height, cx - 18, cy - 10, cx - 30, cy - 6, cx - 38, cy - 24, [224, 242, 254], 1.4);
      fillTriangle(rgba, width, height, cx + 18, cy - 10, cx + 30, cy - 6, cx + 38, cy - 24, [224, 242, 254], 1.4);
      // Wide Faceted Diamond Greatsword in Right Hand
      fillTrapezoid(rgba, width, height, cx + 32, cy - 36 + castRaise, cy + 10 + castRaise, 2.0, 5.5, [224, 242, 254], 1.45);
      drawLine(rgba, width, height, cx + 24, cy + 10 + castRaise, cx + 40, cy + 10 + castRaise, 2.5, [250, 204, 21], 1.35);
      drawLine(rgba, width, height, cx + 32, cy + 10 + castRaise, cx + 32, cy + 22 + castRaise, 2.5, bodyRgb, 1.1);

      // 4. Dragon-Monarch Swept-Back Crystal Horns & Sovereign Crown
      fillTriangle(rgba, width, height, cx - 12, cy - 23, cx - 4, cy - 25, cx - 24, cy - 41, [224, 242, 254], 1.42);
      fillTriangle(rgba, width, height, cx + 4, cy - 25, cx + 12, cy - 23, cx + 24, cy - 41, [224, 242, 254], 1.42);
      fillTriangle(rgba, width, height, cx - 5, cy - 28, cx + 5, cy - 28, cx, cy - 42, [250, 204, 21], 1.4);
      fillEllipse(rgba, width, height, cx, cy - 21, 11.5, 10.5, armorRgb, 1.2, 0.45);
      drawHeroicVisage(rgba, width, height, cx, cy - 21, [255, 255, 255], 4);
    } else {
      // === BOSS: MALAKOR, SENHOR DAS CINZAS & ARCHON BASE (Winged Archdemon Warlord with Hellfire Bident) ===
      // 1. Bat/Demon Wings with Blazing Magma Rib-Struts
      fillTriangle(rgba, width, height, cx - 10, cy - 8, cx - 44, cy - 30 + wingBeat, cx - 35, cy + 14 + wingBeat, armorRgb, 1.12);
      fillTriangle(rgba, width, height, cx + 10, cy - 8, cx + 44, cy - 30 + wingBeat, cx + 35, cy + 14 + wingBeat, armorRgb, 1.12);
      drawLine(rgba, width, height, cx - 12, cy - 8, cx - 43, cy - 28 + wingBeat, 2.4, glowRgb, 1.35);
      drawLine(rgba, width, height, cx + 12, cy - 8, cx + 43, cy - 28 + wingBeat, 2.4, glowRgb, 1.35);
      drawLine(rgba, width, height, cx - 12, cy - 6, cx - 36, cy + 4 + wingBeat, 1.8, glowRgb, 1.25);
      drawLine(rgba, width, height, cx + 12, cy - 6, cx + 36, cy + 4 + wingBeat, 1.8, glowRgb, 1.25);

      // 2. Cloven Demon-Plate Greaves & Tassets
      fillTrapezoid(rgba, width, height, cx - 12, cy + 16 + step, cy + 34 + step, 6.5, 8.5, bodyRgb, 0.95);
      fillTrapezoid(rgba, width, height, cx + 12, cy + 16 - step, cy + 34 - step, 6.5, 8.5, bodyRgb, 0.95);
      fillTrapezoid(rgba, width, height, cx, cy + 4, cy + 21, 16, 23, bodyRgb, 1.0);
      fillTrapezoid(rgba, width, height, cx, cy + 4, cy + 22, 6.5, 9.5, glowRgb, 1.22);
      fillTrapezoid(rgba, width, height, cx, cy - 14, cy + 6, 25, 15, armorRgb, 1.16);

      // 3. Spiked Warlord Pauldrons & Blazing Hellfire Rib Core
      fillEllipse(rgba, width, height, cx - 24, cy - 7, 10, 8.5, glowRgb, 1.18, 0.45);
      fillEllipse(rgba, width, height, cx + 24, cy - 7, 10, 8.5, glowRgb, 1.18, 0.45);
      fillTriangle(rgba, width, height, cx - 28, cy - 12, cx - 20, cy - 12, cx - 36, cy - 26, glowRgb, 1.38);
      fillTriangle(rgba, width, height, cx + 20, cy - 12, cx + 28, cy - 12, cx + 36, cy - 26, glowRgb, 1.38);
      fillEllipse(rgba, width, height, cx, cy - 3, 8.5, 8.5, glowRgb, 1.4);
      fillEllipse(rgba, width, height, cx, cy - 3, 4.2, 4.2, [254, 240, 138], 1.45);

      // 4. Right Hand: Twin-Pronged Hellfire Bident Spear
      drawLine(rgba, width, height, cx + 31, cy - 18 + castRaise, cx + 31, cy + 28, 2.8, glowRgb, 1.3);
      drawLine(rgba, width, height, cx + 24, cy - 18 + castRaise, cx + 38, cy - 18 + castRaise, 2.2, [254, 240, 138], 1.35);
      fillTriangle(rgba, width, height, cx + 24, cy - 18 + castRaise, cx + 29, cy - 18 + castRaise, cx + 26, cy - 38 + castRaise, [254, 240, 138], 1.45);
      fillTriangle(rgba, width, height, cx + 33, cy - 18 + castRaise, cx + 38, cy - 18 + castRaise, cx + 36, cy - 38 + castRaise, [254, 240, 138], 1.45);

      // 5. Sweeping Archdemon Horns & 4 Blazing Cinder Eyes
      fillTriangle(rgba, width, height, cx - 12, cy - 23, cx - 4, cy - 24, cx - 23, cy - 41, glowRgb, 1.4);
      fillTriangle(rgba, width, height, cx + 4, cy - 24, cx + 12, cy - 23, cx + 23, cy - 41, glowRgb, 1.4);
      fillEllipse(rgba, width, height, cx, cy - 21, 11.5, 10.5, bodyRgb, 1.15, 0.45);
      drawHeroicVisage(rgba, width, height, cx, cy - 21, [254, 240, 138], 4);
      setPixel(rgba, width, height, cx - 5, cy - 24, 255, 87, 34);
      setPixel(rgba, width, height, cx + 5, cy - 24, 255, 87, 34);
    }
  }

  applyChromaKeyAndOutline(rgba, width, height, [12, 8, 18]);
  saveSpriteAsset(key, width, height, fw, fh, frames, rgba);
}

function saveSpriteAsset(key, width, height, frameWidth, frameHeight, frames, rgba, hitbox) {
  const pngBuffer = encodeRGBAtoPNG(width, height, rgba);
  writeSpriteFile(`${key}.png`, pngBuffer);

  const meta = {
    key,
    file: `${key}.png`,
    width,
    height,
    frameWidth,
    frameHeight,
    frames,
    animations:
      frames >= 4
        ? {
            idle: { frames: [0], frameRate: 4, repeat: -1 },
            walk: { frames: [1, 2], frameRate: 8, repeat: -1 },
            cast: { frames: [3], frameRate: 8, repeat: 0 }
          }
        : undefined,
    hitbox:
      hitbox || {
        width: Math.round(frameWidth * 0.55),
        height: Math.round(frameHeight * 0.65),
        offsetX: Math.round(frameWidth * 0.225),
        offsetY: Math.round(frameHeight * 0.2)
      }
  };
  const jsonBuffer = Buffer.from(JSON.stringify(meta, null, 2), 'utf-8');
  writeSpriteFile(`${key}.json`, jsonBuffer);
}

console.log('=== [nano-banana-sprite-forge] Generating & Chroma-Keying Bespoke HD 4-Frame Sprite Sheets ===');

// 1. All 10 Elemental Mages (256x64, 4 frames of 64x64)
for (const char of CHARACTERS_DATA) {
  const fw = 64;
  const fh = 64;
  const frames = 4;
  const width = fw * frames;
  const height = fh;
  const rgba = Buffer.alloc(width * height * 4);
  fillChromaMagenta(rgba, width, height);

  for (let f = 0; f < frames; f++) {
    drawCharacterFrame(rgba, width, height, f * fw, 0, fw, fh, f, char);
  }

  applyChromaKeyAndOutline(rgba, width, height, [16, 12, 26]);
  saveSpriteAsset(char.spriteKey, width, height, fw, fh, frames, rgba);
}

// 2. Petrus Independent Articulated Rock Arm (32x32)
{
  const w = 32;
  const h = 32;
  const rgba = Buffer.alloc(w * h * 4);
  fillChromaMagenta(rgba, w, h);
  // Basalt rock forearm with faceted geometry
  fillTrapezoid(rgba, w, h, 13, 8, 23, 10, 12, [120, 113, 108], 1.12);
  fillEllipse(rgba, w, h, 21, 16, 7.5, 7.0, [87, 83, 78], 1.18, 0.45);
  // Gold knuckle plate
  drawLine(rgba, w, h, 18, 10, 18, 22, 2.0, [251, 191, 36], 1.35);
  // Articulated stone fingers / knuckles
  fillEllipse(rgba, w, h, 26, 11, 3.2, 2.4, [168, 162, 158], 1.25);
  fillEllipse(rgba, w, h, 28, 16, 3.5, 2.6, [168, 162, 158], 1.25);
  fillEllipse(rgba, w, h, 26, 21, 3.2, 2.4, [168, 162, 158], 1.25);
  // Glowing molten magma vein pulsing down the forearm to knuckles
  drawLine(rgba, w, h, 6, 16, 23, 16, 2.0, [245, 158, 11], 1.4);
  fillEllipse(rgba, w, h, 20, 16, 2.4, 2.4, [254, 240, 138], 1.45);
  // Branching magma fissure cracks
  drawLine(rgba, w, h, 12, 16, 16, 12, 1.4, [251, 191, 36], 1.35);
  drawLine(rgba, w, h, 12, 16, 16, 20, 1.4, [251, 191, 36], 1.35);
  applyChromaKeyAndOutline(rgba, w, h, [24, 18, 12]);
  saveSpriteAsset('petrus_rock_arm', w, h, w, h, 1, rgba, { width: 22, height: 16, offsetX: 5, offsetY: 8 });
}

// 3. All 6 Pets (192x48, 4 frames of 48x48)
for (const pet of PETS_DATA) {
  const fw = 48;
  const fh = 48;
  const frames = 4;
  const width = fw * frames;
  const height = fh;
  const rgba = Buffer.alloc(width * height * 4);
  fillChromaMagenta(rgba, width, height);

  for (let f = 0; f < frames; f++) {
    drawPetFrame(rgba, width, height, f * fw, 0, fw, fh, f, pet);
  }
  applyChromaKeyAndOutline(rgba, width, height, [15, 15, 25]);
  saveSpriteAsset(pet.spriteKey, width, height, fw, fh, frames, rgba);
}

// 4. All 6 Regular Enemy Mobs (256x64, 4 frames of 64x64)
for (const enemy of ENEMY_TYPES) {
  const fw = 64;
  const fh = 64;
  const frames = 4;
  const width = fw * frames;
  const height = fh;
  const rgba = Buffer.alloc(width * height * 4);
  fillChromaMagenta(rgba, width, height);

  for (let f = 0; f < frames; f++) {
    drawEnemyMobFrame(rgba, width, height, f * fw, 0, fw, fh, f, enemy);
  }
  applyChromaKeyAndOutline(rgba, width, height, [20, 10, 16]);
  saveSpriteAsset(enemy.spriteKey, width, height, fw, fh, frames, rgba);
}

// 5. Base Boss Archon + Distinct Mini-Boss & Main Boss Sheets (384x96, 4 frames of 96x96)
drawBossSheet('boss_archon', {
  bodyHex: 0x2d2638,
  armorHex: 0x4c1d95,
  glowHex: 0xf97316,
  hasWings: true,
  style: 'archon'
});

drawBossSheet('boss_frost_warden', {
  bodyHex: 0x0f172a,
  armorHex: 0x0284c7,
  glowHex: 0x38bdf8,
  hasWings: false,
  style: 'frost_warden'
});

drawBossSheet('boss_magma_colossus', {
  bodyHex: 0x292524,
  armorHex: 0x7c2d12,
  glowHex: 0xf97316,
  hasWings: false,
  style: 'volcano_colossus'
});

drawBossSheet('boss_plague_alchemist', {
  bodyHex: 0x1a2e05,
  armorHex: 0x365314,
  glowHex: 0x84cc16,
  hasWings: false,
  style: 'plague_vats'
});

drawBossSheet('boss_malakor', {
  bodyHex: 0x1c1917,
  armorHex: 0x7f1d1d,
  glowHex: 0xff5722,
  hasWings: true,
  style: 'malakor'
});

drawBossSheet('boss_vorath', {
  bodyHex: 0x1e1b4b,
  armorHex: 0x581c87,
  glowHex: 0xa855f7,
  hasWings: true,
  style: 'eclipse_void'
});

drawBossSheet('boss_kryos', {
  bodyHex: 0x0c4a6e,
  armorHex: 0x0369a1,
  glowHex: 0x38bdf8,
  hasWings: true,
  style: 'kryos'
});

// 6. Interactive Ornate Treasure Chest, Arcane Pet Cage, and Staggered Obsidian Flagstone Floor Tile
{
  const w = 48;
  const h = 48;
  const rgba = Buffer.alloc(w * h * 4);
  fillChromaMagenta(rgba, w, h);
  fillTrapezoid(rgba, w, h, 24, 18, 37, 16, 15, [120, 53, 15], 1.05);
  fillEllipse(rgba, w, h, 24, 18, 16.5, 7.5, [180, 83, 9], 1.18, 0.5);
  drawLine(rgba, w, h, 14, 12, 14, 36, 2.2, [251, 191, 36], 1.25);
  drawLine(rgba, w, h, 34, 12, 34, 36, 2.2, [251, 191, 36], 1.25);
  drawLine(rgba, w, h, 8, 22, 40, 22, 2.0, [251, 191, 36], 1.3);
  fillEllipse(rgba, w, h, 24, 23, 4.5, 5.5, [254, 240, 138], 1.4);
  setPixel(rgba, w, h, 24, 23, 30, 20, 10);
  applyChromaKeyAndOutline(rgba, w, h, [25, 16, 8]);
  saveSpriteAsset('treasure_chest', w, h, w, h, 1, rgba);
}

{
  const w = 48;
  const h = 48;
  const rgba = Buffer.alloc(w * h * 4);
  fillChromaMagenta(rgba, w, h);
  fillRing(rgba, w, h, 24, 24, 18, 14.5, [16, 185, 129], 1.2);
  for (let bx = 14; bx <= 34; bx += 5) {
    drawLine(rgba, w, h, bx, 10, bx, 38, 1.5, [110, 231, 183], 1.25);
  }
  drawLine(rgba, w, h, 9, 24, 39, 24, 1.8, [52, 211, 153], 1.3);
  applyChromaKeyAndOutline(rgba, w, h, [10, 30, 20]);
  saveSpriteAsset('pet_cage', w, h, w, h, 1, rgba);
}

{
  const w = 128;
  const h = 128;
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / 64);
    const staggerX = row % 2 === 1 ? 32 : 0;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const sx = (x + staggerX) % 64;
      const sy = y % 64;
      const mortarX = sx <= 1 || sx >= 63;
      const mortarY = sy <= 1 || sy >= 63;
      const bevelLight = (sx >= 2 && sx <= 4 && !mortarY) || (sy >= 2 && sy <= 4 && !mortarX);
      const bevelDark = (sx >= 60 && sx <= 62 && !mortarY) || (sy >= 60 && sy <= 62 && !mortarX);
      let shade = 0;
      if (mortarX || mortarY) shade = -14;
      else if (bevelLight) shade = 9;
      else if (bevelDark) shade = -8;

      const tileVariant = (((Math.floor((x + staggerX) / 64) + row * 3) % 4) - 1.5) * 3;
      const grain = ((((x * 37 + y * 67) ^ (x * 19)) & 15) - 7) * 0.55;
      const base = 22 + tileVariant + shade + grain;
      // Dark slate / arcane obsidian palette: [R: 16-38, G: 18-42, B: 30-65]
      rgba[idx] = clampByte(Math.max(12, Math.min(42, base)));
      rgba[idx + 1] = clampByte(Math.max(14, Math.min(46, base + 3)));
      rgba[idx + 2] = clampByte(Math.max(24, Math.min(68, base + 14)));
      rgba[idx + 3] = 255;
    }
  }
  // Inlaid glowing arcane runes at slab corners and centers
  const runePoints = [
    [32, 32], [96, 96], [32, 96], [96, 32]
  ];
  for (const [cx, cy] of runePoints) {
    fillRing(rgba, w, h, cx, cy, 7, 5.5, [139, 92, 246], 1.25);
    setPixel(rgba, w, h, cx, cy, 192, 132, 252, 255);
    setPixel(rgba, w, h, cx - 2, cy, 147, 51, 234, 255);
    setPixel(rgba, w, h, cx + 2, cy, 147, 51, 234, 255);
    setPixel(rgba, w, h, cx, cy - 2, 147, 51, 234, 255);
    setPixel(rgba, w, h, cx, cy + 2, 147, 51, 234, 255);
  }
  saveSpriteAsset('arcane_floor', w, h, w, h, 1, rgba);
}

console.log(`✔ Generated and chroma-keyed all bespoke HD sprite sheets & metadata into ${OUT_DIR}`);

