import OpenAI from "openai";
import { config } from "./config.js";
import { buildTheme } from "./theme-builder.js";
import { mapHeaderToConcept } from "./concept-mapper.js";

export const openai = new OpenAI({
  apiKey: config.openaiApiKey
});

export async function buildStyleProfile(doc, siteSignals) {
  const safeDoc = sanitizeForPrompt(doc);
  const safeSiteSignals = sanitizeForPrompt(siteSignals);
  const prompt = [
    "You analyze a gambling or betting article and extract the visual brand style for banner generation.",
    "If REFERENCE IMAGE SIGNALS are present, they override site signals and article guesses. Treat the reference image as the main source for color, saturation, lighting mood, and overall campaign style.",
    "Return JSON only with keys:",
    "brand_name, site_url, primary_color, secondary_color, accent_color, visual_style, typography_hint, object_motifs.",
    "object_motifs must be an array of 5 to 8 short strings.",
    "",
    `DOC TITLE: ${safeDoc.title || ""}`,
    `DOC LINKS: ${safeJsonStringify(safeDoc.links || [])}`,
    `DOC MEDIA LINKS: ${safeJsonStringify(safeDoc.mediaLinks || [])}`,
    `HEADINGS: ${safeJsonStringify(safeDoc.headings || [])}`,
    `DOC TEXT: ${truncate(safeDoc.content || "", 12000)}`,
    `SITE SIGNALS: ${safeJsonStringify(safeSiteSignals)}`
  ].join("\n");

  const aiProfile = await jsonCompletion(prompt);
  const merged = mergeStyleProfile(aiProfile, siteSignals);
  merged.theme = buildTheme({
    doc,
    styleProfile: merged,
    siteSignals
  });
  return merged;
}

