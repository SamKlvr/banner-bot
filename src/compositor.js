import sharp from "sharp";
import { config } from "./config.js";

sharp.concurrency(Math.max(1, config.sharpConcurrency));
sharp.cache({
  memory: Math.max(16, config.sharpCacheMemoryMb),
  files: 0,
  items: 50
});

export async function composeBanner({ imageBuffer, header, styleProfile, concept = null }) {
  const width = header.target_width;
  const height = header.target_height;
  const normalizedTitle = normalizeHeadlineText(header.text);
  const layoutProfile = getLayoutProfile(header, concept, normalizedTitle);
  const theme = styleProfile.theme || {};
  const payload = {
    width,
    height,
    bannerKind: header.banner_kind,
    title: normalizedTitle,
    brandName: theme.brandName || styleProfile.brand_name || "",
    primaryColor: normalizeColor(theme.primaryColor || styleProfile.primary_color, "#1d6cff"),
    secondaryColor: normalizeColor(theme.secondaryColor || styleProfile.secondary_color, "#0a165e"),
    accentColor: normalizeColor(theme.accentColor || styleProfile.accent_color, "#5eddff"),
    glowColor: normalizeColor(theme.glowColor, deriveGlowColor(theme.accentColor || styleProfile.accent_color)),
    lightColor: normalizeColor(theme.lightColor, deriveLightColor(theme.accentColor || styleProfile.accent_color)),
    frameColor: normalizeColor(theme.frameColor, lightenColor(theme.accentColor || styleProfile.accent_color || "#5eddff", 0.28)),
    plateFill: normalizeColor(theme.plateFill, normalizeColor(theme.primaryColor || styleProfile.primary_color, "#1d6cff")),
    plateFillAlt: normalizeColor(theme.plateFillAlt, normalizeColor(theme.secondaryColor || styleProfile.secondary_color, "#0a165e")),
    plateStroke: normalizeColor(theme.plateStroke, lightenColor(normalizeColor(theme.primaryColor || styleProfile.primary_color, "#1d6cff"), 0.20)),
    plateInnerStroke: normalizeColor(theme.plateInnerStroke, lightenColor(normalizeColor(theme.accentColor || styleProfile.accent_color, "#5eddff"), 0.10)),
    textColor: normalizeColor(theme.textColor, "#ffffff")
  };

  const cornerRadius = Math.round(Math.min(width, height) * 0.08);
  const textPlateHeight = Math.round(height * layoutProfile.plateHeightRatio);
  const outerGlowHeight = Math.round(height * layoutProfile.glowHeightRatio);
  const textLayout = calculateTextLayout(width, height, textPlateHeight, payload, layoutProfile);

  const baseLayer = await sharp(imageBuffer)
    .resize(width, height, {
      fit: "cover",
      position: sharp.strategy.attention
    })
    .gamma(1.04)
    .modulate({
      saturation: 1.52,
      brightness: 1.16
    })
    .linear(1.03, -3)
    .sharpen(1.4)
    .composite([
      { input: Buffer.from(buildTopGlowSvg(width, height, payload, outerGlowHeight)) },
      { input: Buffer.from(buildBottomFadeSvg(width, height)) },
    ])
    .png()
    .toBuffer();

  const clippedBase = await applyRoundedMask(baseLayer, width, height, cornerRadius);

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: clippedBase },
      { input: Buffer.from(buildTextPlateSvg(width, height, textPlateHeight, cornerRadius, payload)) },
      { input: Buffer.from(buildTextSvg(width, height, textPlateHeight, payload, textLayout)) }
    ])
    .png()
    .toBuffer();
}

async function applyRoundedMask(buffer, width, height, radius) {
  const roundedMask = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#ffffff"/>
    </svg>
  `);

  return sharp(buffer)
    .ensureAlpha()
    .composite([{ input: roundedMask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

function buildTopGlowSvg(width, height, payload, outerGlowHeight) {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="topGlow" cx="50%" cy="28%" r="62%">
          <stop offset="0%" stop-color="${escapeXml(lightenColor(payload.lightColor, 0.16))}" stop-opacity="0.28" />
          <stop offset="38%" stop-color="${escapeXml(payload.lightColor)}" stop-opacity="0.14" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${outerGlowHeight}" fill="url(#topGlow)" />
    </svg>
  `;
}

