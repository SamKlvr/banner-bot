import sharp from "sharp";

export async function fetchSiteSignals(doc, preferredSiteUrl = "") {
  const siteUrl = isLikelyBrandSite(preferredSiteUrl) ? preferredSiteUrl : pickBestSiteUrl(doc.links);
  const screenshotSignals = await fetchScreenshotSignals(doc.mediaLinks || []);
  const derivedPalette = deriveBrandPalette({
    screenshotPalette: screenshotSignals.palette,
    siteColors: []
  });
  if (!siteUrl) {
    return {
      site_url: "",
      page_title: "",
      description: "",
      colors_found: [],
      html_excerpt: "",
      screenshot_palette: screenshotSignals.palette,
      screenshot_source_url: screenshotSignals.sourceUrl,
      derived_palette: derivedPalette
    };
  }

  try {
    const response = await fetch(siteUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 BannerBot/1.0"
      }
    });

    const html = await response.text();
    const pageTitle = extractTag(html, "title");
    const description = extractMetaDescription(html);
    const pageSignals = extractPageSignals(siteUrl, html);
    const secondarySignals = await fetchSecondaryPageSignals(siteUrl, html);
    const siteColors = [...new Set([
      ...pageSignals.colors,
      ...secondarySignals.colors
    ])].slice(0, 30);
    const siteRelevant = isSiteRelevant(doc, siteUrl, pageTitle, description);

    if (!siteRelevant) {
      return {
        site_url: "",
        page_title: "",
        description: "",
        colors_found: [],
        html_excerpt: "",
        screenshot_palette: screenshotSignals.palette,
        screenshot_source_url: screenshotSignals.sourceUrl,
        derived_palette: derivedPalette
      };
    }

    const derived = deriveBrandPalette({
      screenshotPalette: screenshotSignals.palette,
      siteColors
    });

      return {
        site_url: siteUrl,
        page_title: pageTitle,
        description,
        colors_found: siteColors.slice(0, 12),
        html_excerpt: [html.slice(0, 6000), secondarySignals.htmlExcerpt].filter(Boolean).join("\n"),
        screenshot_palette: screenshotSignals.palette,
        screenshot_source_url: screenshotSignals.sourceUrl,
        derived_palette: derived
      };
  } catch {
    return {
      site_url: siteUrl,
      page_title: "",
      description: "",
      colors_found: [],
      html_excerpt: "",
      screenshot_palette: screenshotSignals.palette,
      screenshot_source_url: screenshotSignals.sourceUrl,
      derived_palette: derivedPalette
    };
  }
}

export async function buildReferenceImageSignals(buffer, sourceName = "reference-image") {
  const dominantBackground = await extractDominantBackgroundColor(buffer);
  const palette = await extractPalette(buffer);
  const combinedPalette = [...new Set([dominantBackground, ...palette].filter(Boolean))];
  const referenceRoles = await extractReferenceColorRoles(buffer, dominantBackground, combinedPalette);
  const campaignArchetype = detectReferenceCampaignArchetype(referenceRoles, combinedPalette);
  const derivedPalette = {
    primary_color: referenceRoles.background_color || dominantBackground || combinedPalette[0] || "#1b1f2a",
    secondary_color: referenceRoles.hero_accent_color || combinedPalette[1] || dominantBackground || "#ff4c82",
    accent_color: referenceRoles.neon_accent_color || combinedPalette[2] || combinedPalette[1] || "#31f59b",
    metallic_color: referenceRoles.metallic_color || "#d2a24a",
    background_color: referenceRoles.background_color || dominantBackground || combinedPalette[0] || "#1b1f2a",
    hero_accent_color: referenceRoles.hero_accent_color || combinedPalette[1] || "#ff4c82",
    neon_accent_color: referenceRoles.neon_accent_color || combinedPalette[2] || "#31f59b",
    palette_candidates: combinedPalette
  };

  return {
    site_url: "",
    page_title: "",
    description: "",
    colors_found: combinedPalette.slice(0, 8),
    html_excerpt: "",
    screenshot_palette: combinedPalette,
    screenshot_source_url: sourceName,
    reference_palette: combinedPalette,
    reference_background_color: dominantBackground,
    reference_color_roles: referenceRoles,
    reference_campaign_archetype: campaignArchetype,
    reference_source: sourceName,
    reference_style_tokens: classifyReferenceStyleTokens(combinedPalette, campaignArchetype),
    style_source: "reference_image",
    derived_palette: derivedPalette
  };
}