export async function buildImagePrompt({ header, styleProfile, feedback, recentHeroHistory = [], concept: plannedConcept = null }) {
  const safeHeader = sanitizeForPrompt(header);
  const safeStyleProfile = sanitizeForPrompt(styleProfile);
  const safeFeedback = sanitizeText(feedback || "");
  const safeRecentHeroHistory = sanitizeForPrompt(recentHeroHistory);
  const theme = safeStyleProfile.theme || {};
  const concept = sanitizeForPrompt(plannedConcept || mapHeaderToConcept(safeHeader.text, safeRecentHeroHistory));
  const visualMode = pickVisualMode(safeHeader.text, concept);
  const scenePreset = concept.scenePreset || "casino-games-portal";
  const diversityGuidance = sanitizeText(buildDiversityGuidance(safeRecentHeroHistory, concept));
  const colorRoleGuidance = sanitizeText(buildSceneColorRoleGuidance(theme, concept));
  const prompt = [
    "Generate one polished English image prompt for a high-converting luxury casino affiliate banner background.",
    "Return JSON only with key prompt.",
    "The result must be one final English prompt string that describes only the visual image, not the overlay text.",
    "Think like an elite art director for VIP online casino advertising.",
    "Use a consistent master style DNA inspired by premium casino affiliate banners: square banner composition, centered subject, highly saturated color, intense glossy 3D rendering, dramatic central light burst, a vivid luminous version of the brand palette, and a clear safe area for headline text at the bottom.",
    "Leave the lower 30 percent visually cleaner for a future title plate, but do not draw any placeholder panel, frame, card, rectangle, lower-third box, UI slot, or empty text area.",
    "No text, no letters, no watermark.",
    "Do not draw any decorative border, outer frame, HUD outline, neon rectangle, or interface container around the scene.",
    "Do not draw floating rounded rectangles, empty UI cards, glowing panels, or abstract translucent boxes in the background.",
    "Stay faithful to the brand palette and site UI mood, not generic casino colors.",
    "All banners inside one article must feel like one coherent campaign: same background treatment, same lighting language, same chip rendering style, same saturation logic, and the same premium ad family. Only the central semantic hero should change.",
    "Headline semantics come first. Map every heading to one obvious high-conversion hero object. Examples: telegram bot or Telegram -> glossy paper airplane, mirror or bypass -> premium portal, slots -> 777 slot machine, payments or withdrawals -> wallet or payout object, mobile app -> smartphone, support -> woman with headset.",
    "Prefer the most literal, conversion-friendly hero instead of a generic casino object.",
    "If REFERENCE IMAGE SIGNALS are present, they override website styling and inferred brand styling. Match their palette, contrast, saturation, lighting mood, and overall campaign feel.",
    "When a reference palette is provided, use those exact hex colors as the campaign palette. Do not drift into cyan, turquoise, mint, or other nearby hues if they are not in the reference.",
    "When a reference palette is locked, the furthest full background should stay in the dominant background hue from that palette. Accent colors should appear in the hero object, chips, slot trims, cards, portal edges, and light details, not repaint the entire background into a different hue.",
    "Use at least two or three of the key colors from the reference palette across the scene when they exist. If the reference has a green background and red accents, keep the background green and use the red in props, hero accents, chips, cards, slot trims, clothing, or portal details.",
    "Treat the palette as assigned roles, not as a loose bag of colors. Use the dominant background color for the full backdrop and title plate family, the hero accent color on the main object or clothing, the secondary accent for neon, chip accents, and rim lights, and the metallic accent for coins and luxury trim.",
    "Do not swap these roles. If green is dominant and red is secondary in the reference, the background must stay green and the red must stay in the hero accents and important props.",
    "Do not apply a uniform color wash over the whole image. The scene should naturally be rendered in the correct palette from the start.",
    "Use one coherent ad formula shared by the whole image: deep branded background, center-back volumetric god rays, one large glossy 3D centerpiece, and a zero-gravity jackpot explosion around it.",
    "Prefer lively, vivid, flashy commercial casino advertising energy over minimal editorial style.",
    "This should look like a premium affiliate thumbnail or promo banner that users want to click immediately, with strong wow effect, ad energy, and rich visual density.",
    "Make the image feel bright, engaging, glossy, premium, cinematic, slightly stylized, emotionally exciting, expensive, highly clickable, and strong enough to create a wow effect.",
    "Push color intensity confidently: the image should feel juicy, punchy, bright, and ad-ready rather than restrained or realistic-muted.",
    "Prefer a richer, hotter, more saturated campaign treatment with luminous backgrounds, brighter highlights, stronger color separation, and more visual punch.",
    "Use exactly one strong central hero object that clearly matches the meaning of the heading.",
    "The central hero must be large and dominant, usually filling roughly 50 to 75 percent of the useful composition. Do not make the main object tiny, distant, or visually weak.",
    "Keep the full hero silhouette fully visible above the lower title zone. Do not let important parts of the hero disappear behind the future title plate.",
    "For vehicle, yacht, smartphone, slot-machine, portal, and wallet scenes, place the hero slightly higher in frame so it remains clearly visible above the lower title zone.",
    "The background should be rich, deep, vivid, and atmospheric in the brand palette, with bright glowing volumetric light rays bursting from the center behind the hero object. Use a beautiful, bright, high-contrast version of the brand hue instead of a dull or muddy version of that same color.",
    "The furthest background layer must itself be colorful and luminous, not a flat dark gray or black backdrop with only bright outlines. Fill the whole background with rich saturated color, atmospheric gradients, and vivid branded light.",
    "Do not be timid with saturation or contrast. The final look should feel like a handcrafted high-conversion affiliate creative, not a conservative brand mockup.",
    "The rays and light burst must stay behind the main subject or behind the main object silhouette, never painted across the face, eyes, skin, or front of the body.",
    "Always add jackpot dynamics around the centerpiece: floating casino chips, flying dollar bills, shiny gold coins, glowing dust, sparkles, and swirling motion in zero gravity.",
    "If a reference palette is locked, keep secondary props disciplined to that palette plus realistic neutrals like white, black, metallic gold, and natural money tones. Avoid rainbow chips and unrelated neon colors unless those colors are clearly present in the reference image.",
    "Keep the focal object very readable, large, and glossy, with premium materials and expensive rendering quality.",
    "Materials should feel like a luxury 3D commercial render: polished metal, glossy plastic, luminous glass, premium leather, rich casino felt, and refined gold details.",
    "The emotional subtext should suggest wealth, winning, status, glamour, and aspirational casino lifestyle.",
    "Where appropriate, weave in wealth symbols that reinforce the heading: stuffed wallet, stacks of cash, premium jewelry, sports car energy, yacht-life glamour, safe full of money.",
    "If the visual mode is lifestyle or hostess, a glamorous female promo character is allowed, but do not default to a woman if a strong non-character hero would fit better.",
    "When using a female character, prefer loose hair, glamorous confident styling, luxury resort or casino styling, and a more relaxed premium look instead of stiff formal dresses.",
    "Tasteful adult glamour is allowed for female characters: elegant bikini or swimsuit-inspired luxury resort looks, confident decollete styling, and more open glamorous silhouettes can be used when it fits the banner mood.",
    "Avoid outfits that look like generic hostess uniforms, conservative gowns, or culturally mismatched fashion.",
    "Characters should feel luxurious, vivid, premium, slightly stylized, and ad-friendly, not flat, generic, or corporate.",
    "Across a banner set, vary the hero types aggressively. Do not let the set collapse into repeated women, repeated wallets, or repeated supercars. Rotate between roulette, slot machine, smartphone, safe, chat symbol, cards fan, jackpot chest, yacht, question mark, portal, and other relevant heroes.",
    "Use realistic casino props with believable color variation: black, red, blue, green, pink, teal, and white chips where appropriate, and let money/cards/chips keep their natural colors instead of making everything monochrome.",
    "Do not add an unwanted green glow, green rim light, green hair tint, or green color cast unless the actual brand palette is clearly green.",
    "Never place colored light across the face. Face lighting should stay clean, flattering, and mostly neutral-warm unless the brand clearly requires otherwise.",
    "If playing cards appear, they must look like realistic casino cards with mixed suits and mixed ranks, for example hearts, diamonds, clubs, and spades with varied values such as A, K, Q, J, 10, 7.",
    "Do not generate repeated identical cards, all-black cards, fake symbols, or monochrome card faces.",
    "Use trophies or cups only for ranking or explicit award themes. Do not insert a trophy into unrelated scenes.",
    "If the hero object is a smartphone, the phone screen must be clearly visible and must contain obvious casino content, not an empty glow or reflective blank screen.",
    "For smartphone scenes, strongly prefer visible 777 reels, spinning slot reels, jackpot win screen, free spins UI, roulette wheel interface, poker cards, or bright casino game symbols on the display. The screen should read immediately as a live gambling product.",
    "Render smartphones as realistic flagship devices with believable bezels, screen glass, reflections, proportions, and camera/notch details. Do not render toy-like or fake abstract phones.",
    "A smartphone must clearly read as a real modern phone, never as an arcade cabinet, toy terminal, retro machine, slot-machine frame, or thick glowing kiosk.",
    "Render supercars, yachts, wallets, and other luxury objects as photorealistic glossy premium 3D hero props, not tiny distant icons.",
    "If the hero object is a door, it must be a real physical opaque door, not an abstract portal ring, not a neon arch, not an empty glowing frame, and not a transparent or glass doorway. Show a visible solid door leaf, visible handle, visible hinges or door thickness, and an obvious doorway opening into the light.",
    "Do not add neon rectangles, neon hoops, halo rings, decorative arcs, outlined geometric shapes, glowing frames, or circular light rings behind the hero unless the semantic hero specifically requires that exact shape.",
    "Do not make the scene flat, empty, minimalist, weak, or overly corporate.",
    "Do not invent unrelated objects outside the allowed concept family.",
    "Keep the composition readable, but do not make it sparse or minimalist. It should still feel rich, juicy, colorful, and full of premium casino motion.",
    "The whole image should feel like one deliberate ad concept, not random casino elements scattered on a canvas.",
    "Reference quality target: glossy customer-facing casino affiliate banners with strong center lighting, premium jackpot mood, obvious click appeal, and vivid brand-color treatment similar to bright handcrafted affiliate creatives.",
    "",
    `VISUAL MODE: ${visualMode}`,
    `SCENE PRESET: ${scenePreset}`,
    `ALLOWED CENTRAL OBJECT FAMILY: ${concept.centralObject}`,
    `SUPPORTING ELEMENTS: ${JSON.stringify(concept.supportingElements)}`,
    `SCENE INTENT: ${concept.sceneHint}`,
    `AVOID: ${JSON.stringify(concept.avoid)}`,
    `HERO BIAS: ${concept.heroBias}`,
    `HEADER: ${safeHeader.text || ""}`,
    `HEADER TYPE: ${safeHeader.type || ""}`,
    `BANNER KIND: ${safeHeader.banner_kind || ""}`,
    `BRAND PROFILE: ${safeJsonStringify(safeStyleProfile)}`,
    `THEME: ${safeJsonStringify(theme)}`,
    `COLOR ROLE GUIDANCE: ${colorRoleGuidance}`,
    `PROMPT TOKENS: ${safeJsonStringify(theme.promptTokens || [])}`,
    `EXACT HEX PALETTE: ${JSON.stringify([
      theme.primaryColor || safeStyleProfile.primary_color,
      theme.secondaryColor || safeStyleProfile.secondary_color,
      theme.accentColor || safeStyleProfile.accent_color
    ].filter(Boolean))}`,
    `STYLE SOURCE: ${safeStyleProfile.style_source || "inferred"}`,
    `REFERENCE IMAGE SIGNALS: ${safeJsonStringify(safeStyleProfile.reference_image_signals || null)}`,
    `DIVERSITY GUIDANCE: ${diversityGuidance}`,
    `RECENT HERO HISTORY: ${safeJsonStringify(safeRecentHeroHistory)}`,
    `USER FEEDBACK: ${safeFeedback}`,
    "",
    "SCENE PRESET LIBRARY:",
    "overview-luxury-hostess: broad overview scene built around a glamorous loose-haired character, a luxury object, or a big jackpot hero like 777, with chips, flying dollar bills, and rewards atmosphere.",
    "ranking-hostess-or-supercar: yacht, supercar, glamorous woman, luxury jackpot chest, 777 machine, or roulette ring as the hero, with ranking energy, stars, chips, and money, premium recommendation mood.",
    "jackpot-777-or-gift: 777 slot machine, glowing gift box, jackpot symbol, or trophy exploding with chips, gold coins, and flying cash.",
    "wallet-cashout: open premium wallet, safe full of money, payout object, or elegant card stack with instant-withdrawal energy and visible wealth.",
    "mobile-smartphone: large smartphone hero with a clearly visible casino screen, ideally showing 777 slot reels, spinning reels, jackpot UI, free spins screen, roulette interface, or poker cards, with chips, money, and global-access lifestyle mood.",
    "telegram-airplane: large glossy paper airplane or premium messenger plane hero used for Telegram-bot themes, very readable, bright, and centered.",
    "mirror-portal: a large vivid premium portal or mirror gateway used for mirror or bypass themes, with obvious portal depth and bright access symbolism.",
    "mirror-doorway: a clearly real luxurious open door used for mirror or bypass themes, with a solid opaque door leaf, visible handle, visible hinge or thickness, a premium frame, and a bright casino world behind it; never an abstract portal ring, neon arch, transparent glass door, or empty luminous frame.",
    "hostess-signup: elegant female promo character or a detailed glowing luxury casino door/entry portal as the main hero, with welcoming luxury, bright jackpot energy, and glamorous click appeal.",
    "casino-games-portal: roulette, slot machine, cards fan, portal of many games, chips, and money, emphasizing game variety and casino excitement.",
    "faq-question-mark: large glossy full question mark, completely visible above the lower title zone, with chips, money, and support icons in a clean but still premium casino environment.",
    "private-jet-luxury: private jet, yacht, or luxury travel symbol with casino chips, money, and jackpot lighting for aspirational lifestyle scenes.",
    "support-hostess: premium support operator woman with headset and microphone as the main hero, with clear support energy, polished live-chat cues, and premium ad-friendly styling.",
    "security-symbol: trusted verification symbol or polished safe/trust emblem with restrained but still premium casino energy.",
    "",
    "Build the final prompt as one cohesive premium image-generation instruction."
  ].join("\n");

  const result = await jsonCompletion(prompt);
  return result.prompt;
}

