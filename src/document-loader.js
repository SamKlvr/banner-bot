import mammoth from "mammoth";
import { loadGoogleDoc } from "./google-docs.js";
import { config } from "./config.js";

let microsoftTokenCache = {
  accessToken: "",
  expiresAt: 0
};

export async function loadDocument(docUrl) {
  if (isGoogleDocUrl(docUrl)) {
    return loadGoogleDoc(docUrl);
  }

  if (isDocxLikeUrl(docUrl)) {
    return loadDocxDocument(docUrl);
  }

  throw new Error("Поддерживаются Google Docs и публичные ссылки на Word/docx документы.");
}

export async function loadDocumentFromBuffer(buffer, fileName = "document.docx") {
  if (!looksLikeZip(buffer)) {
    throw new Error("Файл не похож на .docx документ.");
  }

  return parseDocxBuffer(buffer, fileName);
}

export function isSupportedDocumentUrl(text) {
  return isGoogleDocUrl(text) || isDocxLikeUrl(text);
}

function isGoogleDocUrl(text) {
  return /docs\.google\.com\/document/i.test(String(text || ""));
}

function isDocxLikeUrl(text) {
  const value = String(text || "").trim();
  return /onedrive\.live\.com/i.test(value) || /1drv\.ms/i.test(value) || /\.docx(\?|$)/i.test(value);
}

async function loadDocxDocument(docUrl) {
  const buffer = await downloadDocxBuffer(docUrl);
  return parseDocxBuffer(buffer, docUrl);
}

async function parseDocxBuffer(buffer, documentId) {
  const [{ value: html }, { value: rawText }] = await Promise.all([
    mammoth.convertToHtml({ buffer }),
    mammoth.extractRawText({ buffer })
  ]);

  const content = normalizeWhitespace(rawText);
  const headings = extractHeadingsFromHtml(html).length
    ? extractHeadingsFromHtml(html)
    : inferHeadingsFromText(rawText);
  const links = extractUrls(`${rawText}\n${html}`);

  if (!headings.length && content) {
    const fallbackTitle = splitParagraphs(rawText)[0] || "Document";
    headings.push(createHeading(fallbackTitle, 0, "H1"));
  }

  return {
    documentId,
    title: headings[0]?.text || extractTitleFromHtml(html) || "Word Document",
    content,
    headings,
    links,
    mediaLinks: []
  };
}

async function downloadDocxBuffer(inputUrl) {
  if (isMicrosoftShareUrl(inputUrl)) {
    try {
      const graphBuffer = await downloadMicrosoftSharedDocx(inputUrl);
      if (graphBuffer) {
        return graphBuffer;
      }
    } catch (error) {
      if (error?.code === "MICROSOFT_GRAPH_NOT_CONFIGURED") {
        throw error;
      }
      if (error?.code !== "ONEDRIVE_BLOCKED") {
        throw error;
      }
    }
  }

  const candidates = buildDownloadCandidates(inputUrl);
  let lastBlockedError = null;

  for (const candidate of candidates) {
    try {
      const result = await tryFetchDocx(candidate);
      if (result) {
        return result;
      }
    } catch (error) {
      if (error?.code === "ONEDRIVE_BLOCKED") {
        lastBlockedError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastBlockedError) {
    throw lastBlockedError;
  }

  throw new Error("Не получилось скачать Word-документ по ссылке. Нужна публичная ссылка на .docx или OneDrive-документ.");
}

function buildDownloadCandidates(inputUrl) {
  const candidates = new Set();
  const original = String(inputUrl).trim();
  candidates.add(original);

  try {
    const url = new URL(original);
    url.searchParams.set("download", "1");
    candidates.add(url.toString());
  } catch {
    return [...candidates];
  }

  return [...candidates];
}

async function tryFetchDocx(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 local-banner-bot"
    }
  });

  if (response.status === 403 && /onedrive|1drv/i.test(url)) {
    const error = new Error("Microsoft блокирует автоматическое скачивание по этой OneDrive share-ссылке. Нужна прямая ссылка на скачивание .docx, сам .docx файл или Google Doc.");
    error.code = "ONEDRIVE_BLOCKED";
    throw error;
  }

  if (!response.ok) {
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (looksLikeZip(buffer) && looksLikeDocxResponse(response)) {
    return buffer;
  }

  if (looksLikeZip(buffer)) {
    return buffer;
  }

  const html = buffer.toString("utf8");
  const discoveredUrl = extractEmbeddedDocxUrl(html);
  if (discoveredUrl) {
    return tryFetchDocx(discoveredUrl);
  }

  return null;
}

