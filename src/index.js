import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Telegraf, Markup } from "telegraf";
import { config } from "./config.js";
import { SessionStore } from "./session-store.js";
import { isSupportedDocumentUrl, loadDocument, loadDocumentFromBuffer } from "./document-loader.js";
import { buildReferenceImageSignals, fetchSiteSignals } from "./site-signals.js";
import { buildImagePrompt, buildStyleProfile } from "./openai-client.js";
import { mapHeaderToConcept } from "./concept-mapper.js";
import { generateImage } from "./kie-client.js";
import { composeBanner } from "./compositor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, "../output");
const bot = new Telegraf(config.telegramBotToken);
const sessions = new SessionStore();
const localRenderLimiter = createLimiter(Math.max(1, config.localRenderConcurrency));

await fs.mkdir(outputDir, { recursive: true });
await bot.telegram.deleteWebhook({ drop_pending_updates: false });

bot.start(async (ctx) => {
  clearReviewTimeout(sessions.get(ctx.chat.id));
  sessions.reset(ctx.chat.id);
  await ctx.reply("Пришли ссылку на документ. Это может быть Google Doc или публичная ссылка на Word/OneDrive документ. Я вытащу заголовки, потом попрошу референс-картинку стиля и запущу генерацию баннеров.");
});

bot.command("reset", async (ctx) => {
  clearReviewTimeout(sessions.get(ctx.chat.id));
  sessions.reset(ctx.chat.id);
  await ctx.reply("Сессию сбросил. Пришли новую ссылку на документ.");
});

bot.on("text", async (ctx) => {
  const session = sessions.get(ctx.chat.id);
  const text = (ctx.message.text || "").trim();

  if (session.isBusy && session.mode !== "generating") {
    await ctx.reply("Сейчас уже обрабатываю предыдущий шаг. Дай мне немного времени.");
    return;
  }

  if (isSupportedDocumentUrl(text)) {
    queueBackground(async () => {
      await handleDocument(ctx, text, session);
    });
    return;
  }

  if (session.mode === "awaiting_reference_image") {
    await ctx.reply(
      "Сайт больше не использую как главный источник стиля. Пришли референс-картинку одним сообщением или нажми `Пропустить`.",
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("Пропустить", "skip_reference")]
        ])
      }
    );
    return;
  }

  if (session.pendingFeedbackIndex !== null) {
    const index = session.pendingFeedbackIndex;
    const state = ensureBannerState(session, index);
    state.feedback = text;
    state.status = "queued";
    state.messageId = null;
    session.pendingFeedbackIndex = null;
    session.mode = "generating";
    enqueueBanner(session, index, true);
    await ctx.reply(`Принял правки. Перегенерирую баннер ${index + 1}.`);
    queueBackground(async () => {
      await pumpGenerationQueue(ctx, session);
    });
    return;
  }

  await ctx.reply("Жду ссылку на документ. Если нужно начать заново, отправь /reset.");
});

bot.on("photo", async (ctx) => {
  const session = sessions.get(ctx.chat.id);
  if (session.mode !== "awaiting_reference_image") {
    return;
  }

  if (session.isBusy) {
    await ctx.reply("Сейчас уже обрабатываю предыдущий шаг. Дай мне немного времени.");
    return;
  }

  queueBackground(async () => {
    await handleReferencePhoto(ctx, ctx.message.photo, session);
  });
});

bot.on("document", async (ctx) => {
  const session = sessions.get(ctx.chat.id);
  const document = ctx.message.document;

  if (session.mode === "awaiting_reference_image" && isSupportedReferenceImageDocument(document)) {
    if (session.isBusy) {
      await ctx.reply("Сейчас уже обрабатываю предыдущий шаг. Дай мне немного времени.");
      return;
    }

    queueBackground(async () => {
      await handleReferenceImageDocument(ctx, document, session);
    });
    return;
  }

  if (session.isBusy) {
    await ctx.reply("Сейчас уже обрабатываю предыдущий шаг. Дай мне немного времени.");
    return;
  }

  if (!isSupportedTelegramDocument(document)) {
    await ctx.reply("Пока могу принять из файлов только `.docx`. Либо пришли `.docx` сюда, либо ссылку на документ.", {
      parse_mode: "Markdown"
    });
    return;
  }

  queueBackground(async () => {
    await handleTelegramDocument(ctx, document, session);
  });
});