async function jsonCompletion(prompt) {
  const safePrompt = sanitizeText(prompt);
  let completion;

  try {
    completion = await openai.chat.completions.create({
      model: config.openaiModel,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a precise creative production assistant. Always return valid JSON."
        },
        {
          role: "user",
          content: safePrompt
        }
      ]
    });
  } catch (error) {
    if (shouldRetryAsBodyParseError(error)) {
      const fallbackPrompt = sanitizeText(stripUnsupportedCharacters(safePrompt));
      completion = await openai.chat.completions.create({
        model: config.openaiModel,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a precise creative production assistant. Always return valid JSON."
          },
          {
            role: "user",
            content: fallbackPrompt
          }
        ]
      });
    } else {
      throw error;
    }
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  return JSON.parse(content);
}

function truncate(text, maxLength) {
  const safeText = String(text || "");
  if (safeText.length <= maxLength) {
    return safeText;
  }

  return safeText.slice(0, maxLength);
}

function mergeStyleProfile(aiProfile, siteSignals) {
  const derived = siteSignals.derived_palette || {};
  return {
    ...aiProfile,
    style_source: siteSignals.style_source || "document_media",
    reference_image_signals: siteSignals.style_source === "reference_image"
      ? {
          palette: siteSignals.reference_palette || [],
          color_roles: siteSignals.reference_color_roles || null,
          style_tokens: siteSignals.reference_style_tokens || [],
          source: siteSignals.reference_source || ""
        }
      : null,
    primary_color: derived.primary_color || aiProfile.primary_color || "#1b1f2a",
    secondary_color: derived.secondary_color || aiProfile.secondary_color || "#2b3140",
    accent_color: derived.accent_color || aiProfile.accent_color || "#31f59b",
    metallic_color: derived.metallic_color || aiProfile.metallic_color || "#d2a24a"
  };
}

