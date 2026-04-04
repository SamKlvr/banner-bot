export function buildTheme({ doc, styleProfile, siteSignals }) {
  const preset = detectThemePreset({ doc, styleProfile, siteSignals });
  const base = buildBaseTheme(styleProfile, siteSignals, preset);
  const colorRoles = buildColorRoles(base, styleProfile, siteSignals, preset);
  const harmonized = harmonizeThemeForRoles(base, colorRoles, preset);

  return {
    ...harmonized,
    colorRoles,
    brandName: styleProfile.brand_name || "",
    visualStyle: buildVisualStyle(styleProfile.visual_style, siteSignals, preset),
    typographyHint: preset?.typography_hint || styleProfile.typography_hint || "bold modern sans-serif, white text, centered, premium UI",
    objectMotifs: preset?.object_motifs || styleProfile.object_motifs || [],
    promptTokens: buildPromptTokens(harmonized, colorRoles, preset),
    themeName: preset?.name || detectThemeName(harmonized),
    creativeDirection: preset?.creative_direction || "brand-faithful"
  };
}

function buildBaseTheme(styleProfile, siteSignals, preset) {
  const derived = siteSignals.derived_palette || {};
  const campaignArchetype = siteSignals.reference_campaign_archetype || "";
  const sourcePrimary = preset?.primary_color || derived.primary_color || styleProfile.primary_color || "#1b1f2a";
  const sourceSecondary = preset?.secondary_color || derived.secondary_color || styleProfile.secondary_color || darkenColor(sourcePrimary, 0.12);
  const sourceAccent = preset?.accent_color || derived.accent_color || styleProfile.accent_color || "#31f59b";
  const sourceMetallic = preset?.metallic_color || derived.metallic_color || styleProfile.metallic_color || "#d2a24a";
  const primary = preset?.primary_color
    ? sourcePrimary
    : campaignArchetype === "dark-violet-neon"
      ? vividifyDarkBaseColor(sourcePrimary)
      : vividifyBackgroundColor(sourcePrimary);
  const secondary = preset?.secondary_color
    ? sourceSecondary
    : campaignArchetype === "dark-violet-neon"
      ? vividifyMagentaAccentColor(sourceSecondary, primary)
      : vividifySecondaryColor(sourceSecondary, primary);
  const accent = preset?.accent_color
    ? sourceAccent
    : campaignArchetype === "dark-violet-neon"
      ? vividifyPurpleNeonColor(sourceAccent || sourcePrimary)
      : vividifyAccentColor(sourceAccent || sourcePrimary);
  const metallic = preset?.metallic_color ? sourceMetallic : vividifyMetallicColor(sourceMetallic);
  const textColor = "#ffffff";
  const glowColor = preset?.glow_color || lightenColor(accent, 0.14);
  const lightColor = preset?.light_color || deriveLightColor(accent);
  const frameColor = preset?.frame_color || lightenColor(accent, 0.28);
  const plateFill = preset?.plate_fill || lightenColor(primary, 0.06);
  const plateFillAlt = preset?.plate_fill_alt || darkenColor(secondary, 0.04);
  const plateStroke = preset?.plate_stroke || lightenColor(primary, 0.18);
  const plateInnerStroke = preset?.plate_inner_stroke || lightenColor(accent, 0.12);

  return {
    primaryColor: primary,
    secondaryColor: secondary,
    accentColor: accent,
    metallicColor: metallic,
    glowColor,
    lightColor,
    frameColor,
    plateFill,
    plateFillAlt,
    plateStroke,
    plateInnerStroke,
    textColor
  };
}

function buildVisualStyle(baseStyle, siteSignals, preset) {
  const parts = [
    baseStyle || "glossy, premium, 3D",
    "brand-faithful",
    "single coherent art direction",
    "vivid luminous version of the brand palette",
    "avoid muddy muted background tones"
  ];

  if (siteSignals.site_url) {
    parts.push("site-informed");
  }

  if (preset?.styleTokens?.length) {
    parts.push(...preset.styleTokens);
  }

  return [...new Set(parts)].join(", ");
}

