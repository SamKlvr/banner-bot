export function mapHeaderToConcept(headerText, recentHeroHistory = []) {
  const text = String(headerText || "").toLowerCase();

  for (const rule of RULES) {
    if (rule.matches.some((pattern) => pattern.test(text))) {
      const variant = pickVariant(rule, recentHeroHistory, headerText);
      return {
        key: rule.key,
        centralObject: variant.centralObject,
        supportingElements: variant.supportingElements || rule.supportingElements,
        sceneHint: variant.sceneHint || rule.sceneHint,
        avoid: variant.avoid || rule.avoid,
        heroBias: variant.heroBias || rule.heroBias || "object",
        heroFamily: variant.heroFamily || rule.heroFamily || "game-object",
        scenePreset: variant.scenePreset || rule.scenePreset || buildDefaultScenePreset(rule.heroBias || "object")
      };
    }
  }

  const fallback = pickVariant({
    heroBias: "object",
    variants: [
      {
        centralObject: "glossy 3D 777 slot machine with a jackpot aura",
        scenePreset: "jackpot-777-or-gift",
        heroFamily: "slot-777"
      },
      {
        centralObject: "luxury stuffed wallet or payout symbol bursting with money",
        scenePreset: "wallet-cashout",
        heroFamily: "wallet"
      },
      {
        centralObject: "glamorous casino hostess with loose hair and luxury casino energy",
        scenePreset: "overview-luxury-hostess",
        heroFamily: "hostess"
      },
      {
        centralObject: "white supercar or luxury yacht with jackpot energy",
        scenePreset: "ranking-hostess-or-supercar",
        heroFamily: "supercar"
      },
      {
        centralObject: "glossy 3D roulette wheel with a jackpot aura",
        scenePreset: "casino-games-portal",
        heroFamily: "roulette"
      },
      {
        centralObject: "luxury casino portal packed with game symbols",
        scenePreset: "casino-games-portal",
        heroFamily: "casino-portal"
      }
    ]
  }, recentHeroHistory, headerText);

  return {
    key: "generic-casino",
    centralObject: fallback.centralObject,
    supportingElements: ["floating casino chips in mixed colors", "flying dollar bills", "shiny gold coins", "gold sparkles", "volumetric light rays"],
    sceneHint: "dynamic jackpot explosion scene with wealth, luxury, motion, and a single obvious focal object",
    avoid: ["random shield", "random lock", "unrelated security icon"],
    heroBias: fallback.heroBias || "object",
    heroFamily: fallback.heroFamily || "game-object",
    scenePreset: fallback.scenePreset || "casino-games-portal"
  };
}