function pickVisualMode(headerText, concept) {
  const text = String(headerText || "").toLowerCase();

  if (concept.heroBias === "hostess") {
    return "glamorous-hostess";
  }

  if (concept.heroBias === "lifestyle") {
    return "luxury-lifestyle";
  }

  if (concept.heroBias === "jackpot" || /bonus|jackpot|free spin|promo/.test(text)) {
    return "jackpot-object";
  }

  if (concept.heroBias === "wealth-object" || /zahlung|payment|deposit|withdraw|wallet|bank/.test(text)) {
    return "wealth-object";
  }

  if (concept.heroBias === "device" || /mobile|app|smartphone|android|ios/.test(text)) {
    return "device-hero";
  }

  if (concept.heroBias === "game-object") {
    return "casino-prop";
  }

  if (/warum|why|vorteile|best|top|ranking|liste|migliori/.test(text)) {
    return "luxury-lifestyle";
  }

  return "casino-prop";
}

function sanitizeForPrompt(value) {
  if (typeof value === "string") {
    return sanitizeText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForPrompt(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, sanitizeForPrompt(nested)])
    );
  }

  return value;
}

function sanitizeText(value) {
  const text = String(value ?? "");
  const wellFormed = typeof text.toWellFormed === "function" ? text.toWellFormed() : text;
  return wellFormed
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\u2028|\u2029/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripUnsupportedCharacters(value) {
  return String(value || "").replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD]/g, " ");
}

