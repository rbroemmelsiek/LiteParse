import { createHash } from "node:crypto";

interface SignatureTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SignaturePage {
  page: number;
  width: number;
  height: number;
  textItems: SignatureTextItem[];
}

const MAX_TEXT_CHARS = 40000;
const MAX_PAGES = 12;
const MAX_ITEMS_PER_PAGE = 180;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function computeTemplateSignature(text: string, pages: SignaturePage[]): string {
  const normalizedText = normalizeText(text).slice(0, MAX_TEXT_CHARS);
  const pageDigest = pages.slice(0, MAX_PAGES).map((page) => {
    const textItems = page.textItems
      .slice(0, MAX_ITEMS_PER_PAGE)
      .map((item) => ({
        t: normalizeText(item.text).slice(0, 120),
        x: Number(item.x.toFixed(1)),
        y: Number(item.y.toFixed(1)),
        w: Number(item.width.toFixed(1)),
        h: Number(item.height.toFixed(1)),
      }));
    return {
      p: page.page,
      w: Number(page.width.toFixed(1)),
      h: Number(page.height.toFixed(1)),
      t: textItems,
    };
  });

  const signaturePayload = JSON.stringify({
    t: normalizedText,
    p: pageDigest,
  });

  return createHash("sha256").update(signaturePayload).digest("hex");
}