function buildPromptTokens(base, colorRoles, preset) {
  return [
    `primary ${base.primaryColor}`,
    `secondary ${base.secondaryColor}`,
    `accent ${base.accentColor}`,
    `warm light ${base.lightColor}`,
    `dominant background ${colorRoles.backgroundColor}`,
    `hero accent ${colorRoles.heroAccentColor}`,
    `secondary neon accent ${colorRoles.secondaryAccentColor}`,
    `metallic accent ${colorRoles.metallicAccentColor}`,
    "use a vivid luminous version of the brand hue",
    "avoid dull or muddy color treatment",
    ...(preset?.promptTokens || [])
  ];
}

function detectThemePreset({ doc, styleProfile, siteSignals }) {
  const referencePreset = buildReferenceImagePreset(siteSignals);
  if (referencePreset) {
    return referencePreset;
  }

  const haystack = [
    styleProfile.brand_name,
    doc.title,
    doc.content.slice(0, 2000),
    siteSignals.site_url,
    siteSignals.page_title
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (haystack.includes("baywin")) {
    return {
      name: "baywin-green-premium",
      primary_color: "#0f2f18",
      secondary_color: "#184625",
      accent_color: "#58e36f",
      glow_color: "#7cf0a2",
      light_color: "#f3e4a8",
      frame_color: "#88efaf",
      plate_fill: "#135224",
      plate_fill_alt: "#0d3f1a",
      plate_stroke: "#4f9f5f",
      plate_inner_stroke: "#74e88b",
      typography_hint: "bold modern sans-serif, white text, premium green casino UI, centered, compact and strong",
      object_motifs: [
        "slot machine",
        "cards",
        "coin stack",
        "gold spotlight beams",
        "premium casino chips",
        "roulette details",
        "flying cash"
      ],
      styleTokens: [
        "deep emerald background",
        "bright green premium accent",
        "warm gold top lighting",
        "clean premium casino advertising art direction",
        "cohesive green-and-gold palette"
      ],
      creative_direction: "brand-faithful luxury affiliate",
      promptTokens: [
        "deep emerald casino atmosphere",
        "gold spotlight from above",
        "green premium interface mood",
        "avoid blue and cyan dominance"
      ]
    };
  }

  if (haystack.includes("vavada")) {
    return {
      name: "vavada-neon-magenta",
      primary_color: "#4b0f24",
      secondary_color: "#7d1538",
      accent_color: "#ff4c82",
      glow_color: "#ff70b0",
      light_color: "#ffd36e",
      frame_color: "#ff8dbc",
      plate_fill: "#ef2f5d",
      plate_fill_alt: "#c91f49",
      plate_stroke: "#ff7ea3",
      plate_inner_stroke: "#ffb0c7",
      typography_hint: "bold rounded modern sans-serif, white text, centered, vivid glossy affiliate casino ad style",
      object_motifs: [
        "777 slot machine",
        "glowing door",
        "wallet with cash",
        "support operator woman",
        "smartphone casino screen",
        "mixed-color chips",
        "gold sparkles"
      ],
      styleTokens: [
        "vivid magenta and pink affiliate casino palette",
        "neon pink and teal highlights",
        "bright handcrafted-looking casino promo aesthetic",
        "high-energy jackpot burst",
        "rich saturated background without dull gray mood"
      ],
      creative_direction: "aggressive vivid affiliate",
      promptTokens: [
        "hot pink and magenta casino glow",
        "teal and gold accent rays",
        "very vivid and juicy background",
        "bright handcrafted affiliate banner look",
        "prefer 777 machine, glowing door, smartphone, wallet, support girl, and glamorous woman when relevant",
        "avoid dull dark background and muted tones"
      ]
    };
  }

  if (looksLikeGermanCasinoArticle(doc) && hasWeakSiteSignals(siteSignals)) {
    return {
      name: "german-casino-gold-affiliate",
      primary_color: "#4a2400",
      secondary_color: "#7a4308",
      accent_color: "#ffcf3e",
      glow_color: "#ffd86f",
      light_color: "#ffe7a8",
      frame_color: "#ffde85",
      plate_fill: "#c98a10",
      plate_fill_alt: "#8a5208",
      plate_stroke: "#f2c14c",
      plate_inner_stroke: "#ffe18d",
      typography_hint: "bold rounded modern sans-serif, white text, centered, glossy affiliate casino ad style",
      object_motifs: [
        "glossy dice",
        "gold roulette ring",
        "777 slot machine",
        "elegant hostess",
        "flying dollar bills",
        "gold coins",
        "mixed-color casino chips"
      ],
      styleTokens: [
        "premium German casino affiliate banner style",
        "deep amber and gold palette",
        "center-burst volumetric light rays",
        "rich glossy 3D commercial render",
        "high click appeal",
        "luxury jackpot atmosphere"
      ],
      creative_direction: "aggressive luxury affiliate",
      promptTokens: [
        "deep golden luxury casino atmosphere",
        "bright volumetric rays from center behind subject",
        "affiliate banner style close to premium customer references",
        "warm amber jackpot lighting",
        "gold-and-bronze plate harmony",
        "avoid dark blue and cold gray dominance",
        "prefer glamorous hostess, 777, roulette, gold door, slot machine, trophy, or luxury lifestyle symbols"
      ]
    };
  }

  if (looksLikeCasinoArticle(doc) && hasWeakSiteSignals(siteSignals)) {
    return {
      name: "generic-casino-lively",
      primary_color: "#10351b",
      secondary_color: "#1b4d26",
      accent_color: "#63e36f",
      glow_color: "#84ef93",
      light_color: "#f4e3a2",
      frame_color: "#9cf5af",
      plate_fill: "#165122",
      plate_fill_alt: "#0f3818",
      plate_stroke: "#5daa66",
      plate_inner_stroke: "#7ceb8b",
      typography_hint: "bold rounded modern sans-serif, white text, centered, energetic premium casino advertising style",
      object_motifs: [
        "glossy 3D chips",
        "flying cash",
        "roulette details",
        "cards fan",
        "dramatic spotlight beams",
        "sparkles",
        "luxury win atmosphere"
      ],
      styleTokens: [
        "commercial casino ad look",
        "bright lively premium atmosphere",
        "green and gold palette",
        "glossy 3D objects",
        "avoid minimal editorial mood",
        "luxury winnings and aspirational lifestyle energy"
      ],
      creative_direction: "aggressive luxury affiliate",
      promptTokens: [
        "lively commercial casino banner",
        "bright engaging green-and-gold look",
        "stylized glossy 3D object",
        "warm spotlight from above",
        "black-and-white chips with green accents",
        "clickable affiliate banner energy",
        "wealth and luxury casino mood",
        "money, winnings, premium status symbols",
        "teal and gold glowing rays",
        "bright glamorous affiliate banner look",
        "use girls, wallets, 777, footballs, support operator, yachts, and supercars when relevant",
        "no placeholder boxes or UI panels",
        "prefer vivid lifestyle luxury or jackpot-centered hero scenes"
      ]
    };
  }

  return null;
}

function buildReferenceImagePreset(siteSignals) {
  if (siteSignals.style_source !== "reference_image") {
    return null;
  }

  const derived = siteSignals.derived_palette || {};
  const palette = siteSignals.reference_palette || siteSignals.screenshot_palette || [];
  const roles = siteSignals.reference_color_roles || {};
  const campaignArchetype = siteSignals.reference_campaign_archetype || "";
  const sourcePrimary = roles.background_color || siteSignals.reference_background_color || derived.primary_color || palette[0];
  const sourceSecondary = roles.hero_accent_color || derived.secondary_color || palette[1] || sourcePrimary;
  const sourceAccent = roles.neon_accent_color || derived.accent_color || palette[2] || palette[0];
  const sourceMetallic = roles.metallic_color || derived.metallic_color || "#d2a24a";

  if (!sourcePrimary || !sourceAccent) {
    return null;
  }

  const primary = campaignArchetype === "dark-violet-neon"
    ? vividifyDarkBaseColor(sourcePrimary)
    : vividifyBackgroundColor(sourcePrimary);
  const secondary = campaignArchetype === "dark-violet-neon"
    ? vividifyMagentaAccentColor(sourceSecondary, primary)
    : vividifyHeroAccentColor(sourceSecondary, primary);
  const accent = campaignArchetype === "dark-violet-neon"
    ? vividifyPurpleNeonColor(sourceAccent)
    : vividifyAccentColor(sourceAccent);
  const metallic = vividifyMetallicColor(sourceMetallic);
  const plateBase = mixColors(primary, secondary, 0.10);
  const paletteTokens = buildReferencePaletteTokens(primary, secondary, accent, metallic);
  const referenceTokens = siteSignals.reference_style_tokens || [];

  return {
    name: "reference-image-locked",
    primary_color: primary,
    secondary_color: secondary,
    accent_color: accent,
    hero_accent_color: secondary,
    neon_accent_color: accent,
    metallic_color: metallic,
    glow_color: lightenColor(accent, 0.12),
    light_color: deriveLightColor(accent),
    frame_color: lightenColor(mixColors(primary, accent, 0.18), 0.14),
    plate_fill: lightenColor(plateBase, 0.04),
    plate_fill_alt: darkenColor(mixColors(primary, secondary, 0.04), 0.04),
    plate_stroke: lightenColor(plateBase, 0.14),
    plate_inner_stroke: lightenColor(mixColors(secondary, accent, 0.22), 0.10),
    typography_hint: "bold rounded modern sans-serif, white text, centered, reference-locked vivid affiliate banner style",
    object_motifs: [
      "mixed-color casino chips",
      "flying dollar bills",
      "gold coins",
      "glowing dust",
      "jackpot burst",
      "luxury 3D centerpiece"
    ],
    styleTokens: [
      "style locked to the provided reference image",
      "same campaign family across all banners in the article",
      "only the semantic hero changes between banners",
      "full vivid background wash instead of a dark empty backdrop",
      "conversion-driven affiliate clarity",
      "use multiple key colors from the reference palette, not a single flat hue",
      campaignArchetype === "dark-violet-neon" ? "dark violet base with neon magenta campaign treatment" : null,
      ...referenceTokens,
      ...paletteTokens
    ].filter(Boolean),
    creative_direction: "reference-image-locked affiliate",
    promptTokens: [
      "reference image is the primary style source",
      "keep the same background treatment, saturation, chip style, and lighting logic across the full series",
      "change only the semantic hero object per heading",
      "prefer obvious conversion-driven hero objects",
      "full vivid colored background, not just outline glow",
      "use two to four key palette colors from the reference across background, hero accents, chips, props, and highlights",
      `exact background primary hex ${primary}`,
      `exact hero accent hex ${secondary}`,
      `exact neon accent hex ${accent}`,
      `exact metallic hex ${metallic}`,
      campaignArchetype === "dark-violet-neon" ? "use a dark purple or plum background base, not a green or cyan base" : null,
      `reference palette ${palette.join(", ")}`,
      ...referenceTokens,
      ...paletteTokens
    ].filter(Boolean)
  };
}

function buildReferencePaletteTokens(primaryHex, heroAccentHex, accentHex, metallicHex) {
  const primaryHue = hexToHsl(primaryHex).h;
  const heroAccentHue = hexToHsl(heroAccentHex).h;
  const accentHue = hexToHsl(accentHex).h;

  if (primaryHue >= 90 && primaryHue <= 170 && (isWarmHue(heroAccentHue) || isWarmHue(accentHue))) {
    return [
      "vivid emerald green campaign background",
      `hero objects and clothing should use ${heroAccentHex}`,
      `neon and rim-light details should use ${accentHex}`,
      `coins and premium metallic details should use ${metallicHex}`,
      "bright saturated full-background glow",
      "avoid cyan or mint drift unless the reference explicitly contains it"
    ];
  }

  if (primaryHue >= 260 && primaryHue <= 340) {
    return [
      "vivid magenta and purple campaign palette",
      "hot pink luminous background burst",
      "hot affiliate-banner color contrast"
    ];
  }

  if (primaryHue >= 90 && primaryHue <= 170) {
    return [
      "vivid emerald and green campaign palette",
      "bright green premium backdrop",
      "gold and warm accent lighting"
    ];
  }

  if (primaryHue >= 180 && primaryHue <= 255) {
    return [
      "electric blue and cyan campaign palette",
      "cool premium background glow",
      "bright teal and white highlights"
    ];
  }

  if (primaryHue >= 20 && primaryHue <= 70) {
    return [
      "golden amber campaign palette",
      "warm jackpot lighting",
      "bright gold and bronze atmosphere"
    ];
  }

  return [
    "hot red and pink campaign palette",
    "strong saturated background glow",
    "high-contrast affiliate-banner lighting"
  ];
}

function buildColorRoles(base, styleProfile, siteSignals, preset) {
  const referenceRoles = siteSignals.reference_color_roles || {};
  const derived = siteSignals.derived_palette || {};

  const backgroundColor = normalizeThemeColor(
    preset?.background_color
      || referenceRoles.background_color
      || derived.background_color
      || base.primaryColor,
    base.primaryColor
  );
  const heroAccentColor = vividifyHeroAccentColor(
    preset?.hero_accent_color
      || referenceRoles.hero_accent_color
      || derived.hero_accent_color
      || derived.secondary_color
      || styleProfile.secondary_color
      || base.secondaryColor,
    backgroundColor
  );
  const secondaryAccentColor = vividifyAccentColor(
    normalizeThemeColor(
      preset?.neon_accent_color
        || referenceRoles.neon_accent_color
        || derived.neon_accent_color
        || derived.accent_color
        || styleProfile.accent_color
        || base.accentColor,
      base.accentColor
    )
  );
  const metallicAccentColor = vividifyMetallicColor(
    normalizeThemeColor(
      preset?.metallic_color
        || referenceRoles.metallic_color
        || derived.metallic_color
        || "#d2a24a",
      "#d2a24a"
    )
  );

  return {
    backgroundColor,
    heroAccentColor,
    secondaryAccentColor,
    metallicAccentColor
  };
}

function harmonizeThemeForRoles(base, colorRoles, preset) {
  if (preset?.plate_fill || preset?.plate_fill_alt || preset?.plate_stroke || preset?.plate_inner_stroke) {
    return base;
  }

  const plateBase = mixColors(base.primaryColor, colorRoles.heroAccentColor, 0.08);
  return {
    ...base,
    plateFill: lightenColor(plateBase, 0.03),
    plateFillAlt: darkenColor(mixColors(base.primaryColor, colorRoles.heroAccentColor, 0.04), 0.04),
    plateStroke: lightenColor(plateBase, 0.14),
    plateInnerStroke: lightenColor(mixColors(colorRoles.heroAccentColor, colorRoles.secondaryAccentColor, 0.18), 0.08)
  };
}

function detectThemeName(theme) {
  const { h, s, l } = hexToHsl(theme.accentColor);
  if (s > 0.35 && h >= 90 && h <= 170) return "green-premium";
  if (s > 0.35 && h >= 200 && h <= 255) return "blue-tech";
  if (s > 0.35 && (h >= 345 || h <= 15)) return "red-bold";
  return l < 0.4 ? "dark-premium" : "neutral";
}

function looksLikeCasinoArticle(doc) {
  const haystack = [doc.title, doc.content.slice(0, 3000)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /(casino|slot|bonus|roulette|blackjack|aams|bet|scommesse|gioco)/.test(haystack);
}

function looksLikeGermanCasinoArticle(doc) {
  const haystack = [doc.title, doc.content.slice(0, 2500)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /(casino)/.test(haystack) && /(deutschland|deutsche|deutsches|deutscher)/.test(haystack);
}

function hasWeakSiteSignals(siteSignals) {
  const noUsefulSiteColors = !(siteSignals.colors_found || []).length;
  const noUsefulHtml = !(siteSignals.html_excerpt || "").trim();
  return noUsefulSiteColors && noUsefulHtml;
}

function deriveLightColor(accentColor) {
  const { h } = hexToHsl(accentColor);
  if (h >= 90 && h <= 170) return "#f3e4a8";
  if (h >= 200 && h <= 255) return "#dfe9ff";
  if (h >= 345 || h <= 15) return "#ffe2cc";
  return "#f4f0d2";
}

function vividifyBackgroundColor(hex) {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, Math.max(s, 0.68), clamp(Math.max(l, 0.34), 0.34, 0.46));
}

function vividifySecondaryColor(hex, fallbackHex) {
  const source = /^#[0-9a-fA-F]{6}$/.test(String(hex || "")) ? hex : fallbackHex;
  const { h, s, l } = hexToHsl(source);
  return hslToHex(h, Math.max(s, 0.66), clamp(Math.max(l, 0.38), 0.38, 0.52));
}

function vividifyHeroAccentColor(hex, fallbackHex) {
  const source = /^#[0-9a-fA-F]{6}$/.test(String(hex || "")) ? hex : fallbackHex;
  const { h, s, l } = hexToHsl(source);
  return hslToHex(h, Math.max(s, 0.74), clamp(Math.max(l, 0.44), 0.44, 0.62));
}

function vividifyDarkBaseColor(hex) {
  const { h, s, l } = hexToHsl(hex);
  const preferredHue = (h >= 250 && h <= 330) ? h : 285;
  return hslToHex(preferredHue, Math.max(s, 0.56), clamp(Math.max(l, 0.18), 0.18, 0.26));
}

function vividifyMagentaAccentColor(hex, fallbackHex) {
  const source = /^#[0-9a-fA-F]{6}$/.test(String(hex || "")) ? hex : fallbackHex;
  const { h, s, l } = hexToHsl(source);
  const targetHue = (h >= 300 && h <= 355) ? h : 325;
  return hslToHex(targetHue, Math.max(s, 0.78), clamp(Math.max(l, 0.54), 0.54, 0.68));
}

function vividifyPurpleNeonColor(hex) {
  const { h, s, l } = hexToHsl(hex);
  const targetHue = (h >= 265 && h <= 325) ? h : 290;
  return hslToHex(targetHue, Math.max(s, 0.82), clamp(Math.max(l, 0.60), 0.60, 0.74));
}

function vividifyAccentColor(hex) {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, Math.max(s, 0.78), clamp(Math.max(l, 0.54), 0.54, 0.68));
}

function vividifyMetallicColor(hex) {
  const source = /^#[0-9a-fA-F]{6}$/.test(String(hex || "")) ? hex : "#d2a24a";
  const { h, s, l } = hexToHsl(source);
  const metallicHue = isWarmHue(h) || (h >= 35 && h <= 60) ? h : 42;
  return hslToHex(metallicHue, Math.max(s, 0.58), clamp(Math.max(l, 0.50), 0.50, 0.66));
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

function mixColors(hexA, hexB, weight = 0.5) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const ratio = clamp(weight, 0, 1);
  const mix = (channelA, channelB) => Math.round(channelA * (1 - ratio) + channelB * ratio);
  return rgbToHex(
    mix(a.r, b.r),
    mix(a.g, b.g),
    mix(a.b, b.b)
  );
}

function normalizeThemeColor(hex, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(String(hex || "")) ? hex : fallback;
}

function hexToRgb(hex) {
  const normalized = String(hex).replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;
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

function hslToHex(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = l - chroma / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hue < 60) [r1, g1, b1] = [chroma, x, 0];
  else if (hue < 120) [r1, g1, b1] = [x, chroma, 0];
  else if (hue < 180) [r1, g1, b1] = [0, chroma, x];
  else if (hue < 240) [r1, g1, b1] = [0, x, chroma];
  else if (hue < 300) [r1, g1, b1] = [x, 0, chroma];
  else [r1, g1, b1] = [chroma, 0, x];

  return rgbToHex(
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255)
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isWarmHue(hue) {
  return (hue >= 0 && hue <= 35) || (hue >= 340 && hue <= 360) || (hue >= 36 && hue <= 70);
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