function safeJsonStringify(value) {
  return JSON.stringify(sanitizeForPrompt(value));
}

function shouldRetryAsBodyParseError(error) {
  const message = String(error?.message || "");
  const status = error?.status || error?.statusCode || error?.code;
  return String(status) === "400" && /parse the json body|not valid json|json body/i.test(message);
}

function buildDiversityGuidance(recentHeroHistory, concept) {
  const recent = recentHeroHistory.slice(-5);
  const hostessCount = recent.filter((item) => item === "hostess").length;
  const walletCount = recent.filter((item) => item === "wallet").length;
  const supercarCount = recent.filter((item) => item === "supercar").length;
  const counts = new Map();
  for (const item of recent) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  const topRepeat = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  if (concept.heroBias === "hostess") {
    if (hostessCount >= 2) {
      return "Character scenes were already overused recently. Avoid another woman unless the heading absolutely depends on it. Prefer a smartphone, entry portal, roulette, or 777 signup hero instead.";
    }
    return "This heading can support a character-based scene, but only use a woman if it clearly improves the idea. Otherwise prefer a smartphone, entry portal, roulette, or 777 signup hero.";
  }

  if (hostessCount >= 2 && concept.heroBias !== "hostess") {
    return "A recent banner already used a female character. Strongly avoid another woman here unless absolutely necessary. Prefer a strong non-character hero: roulette, slot machine, smartphone, safe, 777, yacht, question mark, casino portal, chat symbol, or jackpot chest.";
  }

  if (walletCount >= 1) {
    return "Recent banners already overused wallets or payout props. Avoid another wallet scene. Prefer a safe, card stack, roulette, smartphone, 777, jackpot chest, or casino portal.";
  }

  if (supercarCount >= 2) {
    return "Recent banners already overused cars. Avoid another supercar. Prefer a yacht, roulette, 777 machine, jackpot chest, smartphone, or casino portal.";
  }

  if (topRepeat && topRepeat[1] >= 2 && concept.heroFamily === topRepeat[0]) {
    return `Recent banners already repeated the hero family "${topRepeat[0]}". Strongly switch to a different central object family for this banner.`;
  }

  return "Keep hero selection varied across the banner set and avoid repeating the same hero family too often.";
}