function buildBottomFadeSvg(width, height) {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#050505" stop-opacity="0" />
          <stop offset="100%" stop-color="#050505" stop-opacity="0.36" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#fade)" />
    </svg>
  `;
}

function buildTextPlateSvg(width, height, plateHeight, radius, payload) {
  const padding = Math.round(width * 0.05);
  const y = height - plateHeight - padding;
  const plateWidth = width - padding * 2;
  const plateRadius = Math.round(radius * 0.7);
  const innerStroke = hexToRgba(payload.plateInnerStroke, 0.14);
  const outerStroke = hexToRgba(payload.plateStroke, 0.12);
  const highlight = hexToRgba(payload.lightColor, 0.10);

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="plateGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${escapeXml(lightenColor(payload.plateFill, 0.16))}" />
          <stop offset="42%" stop-color="${escapeXml(payload.plateFill)}" />
          <stop offset="100%" stop-color="${escapeXml(darkenColor(payload.plateFillAlt, 0.04))}" />
        </linearGradient>
        <linearGradient id="plateHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${highlight}" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000000" flood-opacity="0.12" />
        </filter>
      </defs>
      <rect x="${padding}" y="${y}" width="${plateWidth}" height="${plateHeight}" rx="${plateRadius}" ry="${plateRadius}" fill="url(#plateGradient)" stroke="${outerStroke}" stroke-width="1.1" filter="url(#shadow)" />
      <rect x="${padding + 2}" y="${y + 2}" width="${plateWidth - 4}" height="${Math.round(plateHeight * 0.35)}" rx="${Math.max(plateRadius - 3, 1)}" ry="${Math.max(plateRadius - 3, 1)}" fill="url(#plateHighlight)" />
      <rect x="${padding + 3}" y="${y + 3}" width="${plateWidth - 6}" height="${plateHeight - 6}" rx="${Math.max(plateRadius - 4, 1)}" ry="${Math.max(plateRadius - 4, 1)}" fill="none" stroke="${innerStroke}" stroke-width="0.7" />
    </svg>
  `;
}

