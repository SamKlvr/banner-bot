import { google } from "googleapis";
import { config } from "./config.js";

const auth = new google.auth.JWT({
  email: config.googleServiceAccountEmail,
  key: config.googleServiceAccountPrivateKey,
  scopes: [
    "https://www.googleapis.com/auth/documents.readonly"
  ]
});

const docs = google.docs({ version: "v1", auth });

export async function loadGoogleDoc(docUrlOrId) {
  const documentId = extractGoogleDocId(docUrlOrId);
  const response = await docs.documents.get({ documentId });
  const document = response.data;
  const title = document.title || "";
  const paragraphs = [];
  const headings = [];
  const links = new Set();
  const mediaLinks = new Set();

  for (const block of document.body?.content || []) {
    const paragraph = block.paragraph;
    if (!paragraph) {
      continue;
    }

    const namedStyleType = paragraph.paragraphStyle?.namedStyleType || "NORMAL_TEXT";
    const text = flattenParagraph(paragraph, links, mediaLinks).trim();

    if (!text) {
      continue;
    }

    paragraphs.push(text);

    if (namedStyleType === "HEADING_1" || namedStyleType === "HEADING_2") {
      headings.push({
        index: headings.length,
        type: namedStyleType === "HEADING_1" ? "H1" : "H2",
        text,
        banner_kind: namedStyleType === "HEADING_1" ? "hero" : "card",
        target_width: namedStyleType === "HEADING_1" ? 674 : 1020,
        target_height: namedStyleType === "HEADING_1" ? 514 : 1020
      });
    }
  }

  return {
    documentId,
    title,
    content: paragraphs.join("\n\n"),
    headings,
    links: [...links],
    mediaLinks: [...mediaLinks]
  };
}

export function extractGoogleDocId(docUrlOrId) {
  const match = String(docUrlOrId).match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : String(docUrlOrId).trim();
}

function flattenParagraph(paragraph, links, mediaLinks) {
  let text = "";

  for (const element of paragraph.elements || []) {
    const run = element.textRun;
    if (!run?.content) {
      continue;
    }

    text += run.content;

    const url = run.textStyle?.link?.url;
    if (url) {
      links.add(url);
      if (isMediaLink(url)) {
        mediaLinks.add(url);
      }
    }
  }

  for (const url of extractUrls(text)) {
    links.add(url);
    if (isMediaLink(url)) {
      mediaLinks.add(url);
    }
  }

  return text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}

function isMediaLink(url) {
  return /drive\.google\.com\/file\//.test(url) || /\.(png|jpe?g|webp)(\?|$)/i.test(url);
}

function extractUrls(text) {
  return text.match(/https?:\/\/[^\s)]+/g) || [];
}