function buildSceneColorRoleGuidance(theme, concept) {
  const roles = theme?.colorRoles || {};
  if (!roles.backgroundColor) {
    return "Use the dominant background color for the full backdrop, keep the hero accent on the main object or clothing, keep the secondary accent on neon and chips, and keep metallic details warm and luxurious.";
  }

  const lines = [
    `Dominant background color: ${roles.backgroundColor}. This should fill most of the far background and the overall atmospheric wash.`,
    `Hero accent color: ${roles.heroAccentColor}. Use this on the main hero object, clothing, slot body, portal trim, question mark, wallet, or other central prop.`,
    `Secondary neon accent: ${roles.secondaryAccentColor}. Use this for rim lights, chips, motion streaks, energy arcs, and highlight details, not as the whole background.`,
    `Metallic accent: ${roles.metallicAccentColor}. Use this for coins, glossy luxury trim, handles, slot metals, jewelry, and expensive details.`,
    `The title plate should stay in the same color family as the dominant background, just brighter and glossier.`
  ];

  switch (concept?.scenePreset) {
    case "support-hostess":
      lines.push(`For support scenes, keep ${roles.backgroundColor} in the backdrop, put ${roles.heroAccentColor} on the woman's outfit or headset details, and reserve ${roles.secondaryAccentColor} for subtle live-chat light accents.`);
      break;
    case "mobile-smartphone":
      lines.push(`For smartphone scenes, keep the phone body realistic and mostly dark or metallic, keep ${roles.backgroundColor} in the background, and use ${roles.heroAccentColor} plus ${roles.secondaryAccentColor} inside the casino screen UI.`);
      break;
    case "wallet-cashout":
      lines.push(`For payment scenes, use ${roles.heroAccentColor} on the wallet or payout object, keep ${roles.backgroundColor} in the environment, and use ${roles.metallicAccentColor} on money trim, zippers, and premium details.`);
      break;
    case "mirror-portal":
    case "mirror-doorway":
      lines.push(`For mirror and bypass scenes, keep the environment in ${roles.backgroundColor}, use ${roles.heroAccentColor} on the portal or door frame, and use ${roles.secondaryAccentColor} for the inner access glow and edge lighting.`);
      break;
    case "jackpot-777-or-gift":
      lines.push(`For slot or jackpot scenes, keep the background in ${roles.backgroundColor}, use ${roles.heroAccentColor} on the slot machine body, 777 details, or gift wrapping, and reserve ${roles.secondaryAccentColor} for neon trims and chips.`);
      break;
    case "faq-question-mark":
      lines.push(`For FAQ scenes, keep the question mark in ${roles.heroAccentColor}, the background in ${roles.backgroundColor}, and the speech-bubble or help accents in ${roles.secondaryAccentColor}.`);
      break;
    default:
      lines.push(`Keep the central hero clearly separated from the backdrop by using ${roles.heroAccentColor} on it while keeping the environment in ${roles.backgroundColor}.`);
      break;
  }

  return lines.join(" ");
}