function buildTextSvg(width, height, plateHeight, payload, layout) {
  const { lines, fontSize, lineHeight, textBoxX, textBoxY, textBoxWidth, textBoxHeight } = layout;
  const totalTextHeight = lineHeight * lines.length;
  const textY = textBoxY + Math.round((textBoxHeight - totalTextHeight) / 2) + fontSize - 3;
  const centerX = Math.round(width / 2);
  const shadowColor = hexToRgba("#03112f", 0.8);
  const title = lines.map((line, index) => {
    const y = textY + index * lineHeight;
    return `<tspan x="${centerX}" y="${y}">${escapeXml(line)}</tspan>`;
  }).join("");

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="textClip">
          <rect x="${textBoxX}" y="${textBoxY}" width="${textBoxWidth}" height="${textBoxHeight}" rx="${Math.round(fontSize * 0.5)}" ry="${Math.round(fontSize * 0.5)}" />
        </clipPath>
      </defs>
      <style>
        .title {
          font-family: "Arial Black", "Segoe UI", Arial, sans-serif;
          font-size: ${fontSize}px;
          font-weight: 900;
          fill: ${payload.textColor};
          text-anchor: middle;
          letter-spacing: ${layout.letterSpacing}px;
        }
      </style>
      <g clip-path="url(#textClip)">
        <text class="title" x="${centerX}" y="${textY}" filter="drop-shadow(0 2px 3px ${shadowColor})">${title}</text>
      </g>
    </svg>
  `;
}

function calculateTextLayout(width, height, plateHeight, payload, profile) {
  const platePadding = Math.round(width * profile.platePaddingRatio);
  const plateY = height - plateHeight - platePadding;
  const textBoxX = platePadding + Math.round(width * profile.textInsetRatio);
  const textBoxWidth = width - textBoxX * 2;
  const textBoxY = plateY + Math.round(plateHeight * profile.textBoxTopRatio);
  const textBoxHeight = Math.round(plateHeight * profile.textBoxHeightRatio);
  const minFontSize = profile.minFontSize;
  const startFontSize = profile.startFontSize;
  const maxLines = profile.maxLines;

  for (let fontSize = startFontSize; fontSize >= minFontSize; fontSize -= 2) {
    const lineHeight = Math.round(fontSize * 1.08);
    const lines = wrapTextToWidth(payload.title, textBoxWidth, fontSize, maxLines);
    const totalTextHeight = lines.length * lineHeight;
    const widestLine = Math.max(...lines.map((line) => estimateLineWidth(line, fontSize)), 0);

    if (lines.length <= maxLines && totalTextHeight <= textBoxHeight && widestLine <= textBoxWidth * 0.92) {
      return { lines, fontSize, lineHeight, textBoxX, textBoxY, textBoxWidth, textBoxHeight };
    }
  }

  const fallbackFontSize = Math.max(10, minFontSize - 2);
  for (let fontSize = fallbackFontSize; fontSize >= 10; fontSize -= 1) {
    const lineHeight = Math.round(fontSize * 1.02);
    const lines = wrapTextToWidth(payload.title, textBoxWidth, fontSize, maxLines, false);
    const totalTextHeight = lines.length * lineHeight;
    const widestLine = Math.max(...lines.map((line) => estimateLineWidth(line, fontSize)), 0);

    if (lines.length <= maxLines && totalTextHeight <= textBoxHeight && widestLine <= textBoxWidth * 0.9) {
      return { lines, fontSize, lineHeight, textBoxX, textBoxY, textBoxWidth, textBoxHeight };
    }
  }

  return {
    lines: wrapTextToWidth(payload.title, textBoxWidth, 10, maxLines, true),
    fontSize: 10,
    lineHeight: Math.round(10 * 1.02),
    textBoxX,
    textBoxY,
    textBoxWidth,
    textBoxHeight
  };
}

function getLayoutProfile(header, concept, title) {
  const scenePreset = concept?.scenePreset || "";
  const heroFamily = concept?.heroFamily || "";
  const normalizedTitle = String(title || "").trim().toLowerCase();
  const isShortTitle = normalizedTitle.length <= 12;
  const isFaqScene = scenePreset === "faq-question-mark" || normalizedTitle === "faq";
  const isDoorScene = heroFamily === "casino-door" || scenePreset === "hostess-signup";
  const isLargeHeroScene = [
    "supercar",
    "yacht",
    "private-jet",
    "smartphone",
    "sportsbook-phone",
    "slot-777",
    "jackpot-chest",
    "gift-box",
    "wallet",
    "safe",
    "card-stack",
    "payout-token"
  ].includes(heroFamily);

  if (header.type === "H1") {
    return {
      plateHeightRatio: 0.36,
      glowHeightRatio: 0.52,
      platePaddingRatio: 0.05,
      textInsetRatio: 0.055,
      textBoxTopRatio: 0.11,
      textBoxHeightRatio: 0.80,
      spotlightHeightRatio: 0.34,
      startFontSize: 40,
      minFontSize: 14,
      maxLines: 6,
      letterSpacing: 0
    };
  }

  if (isFaqScene && isShortTitle) {
    return {
      plateHeightRatio: 0.18,
      glowHeightRatio: 0.56,
      platePaddingRatio: 0.024,
      textInsetRatio: 0.06,
      textBoxTopRatio: 0.12,
      textBoxHeightRatio: 0.70,
      spotlightHeightRatio: 0.40,
      startFontSize: 76,
      minFontSize: 20,
      maxLines: 2,
      letterSpacing: 0
    };
  }

  if (isDoorScene) {
    return {
      plateHeightRatio: 0.24,
      glowHeightRatio: 0.56,
      platePaddingRatio: 0.032,
      textInsetRatio: 0.05,
      textBoxTopRatio: 0.08,
      textBoxHeightRatio: 0.84,
      spotlightHeightRatio: 0.40,
      startFontSize: 62,
      minFontSize: 14,
      maxLines: 6,
      letterSpacing: 0
    };
  }

  if (isLargeHeroScene) {
    return {
      plateHeightRatio: 0.20,
      glowHeightRatio: 0.56,
      platePaddingRatio: 0.028,
      textInsetRatio: 0.05,
      textBoxTopRatio: 0.08,
      textBoxHeightRatio: 0.84,
      spotlightHeightRatio: 0.40,
      startFontSize: 54,
      minFontSize: 11,
      maxLines: 7,
      letterSpacing: 0
    };
  }

  return {
    plateHeightRatio: 0.28,
    glowHeightRatio: 0.56,
      platePaddingRatio: 0.04,
      textInsetRatio: 0.05,
      textBoxTopRatio: 0.10,
      textBoxHeightRatio: 0.84,
      spotlightHeightRatio: 0.40,
      startFontSize: 68,
      minFontSize: 12,
      maxLines: 7,
      letterSpacing: 0
  };
}

function wrapTextToWidth(input, maxWidth, fontSize, maxLines, clamp = false) {
  const words = input.replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let currentLine = "";

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (estimateLineWidth(candidate, fontSize) <= maxWidth || !currentLine) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;

    if (lines.length === maxLines - 1) {
      const tailWords = [currentLine, ...words.slice(index + 1)].filter(Boolean);
      let tail = tailWords.join(" ").trim();
      if (tail) {
        if (clamp) {
          tail = fitEllipsisToWidth(tail, maxWidth, fontSize);
        }
        lines.push(tail);
      }
      break;
    }
  }

  if (lines.length < maxLines && currentLine) {
    let tail = currentLine.trim();
    if (tail) {
      if (clamp) {
        tail = fitEllipsisToWidth(tail, maxWidth, fontSize);
      }
      lines.push(tail);
    }
  }

  return lines.slice(0, maxLines).map((line) => clamp ? fitEllipsisToWidth(line, maxWidth, fontSize) : line);
}

function estimateLineWidth(text, fontSize) {
  let units = 0;
  for (const char of text) {
    if (char === " ") units += 0.33;
    else if ("ilI1|".includes(char)) units += 0.34;
    else if ("mwMW@QO0G".includes(char)) units += 0.95;
    else if (/[A-ZА-ЯİŞĞÜÖÇ]/.test(char)) units += 0.78;
    else if (/[а-яёіїєґüöäßçşğı]/i.test(char)) units += 0.7;
    else units += 0.62;
  }
  return units * fontSize * 1.08;
}

function fitEllipsisToWidth(text, maxWidth, fontSize) {
  if (estimateLineWidth(text, fontSize) <= maxWidth) {
    return text;
  }

  let current = text;
  while (current.length > 1 && estimateLineWidth(`${current}…`, fontSize) > maxWidth) {
    current = current.slice(0, -1).trimEnd();
  }

  return `${current}…`;
}

function trimToLength(text, maxLength) {
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(maxLength - 1, 1)).trim()}…`;
}