function pickBestSiteUrl(links) {
  return links.find((url) => isLikelyBrandSite(url)) || "";
}

function extractTag(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>(.*?)</${tagName}>`, "i"));
  return match?.[1]?.replace(/\s+/g, " ").trim() || "";
}

function extractMetaDescription(html) {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  return match?.[1]?.trim() || "";
}

function extractPageSignals(baseUrl, html) {
  const rawHexes = html.match(/#[0-9a-fA-F]{6}/g) || [];
  const buttonHexes = [
    ...extractButtonLikeHexes(html),
    ...extractClassScopedHexes(html, /(btn|button|cta|nav|menu|header|primary|accent)/i)
  ];

  const cssRgbColors = [
    ...extractRgbColors(html),
    ...extractCssVariables(html, /(primary|accent|button|cta|brand|success|green|gold|yellow)/i)
  ];

  const gradientStops = extractGradientColors(html);
  const colors = filterUsefulColors([
    ...buttonHexes,
    ...cssRgbColors,
    ...gradientStops,
    ...rawHexes
  ]);

  return {
    colors: prioritizeColors(colors),
    internalLinks: extractInternalLinks(baseUrl, html)
  };
}

async function fetchSecondaryPageSignals(baseUrl, html) {
  const { internalLinks } = extractPageSignals(baseUrl, html);
  const candidates = internalLinks.slice(0, 3);
  const colors = [];
  const excerpts = [];

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 BannerBot/1.0"
        }
      });

      if (!response.ok) {
        continue;
      }

      const nestedHtml = await response.text();
      const nestedSignals = extractPageSignals(baseUrl, nestedHtml);
      colors.push(...nestedSignals.colors);
      excerpts.push(nestedHtml.slice(0, 2000));
    } catch {
      continue;
    }
  }

  return {
    colors: prioritizeColors(filterUsefulColors(colors)),
    htmlExcerpt: excerpts.join("\n")
  };
}

async function fetchScreenshotSignals(mediaLinks) {
  const sourceUrl = mediaLinks.find(Boolean);
  if (!sourceUrl) {
    return {
      sourceUrl: "",
      palette: []
    };
  }

  try {
    const directUrl = normalizeMediaUrl(sourceUrl);
    const response = await fetch(directUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 BannerBot/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`screenshot fetch failed: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const palette = await extractPalette(buffer);

    return {
      sourceUrl,
      palette
    };
  } catch {
    return {
      sourceUrl,
      palette: []
    };
  }
}

function classifyReferenceStyleTokens(palette, archetype = "") {
  if (archetype === "dark-violet-neon") {
    return [
      "reference image locked style",
      "consistent campaign look across the full banner series",
      "same background treatment and saturation logic across all banners",
      "full vivid background color instead of dark empty backdrop",
      "bright handcrafted affiliate banner energy",
      "dark purple and plum base",
      "neon magenta and violet highlights",
      "strong white glow and luminous particles",
      "green money accents only as contrast props"
    ];
  }

  const colors = (palette || []).map((hex) => ({
    hex,
    ...hexToHsl(hex)
  }));

  if (!colors.length) {
    return [
      "reference image locked style",
      "consistent campaign look across the full banner series",
      "full vivid background color instead of dark empty backdrop",
      "bright handcrafted affiliate banner energy"
    ];
  }

  const mostVivid = [...colors].sort((a, b) => b.s - a.s)[0];
  const hue = mostVivid?.h ?? 300;

  const baseTokens = [
    "reference image locked style",
    "consistent campaign look across the full banner series",
    "same background treatment and saturation logic across all banners",
    "full vivid background color instead of dark empty backdrop",
    "bright handcrafted affiliate banner energy"
  ];

  if (hue >= 260 && hue <= 340) {
    return [
      ...baseTokens,
      "vivid magenta and purple neon casino palette",
      "pink and teal luminous accents",
      "hot affiliate-banner contrast"
    ];
  }

  if (hue >= 90 && hue <= 170) {
    return [
      ...baseTokens,
      "emerald or neon-green premium casino palette",
      "bright green branded backdrop",
      "gold and teal accent lighting"
    ];
  }

  if (hue >= 180 && hue <= 255) {
    return [
      ...baseTokens,
      "electric blue and cyan premium casino palette",
      "strong cool-color background glow",
      "bright teal and white highlights"
    ];
  }

  if (hue >= 20 && hue <= 70) {
    return [
      ...baseTokens,
      "golden amber premium casino palette",
      "warm jackpot lighting",
      "bright gold and bronze background atmosphere"
    ];
  }

  return [
    ...baseTokens,
    "hot red and pink premium casino palette",
    "bright saturated full-background light burst",
    "high-contrast affiliate banner lighting"
  ];
}