const RULES = [
  {
    key: "telegram-bot",
    matches: [/telegram/, /telegram-bot/, /телеграм/, /телега/, /тг-бот/, /tg bot/],
    centralObject: "large glossy paper airplane icon or premium messenger plane hero, clearly readable and centered",
    supportingElements: ["floating casino chips in mixed colors", "flying dollar bills", "gold sparkles", "bright jackpot light burst", "messenger energy"],
    sceneHint: "Telegram-bot scene with one obvious paper-airplane hero that instantly communicates Telegram access, bright, vivid, and highly clickable",
    avoid: ["wallet", "slot machine", "roulette wheel", "generic portal", "supercar"],
    heroBias: "symbol",
    scenePreset: "telegram-airplane",
    heroFamily: "telegram-plane",
    variants: [
      {
        centralObject: "large glossy paper airplane hero with premium Telegram-bot energy and a bright jackpot backdrop",
        heroFamily: "telegram-plane"
      },
      {
        centralObject: "premium messenger paper airplane icon, very large and centered, with bright access energy",
        heroFamily: "telegram-plane"
      }
    ]
  },
  {
    key: "mirror-bypass",
    matches: [/обход.*блокиров/, /способ.*обход/, /зеркал/, /mirror/, /working mirror/, /рабочее зеркало/],
    centralObject: "large luxurious real physical door with a solid door leaf, clear handle, visible thickness, and bright access light behind it",
    supportingElements: ["floating casino chips in mixed colors", "flying dollar bills", "gold sparkles", "bright jackpot light burst", "portal glow"],
    sceneHint: "access and unblock scene with a dramatic premium real door that clearly reads as a physical doorway, with a solid visible door leaf, visible handle, visible thickness, strong center light behind it, and obvious entry symbolism. It must not look like a portal ring, transparent arch, abstract neon frame, or glass doorway.",
    avoid: ["wallet", "slot machine", "roulette wheel", "supercar", "transparent door", "glass door", "portal ring", "neon arch"],
    heroBias: "object",
    scenePreset: "mirror-doorway",
    heroFamily: "casino-door",
    variants: [
      {
        centralObject: "large premium solid casino door with a visible handle, thick frame, and vivid access light behind it",
        heroFamily: "casino-door"
      },
      {
        centralObject: "bright glossy luxury door with a real door leaf, visible hinges or thickness, and clear mirror-access symbolism",
        heroFamily: "casino-door"
      }
    ]
  },
  {
    key: "slot-machines",
    matches: [/игровые автоматы/, /slots?/, /slot machine/, /fruit machine/, /автомат[ы]?/],
    centralObject: "large glossy slot machine or 777 slot reels as the clear main hero",
    supportingElements: ["floating casino chips in mixed colors", "flying dollar bills", "gold coins", "strong jackpot burst", "glowing sparkles"],
    sceneHint: "big slot-machine scene where the slot machine is unmistakably the main object, loud, vivid, and jackpot-driven",
    avoid: ["supercar", "wallet", "yacht", "support headset", "roulette wheel"],
    heroBias: "jackpot",
    scenePreset: "jackpot-777-or-gift",
    heroFamily: "slot-777",
    variants: [
      {
        centralObject: "large premium 777 slot machine filling most of the composition",
        heroFamily: "slot-777"
      },
      {
        centralObject: "large glossy slot reels in jackpot mode with visible 777 symbols",
        heroFamily: "slot-777"
      }
    ]
  },
  {
    key: "faq",
    matches: [/\bfaq\b/, /domande frequenti/, /fragen/, /frequently asked/, /preguntas frecuentes/, /sorular/, /вопрос/],
    centralObject: "large glossy 3D full question mark or premium help icon, fully visible above the future title plate",
    supportingElements: ["speech bubbles", "small info icons", "floating casino chips in mixed colors", "flying dollar bills", "gold sparkles"],
    sceneHint: "friendly but rich commercial FAQ scene with jackpot energy, bright backlight, and one clear help-focused hero object, with the full question mark fully visible above the lower title zone",
    avoid: ["shield", "padlock", "safe", "vault"],
    heroBias: "symbol",
    scenePreset: "faq-question-mark"
  },
  {
    key: "bonus",
    matches: [/bonus/, /promoz/, /promo/, /free spin/, /freespin/, /benvenuto/, /welcome/],
    centralObject: "premium gift box, glossy 777 slot machine, or jackpot token hero object",
    supportingElements: ["floating casino chips in mixed colors", "flying dollar bills", "shiny gold coins", "sparkles", "volumetric light rays"],
    sceneHint: "celebratory jackpot bonus scene with explosive motion, wealth symbols, and strong click appeal",
    avoid: ["question mark", "wallet", "plane"],
    heroBias: "jackpot",
    scenePreset: "jackpot-777-or-gift",
    heroFamily: "jackpot",
    variants: [
      {
        centralObject: "premium gift box exploding with casino rewards",
        heroFamily: "gift-box"
      },
      {
        centralObject: "glossy 777 slot machine or 777 reels in jackpot mode",
        heroFamily: "slot-777"
      },
      {
        centralObject: "luxury jackpot chest bursting open with coins and chips",
        heroFamily: "jackpot-chest"
      }
    ]
  },
  {
    key: "payment",
    matches: [/payment/, /pagament/, /withdraw/, /preliev/, /deposit/, /bank/, /wallet/, /crypto/, /metodi di pagamento/, /пополнени/, /вывод/, /депозит/, /счет/, /счета/, /средств/, /платеж/],
    centralObject: "premium stuffed leather wallet, elegant bank card stack, payout token, or open safe full of cash",
    supportingElements: ["gold coins", "flying dollar bills", "casino chips in mixed colors", "glow particles", "polished gold details"],
    sceneHint: "financial casino payout scene with visible wealth, confidence, and premium commercial energy. For deposit and withdrawal headings, strongly prefer a stuffed wallet, cashier object, bank card stack, or payout-safe hero, not a roulette wheel or generic game object.",
    avoid: ["question mark", "airplane", "gift box", "roulette wheel", "slot machine"],
    heroBias: "wealth-object",
    scenePreset: "wallet-cashout",
    heroFamily: "wealth-object",
    variants: [
      {
        centralObject: "premium stuffed leather wallet overflowing with cash",
        heroFamily: "wallet"
      },
      {
        centralObject: "open casino safe packed with money and chips",
        heroFamily: "safe"
      },
      {
        centralObject: "elegant bank card stack with payout energy and flying cash",
        heroFamily: "card-stack"
      },
      {
        centralObject: "premium cashier chip and payout token composition with visible money",
        heroFamily: "payout-token"
      }
    ]
  },
  {
    key: "mobile-app",
    matches: [/app\b/, /mobile/, /android/, /ios/, /smartphone/, /telefon/, /мобильн/, /приложени/, /смартфон/, /телефон/, /игра со смартфона/],
    centralObject: "large photorealistic flagship smartphone with a clearly visible bright casino screen showing slot reels, 777 symbols, jackpot win UI, free spins, poker cards, or roulette interface",
    supportingElements: ["floating casino chips in mixed colors", "flying dollar bills", "gold coins", "visible on-screen casino UI", "volumetric light rays"],
    sceneHint: "mobile-first casino ad scene with a realistic premium smartphone hero, a clearly readable casino screen, jackpot motion, and premium clickable energy. The phone must feel physically believable and modern, not fake or toy-like.",
    avoid: ["gift box", "question mark", "wallet"],
    heroBias: "device",
    scenePreset: "mobile-smartphone",
    heroFamily: "smartphone",
    variants: [
      {
        centralObject: "large realistic flagship smartphone with a clearly visible casino screen showing slot reels, 777 symbols, jackpot win UI, free spins, poker cards, or roulette interface",
        heroFamily: "smartphone"
      }
    ]
  },
  {
    key: "register-login",
    matches: [/register/, /registr/, /signup/, /sign up/, /login/, /log in/, /accesso/, /giriş/, /kayit/, /kayıt/],
    centralObject: "detailed glowing luxury door or entry portal into a casino world, with optional signup cues",
    supportingElements: ["floating casino chips in mixed colors", "flying dollar bills", "gold coins", "light rays", "premium win atmosphere"],
    sceneHint: "inviting registration or login ad scene led by a glowing door or entry portal, with status, jackpot energy, and clear access symbolism",
    avoid: ["question mark", "wallet", "plane"],
    heroBias: "object",
    scenePreset: "hostess-signup",
    heroFamily: "casino-door",
    variants: [
      {
        centralObject: "detailed glowing luxury casino door opening into a jackpot world",
        heroFamily: "casino-door"
      },
      {
        centralObject: "bright premium portal doorway with a rich luxury frame and visible signup energy",
        heroFamily: "casino-door"
      },
      {
        centralObject: "glamorous hostess standing next to a glowing casino entry portal",
        heroFamily: "casino-portal"
      }
    ]
  },
  {
    key: "games-software",
    matches: [/software/, /giochi/, /games?/, /jeux/, /providers?/, /slot/, /roulette/, /blackjack/, /bookmakers?/, /bookmaker/, /pari[s]?/, /paris sportifs?/],
    centralObject: "glossy 3D roulette wheel, premium slot reels, game globe, VIP cards fan, or jackpot prop",
    supportingElements: ["floating casino chips in mixed colors", "realistic mixed-suit playing cards", "flying dollar bills", "gold sparkles", "radial light rays"],
    sceneHint: "rich casino gaming scene with a strong hero object, varied authentic props, and luxurious ad energy",
    avoid: ["question mark", "wallet", "support icon"],
    heroBias: "game-object",
    scenePreset: "casino-games-portal",
    heroFamily: "game-object",
    variants: [
      {
        centralObject: "glossy 3D roulette wheel with premium casino shine",
        heroFamily: "roulette"
      },
      {
        centralObject: "premium slot reels or slot machine with visible 777 symbols",
        heroFamily: "slot-777"
      },
      {
        centralObject: "VIP cards fan with realistic mixed suits and jackpot energy",
        heroFamily: "vip-cards"
      },
      {
        centralObject: "luxury casino portal packed with game symbols",
        heroFamily: "casino-portal"
      }
    ]
  },
  {
    key: "support",
    matches: [/support/, /assistenza/, /help/, /customer service/, /chat live/, /live chat/, /поддержк/, /оператор/, /служб[аы] поддержки/],
    centralObject: "glamorous support operator woman with headset and microphone in a premium casino support scene",
    supportingElements: ["chips", "small live-chat UI cues", "sparkles", "cash", "premium support mood"],
    sceneHint: "support and trust scene led by a glamorous support operator woman, warm, energetic, visually inviting, and clearly customer-help focused",
    avoid: ["padlock", "question mark", "gift box"],
    heroBias: "hostess",
    scenePreset: "support-hostess",
    heroFamily: "hostess",
    variants: [
      {
        centralObject: "glamorous support operator woman with headset and microphone, premium casino support mood",
        heroFamily: "hostess",
        heroBias: "hostess"
      },
      {
        centralObject: "friendly support operator woman with headset, microphone, and visible live-chat support energy",
        heroFamily: "hostess",
        heroBias: "hostess"
      }
    ]
  },
  {
    key: "sports-betting",
    matches: [/sport/, /esport/, /cybersport/, /киберспорт/, /спорт/, /ставк[аи]/],
    centralObject: "premium sportsbook hero scene with a football or esports trophy icon, live odds screen, or betting smartphone interface",
    supportingElements: ["floating casino chips in mixed colors", "cash", "gold sparkles", "live odds glow", "sportsbook energy"],
    sceneHint: "sports betting scene with a clear sportsbook focus instead of slots or roulette, still premium and exciting",
    avoid: ["slot machine", "777 reels", "roulette wheel"],
    heroBias: "device",
    scenePreset: "mobile-smartphone",
    heroFamily: "sportsbook",
    variants: [
      {
        centralObject: "large glossy smartphone with a clearly visible sportsbook screen, live odds, and sports betting UI",
        heroFamily: "sportsbook-phone"
      },
      {
        centralObject: "premium football hero object with sportsbook energy and betting interface accents",
        heroFamily: "sportsbook-ball"
      },
      {
        centralObject: "esports trophy or game-controller hero with visible sportsbook odds and win energy",
        heroFamily: "sportsbook-esports"
      }
    ]
  },
  {
    key: "security",
    matches: [/security/, /safe/, /sicur/, /secure/, /trust/, /affidabil/],
    centralObject: "premium safe badge, secure casino emblem, or trusted verification symbol",
    supportingElements: ["chips", "subtle light rays", "cash", "sparkles"],
    sceneHint: "trustworthy premium scene with safety as the focus, but still commercial and appealing",
    avoid: ["question mark", "airplane", "gift box"],
    heroBias: "symbol",
    scenePreset: "security-symbol",
    heroFamily: "security"
  },
  {
    key: "air-travel",
    matches: [/travel/, /trip/, /plane/, /voli/, /aereo/],
    centralObject: "glossy private jet or luxury airplane",
    supportingElements: ["floating casino chips in mixed colors", "flying dollar bills", "gold coins", "sparkles"],
    sceneHint: "luxury travel and excitement scene with aspirational jackpot energy",
    avoid: ["shield", "wallet", "question mark"],
    heroBias: "lifestyle",
    scenePreset: "private-jet-luxury",
    heroFamily: "private-jet"
  },
  {
    key: "best-list-ranking",
    matches: [/top\s*\d+/, /best/, /migliori/, /lista/, /ranking/, /classifica/, /лучш/],
    centralObject: "white yacht, sports car, gold trophy, luxury jackpot chest, or glamorous casino character",
    supportingElements: ["floating casino chips in mixed colors", "flying dollar bills", "gold coins", "sparkles", "volumetric light rays"],
    sceneHint: "aspirational luxury ranking scene with premium lifestyle energy and a strong click-driving focal object",
    avoid: ["question mark", "padlock", "support headset"],
    heroBias: "object",
    scenePreset: "ranking-hostess-or-supercar",
    heroFamily: "ranking-object",
    variants: [
      {
        centralObject: "white yacht in a premium casino lifestyle scene",
        heroFamily: "yacht"
      },
      {
        centralObject: "white supercar in a luxury recommendation scene",
        heroFamily: "supercar"
      },
      {
        centralObject: "glamorous casino character with loose hair and luxury recommendation energy",
        heroFamily: "hostess"
      },
      {
        centralObject: "luxury jackpot chest with elite ranking energy",
        heroFamily: "jackpot-chest"
      },
      {
        centralObject: "glossy 777 slot machine with recommendation energy",
        heroFamily: "slot-777"
      },
      {
        centralObject: "premium roulette ring with star-ranking energy",
        heroFamily: "roulette"
      }
    ]
  },
  {
    key: "benefits-overview",
    matches: [/warum/, /why/, /vorteile/, /benefits/, /warum spielen/, /what makes/, /was macht/],
    centralObject: "glamorous casino hostess, gold roulette ring, luxury jackpot portal, or glossy 777 machine",
    supportingElements: ["floating casino chips in mixed colors", "flying dollar bills", "gold coins", "sparkles", "volumetric light rays"],
    sceneHint: "broad high-energy casino overview scene that sells excitement, glamour, and reasons to join",
    avoid: ["question mark", "padlock", "bank form"],
    heroBias: "object",
    scenePreset: "overview-luxury-hostess",
    heroFamily: "overview-object",
    variants: [
      {
        centralObject: "gold roulette ring with premium jackpot energy",
        heroFamily: "roulette"
      },
      {
        centralObject: "glamorous casino character with loose hair and premium overview energy",
        heroFamily: "hostess"
      },
      {
        centralObject: "luxury casino portal with chips and money bursting out",
        heroFamily: "casino-portal"
      },
      {
        centralObject: "glossy 777 slot machine with high-energy recommendation mood",
        heroFamily: "slot-777"
      }
    ]
  }
];