bot.on("callback_query", async (ctx) => {
  const session = sessions.get(ctx.chat.id);
  const rawAction = ctx.callbackQuery.data;
  const [action, indexText] = String(rawAction || "").split("|");
  const bannerIndex = Number.isInteger(Number(indexText)) ? Number(indexText) : null;
  await ctx.answerCbQuery("Принято");

  if (session.mode === "awaiting_reference_image") {
    if (action === "skip_reference") {
      session.referenceImageSignals = null;
      await ctx.reply("Ок, тогда соберу стиль по статье и вложенным изображениям.");
      queueBackground(async () => {
        await finalizeDocumentContext(ctx, session);
      });
      return;
    }
  }

  if (!session.headers.length) {
    await ctx.reply("Сейчас нет активной генерации. Пришли ссылку на документ.");
    return;
  }

  if (bannerIndex === null || Number.isNaN(bannerIndex)) {
    return;
  }

  const state = ensureBannerState(session, bannerIndex);
  if (!state) {
    return;
  }

  if (action === "retry") {
    state.status = "awaiting_feedback";
    session.pendingFeedbackIndex = bannerIndex;
    session.mode = "awaiting_feedback";
    await deleteBannerMessage(ctx, state.messageId);
    state.messageId = null;
    await ctx.reply(`Напиши одним сообщением, что именно исправить в баннере ${bannerIndex + 1}.`);
  }
});

bot.launch();
console.log("Local banner bot is running");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

async function handleDocument(ctx, docUrl, session) {
  clearReviewTimeout(session);
  session.isBusy = true;
  session.mode = "parsing";

  try {
    const doc = await loadDocument(docUrl);

    if (!doc.headings.length) {
      throw new Error("В документе не нашел H1/H2. Проверь стили заголовков или структуру документа.");
    }

    session.doc = doc;
    session.headers = doc.headings;
    session.currentIndex = 0;
    session.feedback = "";
    session.providedSiteUrl = "";
    session.reviewToken = 0;
    session.recentHeroHistory = [];
    session.headerConcepts = {};
    session.pendingFeedbackIndex = null;
    session.bannerStates = {};
    session.generationQueue = [];
    session.activeGenerations = 0;
    session.completionAnnounced = false;
    session.referenceImageSignals = null;
    session.mode = "awaiting_reference_image";

    await ctx.reply(
      `Нашел ${doc.headings.length} заголовков.\nПришли референс-картинку стиля одним сообщением. Если ее нет, нажми «Пропустить».`,
      Markup.inlineKeyboard([
        [Markup.button.callback("Пропустить", "skip_reference")]
      ])
    );
  } catch (error) {
    session.mode = "awaiting_doc";
    await ctx.reply(`Не получилось обработать документ: ${error.message}`);
  } finally {
    session.isBusy = false;
  }
}