function normalizeHeadlineText(input) {
  let text = String(input || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return text;
  }

  let tokens = text.split(" ");

  tokens = dedupeAdjacentWords(tokens);

  let changed = true;
  while (changed) {
    changed = false;
    for (let size = Math.min(4, Math.floor(tokens.length / 2)); size >= 1; size -= 1) {
      let removed = false;
      for (let i = 0; i <= tokens.length - size * 2; i += 1) {
        const left = tokens.slice(i, i + size).map(normalizeWord).join(" ");
        const right = tokens.slice(i + size, i + size * 2).map(normalizeWord).join(" ");
        if (left && left === right) {
          tokens.splice(i + size, size);
          changed = true;
          removed = true;
          break;
        }
      }
      if (removed) {
        break;
      }
    }
  }

  tokens = dedupeAdjacentWords(tokens);
  tokens = dedupeRepeatedTail(tokens);
  text = tokens.join(" ").trim();

  return text.replace(/\s+([,.;:!?])/g, "$1").trim();
}

function dedupeRepeatedTail(tokens) {
  for (let size = Math.min(4, Math.floor(tokens.length / 2)); size >= 1; size -= 1) {
    const tail = tokens.slice(-size).map(normalizeWord).join(" ");
    const previous = tokens.slice(-size * 2, -size).map(normalizeWord).join(" ");
    if (tail && tail === previous) {
      return tokens.slice(0, -size);
    }
  }
  return tokens;
}

function dedupeAdjacentWords(tokens) {
  const deduped = [];
  for (const token of tokens) {
    const previous = deduped[deduped.length - 1];
    if (previous && normalizeWord(previous) === normalizeWord(token)) {
      continue;
    }
    deduped.push(token);
  }
  return deduped;
}

function normalizeWord(word) {
  return String(word || "")
    .toLowerCase()
    .replace(/[.,!?;:()"«»„”“]/g, "");
}

function normalizeColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function lightenColor(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (channel) => Math.round(channel + (255 - channel) * amount);
  return rgbToHex(mix(r), mix(g), mix(b));
}

function darkenColor(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (channel) => Math.round(channel * (1 - amount));
  return rgbToHex(mix(r), mix(g), mix(b));
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function deriveGlowColor(accentColor) {
  if (!accentColor || !/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
    return "#6be38a";
  }
  return lightenColor(accentColor, 0.12);
}

function deriveLightColor(accentColor) {
  return "#f5ebb8";
}