function pickVariant(rule, recentHeroHistory, headerText = "") {
  const variants = rule.variants?.length ? rule.variants : [{
    centralObject: rule.centralObject,
    supportingElements: rule.supportingElements,
    sceneHint: rule.sceneHint,
    avoid: rule.avoid,
    heroBias: rule.heroBias,
    heroFamily: rule.heroFamily,
    scenePreset: rule.scenePreset
  }];

  const recent = Array.isArray(recentHeroHistory) ? recentHeroHistory.slice(-6) : [];
  const rotationSeed = stableHash(String(headerText || rule.key || ""));
  let best = variants[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const [index, variant] of variants.entries()) {
    const family = variant.heroFamily || rule.heroFamily || "game-object";
    const count = recent.filter((item) => item === family).length;
    const lastPenalty = recent[recent.length - 1] === family ? 5 : 0;
    const secondLastPenalty = recent[recent.length - 2] === family ? 2 : 0;
    const countPenalty = count * 5;
    const repetitionPenalty =
      (family === "wallet" && count >= 1 ? 8 : 0) +
      (family === "roulette" && count >= 1 ? 5 : 0) +
      (family === "headset" ? 4 : 0);
    const basePenalty =
      (family === "wallet" ? 2.5 : 0) +
      (family === "roulette" ? 1.5 : 0);
    const tieBreak = ((rotationSeed + index) % Math.max(variants.length, 1)) * 0.01;
    const score = countPenalty + repetitionPenalty + lastPenalty + secondLastPenalty + basePenalty + tieBreak;

    if (score < bestScore) {
      bestScore = score;
      best = variant;
    }
  }

  return best;
}

function stableHash(value) {
  let hash = 0;
  for (const char of String(value || "")) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function buildDefaultScenePreset(heroBias) {
  switch (heroBias) {
    case "hostess":
      return "hostess-signup";
    case "device":
      return "mobile-smartphone";
    case "jackpot":
      return "jackpot-777-or-gift";
    case "wealth-object":
      return "wallet-cashout";
    case "game-object":
      return "casino-games-portal";
    case "lifestyle":
      return "ranking-hostess-or-supercar";
    case "symbol":
      return "faq-question-mark";
    default:
      return "casino-games-portal";
  }
}