async function handleTelegramDocument(ctx, telegramDocument, session) {
  clearReviewTimeout(session);
  session.isBusy = true;
  session.mode = "parsing";

  try {
    const fileLink = await ctx.telegram.getFileLink(telegramDocument.file_id);
    const response = await fetch(fileLink.toString());

    if (!response.ok) {
      throw new Error(`Не получилось скачать файл из Telegram (${response.status}).`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const doc = await loadDocumentFromBuffer(buffer, telegramDocument.file_name || "telegram-document.docx");

    if (!doc.headings.length) {
      throw new Error("В документе не нашел H1/H2. Проверь стили заголовков или структуру документа.");
    }

    session.doc = doc;
    session.headers = doc.headings;
    session.currentIndex = 0;
    session.feedback = "";
    session.providedSiteUrl = "";
    session.reviewToken = 0;
    session.recentHeroHistory = [];
    session.headerConcepts = {};
    session.pendingFeedbackIndex = null;
    session.bannerStates = {};
    session.generationQueue = [];
    session.activeGenerations = 0;
    session.completionAnnounced = false;
    session.referenceImageSignals = null;
    session.mode = "awaiting_reference_image";

    await ctx.reply(
      `Нашел ${doc.headings.length} заголовков.\nПришли референс-картинку стиля одним сообщением. Если ее нет, нажми «Пропустить».`,
      Markup.inlineKeyboard([
        [Markup.button.callback("Пропустить", "skip_reference")]
      ])
    );
  } catch (error) {
    session.mode = "awaiting_doc";
    await ctx.reply(`Не получилось обработать файл документа: ${error.message}`);
  } finally {
    session.isBusy = false;
  }
}

async function handleReferencePhoto(ctx, photos, session) {
  clearReviewTimeout(session);
  session.isBusy = true;
  session.mode = "parsing";
  let shouldFinalize = false;

  try {
    const largestPhoto = [...(photos || [])].sort((a, b) => (b.file_size || 0) - (a.file_size || 0))[0];
    if (!largestPhoto) {
      throw new Error("Не получилось прочитать референс-картинку из Telegram.");
    }

    const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);
    const response = await fetch(fileLink.toString());
    if (!response.ok) {
      throw new Error(`Не получилось скачать референс-картинку (${response.status}).`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    session.referenceImageSignals = await buildReferenceImageSignals(buffer, "telegram-photo");
    shouldFinalize = true;
    await ctx.reply("Принял референс-картинку. Запускаю серию в этом стиле.");
  } catch (error) {
    session.mode = "awaiting_reference_image";
    await ctx.reply(`Не получилось обработать референс-картинку: ${error.message}`);
  } finally {
    session.isBusy = false;
  }

  if (shouldFinalize) {
    queueBackground(async () => {
      await finalizeDocumentContext(ctx, session);
    });
  }
}

async function handleReferenceImageDocument(ctx, telegramDocument, session) {
  clearReviewTimeout(session);
  session.isBusy = true;
  session.mode = "parsing";
  let shouldFinalize = false;

  try {
    const fileLink = await ctx.telegram.getFileLink(telegramDocument.file_id);
    const response = await fetch(fileLink.toString());

    if (!response.ok) {
      throw new Error(`Не получилось скачать референс-картинку (${response.status}).`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    session.referenceImageSignals = await buildReferenceImageSignals(buffer, telegramDocument.file_name || "reference-image");
    shouldFinalize = true;
    await ctx.reply("Принял референс-картинку. Запускаю серию в этом стиле.");
  } catch (error) {
    session.mode = "awaiting_reference_image";
    await ctx.reply(`Не получилось обработать референс-картинку: ${error.message}`);
  } finally {
    session.isBusy = false;
  }

  if (shouldFinalize) {
    queueBackground(async () => {
      await finalizeDocumentContext(ctx, session);
    });
  }
}

async function finalizeDocumentContext(ctx, session) {
  if (session.isBusy || !session.doc) {
    return;
  }

  session.isBusy = true;
  session.mode = "parsing";

  try {
    const styleSignals = session.referenceImageSignals || await fetchSiteSignals(session.doc, "");
    const styleProfile = await buildStyleProfile(session.doc, styleSignals);
    console.log("[style] styleSignals", JSON.stringify(styleSignals, null, 2));
    console.log("[style] styleProfile", JSON.stringify(styleProfile, null, 2));
    console.log("[style] theme", JSON.stringify(styleProfile.theme || {}, null, 2));

    session.styleProfile = styleProfile;
    session.mode = "generating";
    session.headerConcepts = planHeaderConcepts(session.headers);
    session.bannerStates = Object.fromEntries(
      session.headers.map((header) => [header.index, createBannerState()])
    );
    session.generationQueue = session.headers.map((header) => header.index);
    session.activeGenerations = 0;
    session.completionAnnounced = false;

    await ctx.reply(`Генерация запущена. Готовые баннеры буду присылать по мере готовности.`);
  } catch (error) {
    session.mode = "awaiting_doc";
    await ctx.reply(`Не получилось подготовить стиль бренда: ${error.message}`);
  } finally {
    session.isBusy = false;
  }

  if (session.mode === "generating") {
    queueBackground(async () => {
      await pumpGenerationQueue(ctx, session);
    });
  }
}

async function pumpGenerationQueue(ctx, session) {
  const concurrencyLimit = config.remoteGenerationConcurrency > 0
    ? Math.max(1, Math.min(session.headers.length || 1, config.remoteGenerationConcurrency))
    : Math.max(1, session.headers.length || 1);

  while (session.activeGenerations < concurrencyLimit && session.generationQueue.length) {
    const index = session.generationQueue.shift();
    const state = ensureBannerState(session, index);
    if (!state || state.status === "approved" || state.status === "review" || state.status === "generating") {
      continue;
    }

    session.activeGenerations += 1;
    state.status = "generating";
    queueBackground(async () => {
      try {
        await generateBannerByIndex(ctx, session, index);
      } finally {
        session.activeGenerations = Math.max(0, session.activeGenerations - 1);
        await maybeFinishSession(ctx, session);
        await pumpGenerationQueue(ctx, session);
      }
    });
  }
}

async function generateBannerByIndex(ctx, session, index) {
  const header = session.headers[index];
  const state = ensureBannerState(session, index);
  if (!header || !state) {
    return;
  }

  try {
    const aspectRatio = header.type === "H1" ? "4:3" : "1:1";
    console.log(`[banner] start ${index + 1}/${session.headers.length}: ${header.text}`);

    const imagePrompt = await buildImagePrompt({
      header,
      styleProfile: session.styleProfile,
      feedback: state.feedback || "",
      recentHeroHistory: session.recentHeroHistory || [],
      concept: session.headerConcepts?.[index] || null
    });

    const generated = await generateImage(imagePrompt, aspectRatio);
    let sentFilePath = "";
    await localRenderLimiter.run(async () => {
      const finalBanner = await composeBanner({
        imageBuffer: generated.imageBuffer,
        header,
        styleProfile: session.styleProfile,
        concept: session.headerConcepts?.[index] || null
      });

      const filePath = await saveBanner(ctx.chat.id, index, finalBanner);
      sentFilePath = filePath;
      state.filePath = filePath;
      state.status = "accepted";
      state.feedback = "";
      session.currentRenderPath = filePath;
      session.recentHeroHistory = pushHeroHistory(
        session.recentHeroHistory,
        session.headerConcepts?.[index]?.heroFamily || header.text
      );

      const sent = await ctx.replyWithDocument(
        {
          source: finalBanner,
          filename: `banner-${header.type}-${index + 1}.png`
        },
        {
          caption: [
            `Баннер: ${index + 1}/${session.headers.length}`,
            `Тип: ${header.type}`,
            `Заголовок: ${header.text}`,
            `Размер: ${header.target_width}x${header.target_height}`,
            "",
            "Если нужно, можно отправить на переделку."
          ].join("\n"),
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔄 Переделать", `retry|${index}`)]
          ])
        }
      );

      state.messageId = sent.message_id;
    });
    console.log(`[banner] sent ${sentFilePath}`);
  } catch (error) {
    state.status = "error";
    console.error("[banner] generation error", error);
    await ctx.reply(`Ошибка на генерации баннера ${index + 1}: ${error.message}`);
  }
}

async function saveBanner(chatId, index, buffer) {
  const dir = path.join(outputDir, String(chatId));
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${Date.now()}-${index + 1}.png`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

function isWebsiteUrl(text) {
  return /^https?:\/\//.test(text) && !isSupportedDocumentUrl(text);
}

function normalizeWebsiteUrl(text) {
  const value = String(text).trim();
  if (!value) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  if (isSupportedDocumentUrl(withProtocol)) {
    return "";
  }

  try {
    const url = new URL(withProtocol);
    return url.hostname ? url.toString() : "";
  } catch {
    return "";
  }
}

function isSupportedTelegramDocument(document) {
  const fileName = String(document?.file_name || "").toLowerCase();
  const mimeType = String(document?.mime_type || "").toLowerCase();

  return (
    fileName.endsWith(".docx") ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function isSupportedReferenceImageDocument(document) {
  const fileName = String(document?.file_name || "").toLowerCase();
  const mimeType = String(document?.mime_type || "").toLowerCase();

  return (
    mimeType.startsWith("image/") ||
    fileName.endsWith(".png") ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg") ||
    fileName.endsWith(".webp")
  );
}

function queueBackground(task) {
  setImmediate(() => {
    task().catch((error) => {
      console.error("[background] task failed", error);
    });
  });
}

function pushHeroHistory(history, headerText) {
  const value = String(headerText || "");
  const normalized = /^[a-z0-9-]+$/i.test(value)
    ? value
    : mapHeaderToConcept(value, history || []).heroFamily || classifyHeroFamily(value);
  const next = [...(history || []), normalized];
  return next.slice(-4);
}

function planHeaderConcepts(headers) {
  const concepts = {};
  let simulatedHistory = [];

  for (const header of headers) {
    const concept = mapHeaderToConcept(header.text, simulatedHistory);
    concepts[header.index] = concept;
    simulatedHistory = pushHeroHistory(simulatedHistory, concept.heroFamily || header.text);
  }

  return concepts;
}

function classifyHeroFamily(headerText) {
  const text = String(headerText || "").toLowerCase();

  if (/faq|frage|question|вопрос/.test(text)) return "symbol";
  if (/telegram|телеграм|телега|тг-бот|tg bot/.test(text)) return "telegram-plane";
  if (/register|registr|signup|login|accesso|giriş|kayit|kayıt/.test(text)) return "hostess";
  if (/mobile|app|android|ios|smartphone|telefon|мобильн|приложени|смартфон|телефон/.test(text)) return "device";
  if (/payment|pagament|withdraw|preliev|deposit|wallet|bank|crypto|пополнени|вывод|депозит|счет|счета|средств|платеж/.test(text)) return "wealth-object";
  if (/bonus|promo|free spin|freespin|welcome|benvenuto/.test(text)) return "jackpot";
  if (/support|assistenza|help|customer service|chat live|live chat|поддержк|оператор|служб[аы] поддержки/.test(text)) return "hostess";
  if (/slot|roulette|blackjack|games|giochi|software|providers?|игровые автоматы|слоты|автомат/.test(text)) return "game-object";
  if (/top|best|ranking|lista|classifica|warum|why|vorteile|benefits|лучш/.test(text)) return "lifestyle";
  return "game-object";
}

function clearReviewTimeout(session) {
  // legacy hook kept for reset/start compatibility
}

function ensureBannerState(session, index) {
  if (!session.bannerStates[index]) {
    session.bannerStates[index] = createBannerState();
  }
  return session.bannerStates[index];
}

function createBannerState() {
  return {
    status: "queued",
    feedback: "",
    messageId: null,
    filePath: ""
  };
}

function enqueueBanner(session, index, priority = false) {
  session.generationQueue = session.generationQueue.filter((item) => item !== index);
  if (priority) {
    session.generationQueue.unshift(index);
  } else {
    session.generationQueue.push(index);
  }
}

async function deleteBannerMessage(ctx, messageId) {
  if (!messageId) {
    return;
  }

  try {
    await ctx.telegram.deleteMessage(ctx.chat.id, messageId);
  } catch {
    // ignore if already removed
  }
}

async function maybeFinishSession(ctx, session) {
  const states = Object.values(session.bannerStates || {});
  if (!states.length) {
    return;
  }

  const allDone = states.every((state) => state.status === "accepted");
  if (!allDone || session.activeGenerations > 0 || session.generationQueue.length > 0 || session.pendingFeedbackIndex !== null) {
    return;
  }

  if (session.completionAnnounced) {
    return;
  }

  session.completionAnnounced = true;
  session.mode = "awaiting_doc";
  session.headers = [];
  await ctx.reply("Готово. Все баннеры по документу обработаны.");
}

function createLimiter(limit) {
  let active = 0;
  const queue = [];

  async function run(task) {
    if (active >= limit) {
      await new Promise((resolve) => queue.push(resolve));
    }

    active += 1;
    try {
      return await task();
    } finally {
      active = Math.max(0, active - 1);
      const next = queue.shift();
      if (next) {
        next();
      }
    }
  }

  return { run };
}