function detectReferenceCampaignArchetype(referenceRoles, palette) {
  const colors = [...new Set([...(palette || []), ...(Object.values(referenceRoles?.palette_by_family || {}))].filter(Boolean))];
  const hslColors = colors.map((hex) => ({ hex, ...hexToHsl(hex) }));

  const darkPurpleCount = hslColors.filter((color) =>
    (color.h >= 260 && color.h <= 330) &&
    color.l < 0.34 &&
    color.s > 0.18
  ).length;
  const vividMagentaCount = hslColors.filter((color) =>
    (color.h >= 285 && color.h <= 345) &&
    color.s > 0.38 &&
    color.l > 0.40
  ).length;
  const darkGreenishCount = hslColors.filter((color) =>
    (color.h >= 100 && color.h <= 185) &&
    color.l < 0.34 &&
    color.s > 0.18
  ).length;

  if (darkPurpleCount >= 1 && vividMagentaCount >= 1) {
    return "dark-violet-neon";
  }

  if (darkGreenishCount >= 2 && vividMagentaCount >= 1) {
    return "dark-violet-neon";
  }

  return "";
}

function normalizeMediaUrl(url) {
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) {
    return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  }

  return url;
}

function extractButtonLikeHexes(html) {
  const matches = [
    ...String(html).matchAll(/<(a|button)[^>]*(class|style)=["'][^"']*(btn|button|cta|primary|menu|nav)[^"']*["'][^>]*>/gi),
    ...String(html).matchAll(/<(a|button)[^>]*style=["']([^"']+)["'][^>]*>/gi)
  ];

  const colors = [];
  for (const match of matches) {
    const tagChunk = match[0];
    colors.push(...(tagChunk.match(/#[0-9a-fA-F]{6}/g) || []));
    colors.push(...extractRgbColors(tagChunk));
  }
  return colors;
}

function extractClassScopedHexes(html, classRegex) {
  const matches = [...String(html).matchAll(/([^{]+)\{([^}]+)\}/g)];
  const colors = [];

  for (const match of matches) {
    const selector = match[1];
    const body = match[2];
    if (!classRegex.test(selector)) {
      continue;
    }

    colors.push(...(body.match(/#[0-9a-fA-F]{6}/g) || []));
    colors.push(...extractRgbColors(body));
  }

  return colors;
}

function extractRgbColors(input) {
  return [...String(input).matchAll(/rgb[a]?\((\d{1,3})[, ]+(\d{1,3})[, ]+(\d{1,3})/gi)]
    .map((match) => rgbToHex(Number(match[1]), Number(match[2]), Number(match[3])));
}

function extractCssVariables(html, nameRegex) {
  const matches = [...String(html).matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)];
  const colors = [];

  for (const match of matches) {
    if (!nameRegex.test(match[1])) {
      continue;
    }

    colors.push(...(match[2].match(/#[0-9a-fA-F]{6}/g) || []));
    colors.push(...extractRgbColors(match[2]));
  }

  return colors;
}

function extractGradientColors(html) {
  const gradients = [...String(html).matchAll(/gradient\(([^)]+)\)/gi)];
  const colors = [];

  for (const match of gradients) {
    colors.push(...(match[1].match(/#[0-9a-fA-F]{6}/g) || []));
    colors.push(...extractRgbColors(match[1]));
  }

  return colors;
}

async function extractPalette(buffer) {
  const { data, info } = await sharp(buffer)
    .resize(48, 48, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets = new Map();

  for (let i = 0; i < data.length; i += info.channels) {
    const r = quantize(data[i], 24);
    const g = quantize(data[i + 1], 24);
    const b = quantize(data[i + 2], 24);
    const key = `${r},${g},${b}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  const colors = [...buckets.entries()].map(([key, count]) => {
    const [r, g, b] = key.split(",").map(Number);
    const hex = rgbToHex(r, g, b);
    const hsl = hexToHsl(hex);
    return {
      hex,
      count,
      ...hsl,
      score: count * (1 + hsl.s * 2)
    };
  });

  const darks = colors
    .filter((color) => color.l < 0.42)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((color) => color.hex);

  const vivid = colors
    .filter((color) => color.s > 0.18 && color.l > 0.08 && color.l < 0.92)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((color) => color.hex);

  return [...new Set([...darks, ...vivid])].slice(0, 8);
}

async function extractDominantBackgroundColor(buffer) {
  const { data, info } = await sharp(buffer)
    .resize(48, 48, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets = new Map();
  const sampleRows = Math.max(1, Math.floor(info.height * 0.72));

  for (let y = 0; y < sampleRows; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = (y * info.width + x) * info.channels;
      const r = quantize(data[index], 24);
      const g = quantize(data[index + 1], 24);
      const b = quantize(data[index + 2], 24);
      const hex = rgbToHex(r, g, b);
      const { s, l } = hexToHsl(hex);

      if (s < 0.12 || l < 0.10 || l > 0.58) {
        continue;
      }

      const key = `${r},${g},${b}`;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
  }

  const ranked = [...buckets.entries()]
    .map(([key, count]) => {
      const [r, g, b] = key.split(",").map(Number);
      const hex = rgbToHex(r, g, b);
      const { s, l } = hexToHsl(hex);
      return {
        hex,
        score: count * (1 + s * 2 + (0.65 - Math.abs(l - 0.34)))
      };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.hex || "";
}

async function extractReferenceColorRoles(buffer, dominantBackground, palette = []) {
  const { data, info } = await sharp(buffer)
    .resize(72, 72, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const backgroundFamily = classifyHueFamily(hexToHsl(dominantBackground || palette[0] || "#1b1f2a").h);
  const buckets = new Map();

  for (let i = 0; i < data.length; i += info.channels) {
    const r = quantize(data[i], 20);
    const g = quantize(data[i + 1], 20);
    const b = quantize(data[i + 2], 20);
    const hex = rgbToHex(r, g, b);
    const { h, s, l } = hexToHsl(hex);

    if (s < 0.12 || l < 0.08 || l > 0.90) {
      continue;
    }

    const family = classifyHueFamily(h);
    const key = `${family}:${hex}`;
    let weight = 1 + s * 2;

    if (family === backgroundFamily) {
      weight *= 0.55;
    }

    if (family === "red" || family === "pink" || family === "gold" || family === "teal") {
      weight += 0.6;
    }

    if (hueDistance(h, hexToHsl(dominantBackground || "#1b1f2a").h) >= 26) {
      weight += 0.35;
    }

    buckets.set(key, (buckets.get(key) || 0) + weight);
  }

  const familyLeaders = new Map();
  for (const [key, score] of buckets.entries()) {
    const [family, hex] = key.split(":");
    const current = familyLeaders.get(family);
    if (!current || score > current.score) {
      familyLeaders.set(family, { hex, score });
    }
  }

  const pickFamily = (families) =>
    families
      .map((family) => familyLeaders.get(family))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)[0]?.hex || "";

  const paletteByFamily = Object.fromEntries([...familyLeaders.entries()].map(([family, value]) => [family, value.hex]));
  const background = dominantBackground || palette[0] || "#1b1f2a";
  const heroAccent = pickHeroAccentColor(backgroundFamily, paletteByFamily, palette, background);
  const metallic = pickFamily(["gold", "orange"]) || "#d2a24a";
  const neon = pickNeonAccentColor(backgroundFamily, paletteByFamily, heroAccent, palette, metallic);

  return {
    background_color: background,
    hero_accent_color: heroAccent,
    neon_accent_color: neon,
    metallic_color: metallic,
    palette_by_family: paletteByFamily
  };
}

function pickHeroAccentColor(backgroundFamily, paletteByFamily, palette, background) {
  const preferredFamiliesByBackground = {
    green: ["red", "pink", "gold", "orange"],
    teal: ["red", "pink", "gold"],
    blue: ["red", "pink", "gold"],
    purple: ["green", "teal", "gold"],
    pink: ["green", "teal", "gold", "red"],
    red: ["green", "teal", "gold"],
    gold: ["red", "green", "teal"]
  };

  const preferred = preferredFamiliesByBackground[backgroundFamily] || ["red", "pink", "teal", "gold"];
  const picked = preferred.map((family) => paletteByFamily[family]).find(Boolean);
  if (picked) {
    return picked;
  }

  return (palette || []).find((hex) => hex !== background) || "#ff4c82";
}

function pickNeonAccentColor(backgroundFamily, paletteByFamily, heroAccent, palette, metallic) {
  const preferredFamiliesByBackground = {
    green: ["teal", "blue", "pink"],
    teal: ["pink", "red", "blue"],
    blue: ["pink", "teal", "gold"],
    purple: ["teal", "green", "gold"],
    pink: ["teal", "blue", "gold"],
    red: ["teal", "green", "gold"],
    gold: ["teal", "green", "red"]
  };

  const preferred = preferredFamiliesByBackground[backgroundFamily] || ["teal", "blue", "pink", "gold"];
  const picked = preferred
    .map((family) => paletteByFamily[family])
    .find((hex) => hex && hex !== heroAccent && hex !== metallic);

  if (picked) {
    return picked;
  }

  return (palette || []).find((hex) => hex && hex !== heroAccent && hex !== metallic) || heroAccent || "#31f59b";
}

function classifyHueFamily(hue) {
  if (hue >= 345 || hue < 18) return "red";
  if (hue >= 18 && hue < 42) return "orange";
  if (hue >= 42 && hue < 75) return "gold";
  if (hue >= 75 && hue < 170) return "green";
  if (hue >= 170 && hue < 205) return "teal";
  if (hue >= 205 && hue < 255) return "blue";
  if (hue >= 255 && hue < 315) return "purple";
  return "pink";
}

function quantize(value, step = 32) {
  return Math.round(value / step) * step;
}

function prioritizeColors(colors) {
  const unique = [...new Set(colors)];
  const weighted = unique.map((hex) => {
    const { h, s, l } = hexToHsl(hex);
    let score = s * 2;
    if (h >= 90 && h <= 170) score += 1.2;
    if (h >= 35 && h <= 60) score += 0.8;
    if (l > 0.18 && l < 0.72) score += 0.6;
    return { hex, score };
  });

  return weighted.sort((a, b) => b.score - a.score).map((item) => item.hex);
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;
}

function deriveBrandPalette({ screenshotPalette, siteColors }) {
  const filteredScreenshotPalette = filterUsefulColors(screenshotPalette || []);
  const filteredSiteColors = filterUsefulColors(siteColors || []);
  const orderedColors = [...new Set([...filteredScreenshotPalette, ...filteredSiteColors])];
  const allColors = orderedColors
    .map((hex, index) => ({
      hex,
      index,
      ...hexToHsl(hex),
      luminance: relativeLuminance(hex)
    }));

  const darkCandidates = allColors
    .filter((color) => color.luminance < 0.26)
    .sort((a, b) => a.luminance - b.luminance || a.index - b.index);

  const backgroundCandidates = allColors
    .filter((color) => color.s > 0.18 && color.l > 0.10 && color.l < 0.48)
    .sort((a, b) => a.index - b.index || b.s - a.s);

  const vividCandidates = allColors
    .filter((color) => color.s > 0.35)
    .sort((a, b) => b.s - a.s || a.index - b.index);

  const primaryColor = backgroundCandidates[0] || darkCandidates[0];
  const primary = primaryColor?.hex || "#1b1f2a";
  const primaryHue = primaryColor?.h ?? hexToHsl(primary).h;

  const secondary = backgroundCandidates.find((color) => color.hex !== primary)?.hex
    || darkCandidates.find((color) => color.hex !== primary)?.hex
    || primary;

  const contrastCandidates = vividCandidates.filter((color) => color.hex !== primary && hueDistance(color.h, primaryHue) >= 24);
  const warmContrastCandidates = contrastCandidates.filter((color) => isWarmHue(color.h));
  const heroAccent = warmContrastCandidates[0]?.hex
    || contrastCandidates[0]?.hex
    || vividCandidates.find((color) => color.hex !== primary)?.hex
    || "#31f59b";
  const neonAccent = contrastCandidates.find((color) => color.hex !== heroAccent && color.l > 0.22)?.hex
    || vividCandidates.find((color) => color.hex !== primary && color.hex !== heroAccent)?.hex
    || heroAccent;
  const metallic = warmContrastCandidates.find((color) => color.hex !== heroAccent && color.l > 0.24)?.hex
    || vividCandidates.find((color) => color.hex !== primary && isWarmHue(color.h))?.hex
    || "#d2a24a";

  return {
    primary_color: primary,
    secondary_color: heroAccent,
    accent_color: neonAccent,
    background_color: primary,
    hero_accent_color: heroAccent,
    neon_accent_color: neonAccent,
    metallic_color: metallic,
    palette_candidates: allColors.map((color) => color.hex).slice(0, 10)
  };
}

function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return { h, s, l };
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function hueDistance(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

function isWarmHue(hue) {
  return hue <= 25 || hue >= 330 || (hue >= 25 && hue <= 70);
}

function isLikelyBrandSite(url) {
  if (!/^https?:\/\//.test(url)) {
    return false;
  }

  const blockedHosts = [
    "docs.google.com",
    "drive.google.com",
    "onedrive.live.com",
    "1drv.ms",
    "figma.com",
    "www.figma.com",
    "t.me",
    "telegram.me"
  ];

  return !blockedHosts.some((host) => url.includes(host));
}

function filterUsefulColors(colors) {
  return colors.filter((hex) => {
    const { h, s, l } = hexToHsl(hex);
    const nearGray = s < 0.08;
    const tooDark = l < 0.06;
    const tooLight = l > 0.94;

    if (tooDark || tooLight) {
      return false;
    }

    if (nearGray) {
      return false;
    }

    return true;
  });
}

function extractInternalLinks(baseUrl, html) {
  const result = new Set();
  const base = safeUrl(baseUrl);
  if (!base) {
    return [];
  }

  const matches = [...String(html).matchAll(/href=["']([^"'#]+)["']/gi)];
  for (const match of matches) {
    try {
      const url = new URL(match[1], base);
      if (url.origin !== base.origin) {
        continue;
      }

      const path = url.pathname.toLowerCase();
      if (/login|signup|register|bonus|casino|slots|games|promotions?|offers?|home|index/.test(path)) {
        result.add(url.toString());
      }
    } catch {
      continue;
    }
  }

  return [...result];
}

function isSiteRelevant(doc, siteUrl, pageTitle, description) {
  const docKeywords = extractDocKeywords(doc);
  const host = safeHostname(siteUrl);
  const siteText = `${host} ${pageTitle || ""} ${description || ""}`.toLowerCase();

  if (!siteText.trim()) {
    return false;
  }

  let matches = 0;
  for (const keyword of docKeywords) {
    if (keyword.length < 4) {
      continue;
    }

    if (siteText.includes(keyword)) {
      matches += 1;
    }
  }

  if (matches >= 2) {
    return true;
  }

  if (/(casino|slot|bonus|jackpot|bet|live casino)/.test(siteText) && looksLikeCasinoArticle(doc)) {
    return true;
  }

  return false;
}

function extractDocKeywords(doc) {
  const source = `${doc.title || ""} ${String(doc.content || "").slice(0, 2000)}`.toLowerCase();
  const words = source.match(/[a-zA-ZäöüÄÖÜß]{4,}/g) || [];
  const stopWords = new Set([
    "beste", "bestes", "deutschland", "online", "casino", "deutsches", "spieler",
    "plattform", "anbieter", "bonus", "spiele", "sichere", "zahlungen", "gewinnchancen",
    "diese", "diese", "werden", "nicht", "eine", "einer", "einem", "einen"
  ]);

  return [...new Set(words.filter((word) => !stopWords.has(word)).slice(0, 24))];
}

function safeHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function safeUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function looksLikeCasinoArticle(doc) {
  const haystack = `${doc.title || ""} ${String(doc.content || "").slice(0, 2000)}`.toLowerCase();
  return /(casino|slot|bonus|jackpot|roulette|blackjack|live-casino|glücksspiel)/.test(haystack);
}