async function downloadMicrosoftSharedDocx(shareUrl) {
  const accessToken = await getMicrosoftGraphAccessToken();
  if (!accessToken) {
    const error = new Error("Для ссылок 1drv.ms/OneDrive нужен Microsoft Graph токен или client credentials. Личный логин и пароль от live.com не нужны.");
    error.code = "MICROSOFT_GRAPH_NOT_CONFIGURED";
    throw error;
  }

  const shareId = encodeMicrosoftShareId(shareUrl);
  const metadataUrl = `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`;
  const metadataResponse = await fetch(metadataUrl, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      "user-agent": "Mozilla/5.0 local-banner-bot"
    }
  });

  if (metadataResponse.status === 401 || metadataResponse.status === 403) {
    const error = new Error("Microsoft Graph отклонил доступ к shared OneDrive ссылке. Проверь токен/права приложения.");
    error.code = "ONEDRIVE_BLOCKED";
    throw error;
  }

  if (!metadataResponse.ok) {
    const error = new Error(`Не получилось получить метаданные OneDrive файла (${metadataResponse.status}).`);
    error.code = "ONEDRIVE_BLOCKED";
    throw error;
  }

  const metadata = await metadataResponse.json();
  const fileName = String(metadata?.name || "");
  const mimeType = String(metadata?.file?.mimeType || "");
  if (!/\.docx$/i.test(fileName) && !/wordprocessingml\.document/i.test(mimeType)) {
    const error = new Error("OneDrive shared item не выглядит как .docx документ.");
    error.code = "ONEDRIVE_BLOCKED";
    throw error;
  }

  const contentUrl = `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem/content`;
  const response = await fetch(contentUrl, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      "user-agent": "Mozilla/5.0 local-banner-bot"
    },
    redirect: "follow"
  });

  if (!response.ok) {
    const error = new Error(`Не получилось скачать OneDrive документ через Microsoft Graph (${response.status}).`);
    error.code = "ONEDRIVE_BLOCKED";
    throw error;
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!looksLikeZip(buffer)) {
    const error = new Error("Microsoft Graph вернул ответ, который не похож на .docx файл.");
    error.code = "ONEDRIVE_BLOCKED";
    throw error;
  }

  return buffer;
}

function encodeMicrosoftShareId(shareUrl) {
  return `u!${Buffer.from(String(shareUrl || "").trim(), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")}`;
}

function isMicrosoftShareUrl(text) {
  const value = String(text || "").trim();
  return /1drv\.ms/i.test(value) || /onedrive\.live\.com/i.test(value);
}

async function getMicrosoftGraphAccessToken() {
  if (config.microsoftGraphAccessToken) {
    return config.microsoftGraphAccessToken;
  }

  if (config.microsoftRefreshToken && config.microsoftClientId) {
    const delegatedToken = await refreshMicrosoftDelegatedToken();
    if (delegatedToken) {
      return delegatedToken;
    }
  }

  if (!config.microsoftTenantId || !config.microsoftClientId || !config.microsoftClientSecret) {
    return "";
  }

  if (microsoftTokenCache.accessToken && Date.now() < microsoftTokenCache.expiresAt) {
    return microsoftTokenCache.accessToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(config.microsoftTenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: config.microsoftClientId,
    client_secret: config.microsoftClientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials"
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    return "";
  }

  const json = await response.json();
  const accessToken = String(json?.access_token || "");
  const expiresIn = Number(json?.expires_in || 3600);
  if (!accessToken) {
    return "";
  }

  microsoftTokenCache = {
    accessToken,
    expiresAt: Date.now() + Math.max(60, expiresIn - 120) * 1000
  };

  return accessToken;
}

async function refreshMicrosoftDelegatedToken() {
  if (microsoftTokenCache.accessToken && Date.now() < microsoftTokenCache.expiresAt) {
    return microsoftTokenCache.accessToken;
  }

  const tenant = config.microsoftTenantId || "consumers";
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: config.microsoftClientId,
    refresh_token: config.microsoftRefreshToken,
    grant_type: "refresh_token",
    scope: config.microsoftScopes
  });

  if (config.microsoftClientSecret) {
    body.set("client_secret", config.microsoftClientSecret);
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    return "";
  }

  const json = await response.json();
  const accessToken = String(json?.access_token || "");
  const expiresIn = Number(json?.expires_in || 3600);
  if (!accessToken) {
    return "";
  }

  microsoftTokenCache = {
    accessToken,
    expiresAt: Date.now() + Math.max(60, expiresIn - 120) * 1000
  };

  return accessToken;
}

function looksLikeZip(buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function looksLikeDocxResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const disposition = response.headers.get("content-disposition") || "";

  return (
    /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/i.test(contentType) ||
    /\.docx/i.test(disposition)
  );
}

function extractEmbeddedDocxUrl(html) {
  const patterns = [
    /"downloadUrl"\s*:\s*"([^"]+?)"/i,
    /"@content\.downloadUrl"\s*:\s*"([^"]+?)"/i,
    /https:[^"'\\]+?\.docx[^"'\\\s]*/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) {
      continue;
    }

    const url = decodeJsonEscapes(match[1] || match[0]);
    if (url) {
      return url;
    }
  }

  return "";
}

function decodeJsonEscapes(value) {
  return String(value || "")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, "\"");
}

function extractHeadingsFromHtml(html) {
  const matches = [...String(html || "").matchAll(/<(h1|h2)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  return matches
    .map((match, index) => {
      const level = match[1].toUpperCase();
      const text = stripHtml(match[2]);
      return text ? createHeading(text, index, level) : null;
    })
    .filter(Boolean);
}

function inferHeadingsFromText(rawText) {
  const paragraphs = splitParagraphs(rawText);
  const headingCandidates = paragraphs.filter((paragraph) => looksLikeHeading(paragraph));
  const selected = headingCandidates.slice(0, 12);

  return selected.map((text, index) => {
    const type = index === 0 ? "H1" : "H2";
    return createHeading(text, index, type);
  });
}

function looksLikeHeading(text) {
  const value = String(text || "").trim();
  if (!value || value.length > 120) {
    return false;
  }

  if (/https?:\/\//i.test(value)) {
    return false;
  }

  const wordCount = value.split(/\s+/).length;
  if (wordCount < 2 || wordCount > 14) {
    return false;
  }

  return !/[.:;]\s/.test(value) || /\?$/.test(value);
}

function createHeading(text, index, type) {
  return {
    index,
    type,
    text,
    banner_kind: type === "H1" ? "hero" : "card",
    target_width: type === "H1" ? 674 : 1020,
    target_height: type === "H1" ? 514 : 1020
  };
}

function extractTitleFromHtml(html) {
  const match = String(html || "").match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? stripHtml(match[1]) : "";
}

function splitParagraphs(rawText) {
  return String(rawText || "")
    .split(/\n\s*\n/g)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);
}

function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtml(html) {
  return normalizeWhitespace(
    String(html || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
  );
}

function extractUrls(text) {
  return [...new Set(String(text || "").match(/https?:\/\/[^\s)"'<]+/g) || [])];
}
