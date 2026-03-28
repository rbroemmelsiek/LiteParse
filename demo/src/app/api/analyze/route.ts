import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface LiteParseTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LiteParsePage {
  page: number;
  width: number;
  height: number;
  image?: string;
  textItems: LiteParseTextItem[];
  visualItems?: Array<{
    kind: "blank_line" | "checkbox" | "input_box";
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
}

type FieldType =
  | "boolean"
  | "text"
  | "paragraph"
  | "date"
  | "datetime"
  | "name"
  | "email"
  | "address"
  | "image"
  | "latlong"
  | "enum"
  | "enumlist"
  | "number"
  | "integer"
  | "price";

type DisplayType =
  | "Checkbox"
  | "CheckboxTimer"
  | "Text"
  | "Long Text"
  | "Name"
  | "Number"
  | "Decimal"
  | "Price"
  | "Percent"
  | "Yes/No"
  | "Date"
  | "Time"
  | "Date/Time"
  | "Duration"
  | "Ref"
  | "Enum"
  | "EnumList"
  | "Address"
  | "LatLong"
  | "XY"
  | "Email"
  | "Phone"
  | "URL"
  | "Image"
  | "Thumbnail"
  | "Color"
  | "Drawing"
  | "Signature"
  | "File"
  | "Video (Url)"
  | "Page Header"
  | "Section Header"
  | "ChangeCounter"
  | "ChangeLocation"
  | "ChangeTimestamp"
  | "Progress"
  | "App";

interface TemplateField {
  key?: string;
  label: string;
  type: FieldType;
  displayType?: DisplayType;
  page: number;
  required: boolean;
  description: string;
  source: "text" | "context" | "visual";
  confidence: number;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface TemplateStaticBlock {
  key: string;
  displayType: "Page Header" | "Section Header" | "Text";
  page: number;
  text: string;
}

interface TemplateDefinition {
  templateName: string;
  fields: TemplateField[];
  templateContent?: {
    staticBlocks: TemplateStaticBlock[];
  };
  notes: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnalyzeRequestBody {
  mode?: "template" | "chat" | "extract";
  text?: string;
  pages?: LiteParsePage[];
  template?: TemplateDefinition;
  libraryId?: string;
  templateSignature?: string;
  messages?: ChatMessage[];
  message?: string;
  includeImages?: boolean;
}

const TEMPLATE_MODEL_DEFAULT = "gemini-3.1-pro";
const EXTRACTION_MODEL_DEFAULT = "gemini-3.1-flash";
const TEMPLATE_FALLBACK_MODELS = ["gemini-2.5-pro", "gemini-1.5-pro"];
const EXTRACTION_FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
const MAX_TEXT_CHARS = 30000;
const MAX_STRUCTURED_PAGES = 8;
const MAX_ITEMS_PER_PAGE = 120;
const MAX_IMAGE_PAGES = 5;

function compactPagesForPrompt(pages: LiteParsePage[]): string {
  const compact = pages.slice(0, MAX_STRUCTURED_PAGES).map((page) => ({
    page: page.page,
    width: page.width,
    height: page.height,
    textItems: page.textItems.slice(0, MAX_ITEMS_PER_PAGE).map((item) => ({
      text: item.text,
      x: Number(item.x.toFixed(2)),
      y: Number(item.y.toFixed(2)),
      width: Number(item.width.toFixed(2)),
      height: Number(item.height.toFixed(2)),
    })),
    visualItems: (page.visualItems ?? []).slice(0, 300).map((item) => ({
      kind: item.kind,
      x: Number(item.x.toFixed(2)),
      y: Number(item.y.toFixed(2)),
      width: Number(item.width.toFixed(2)),
      height: Number(item.height.toFixed(2)),
      confidence: Number(item.confidence.toFixed(3)),
    })),
  }));

  return JSON.stringify(compact, null, 2);
}

function sanitizeText(text: string): string {
  return text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n...[truncated]` : text;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown Gemini error";
}

function getModelCandidates(mode: "template" | "chat" | "extract"): string[] {
  if (mode === "template") {
    const configuredTemplate = process.env.GEMINI_TEMPLATE_MODEL?.trim();
    return [configuredTemplate, TEMPLATE_MODEL_DEFAULT, ...TEMPLATE_FALLBACK_MODELS].filter(
      (modelName): modelName is string => Boolean(modelName),
    );
  }

  const configuredExtraction = process.env.GEMINI_EXTRACTION_MODEL?.trim();
  return [configuredExtraction, EXTRACTION_MODEL_DEFAULT, ...EXTRACTION_FALLBACK_MODELS].filter(
    (modelName): modelName is string => Boolean(modelName),
  );
}

function extractBase64Payload(imageDataUrl?: string): string | null {
  if (!imageDataUrl) return null;
  const commaIndex = imageDataUrl.indexOf(",");
  if (commaIndex === -1) return null;
  return imageDataUrl.slice(commaIndex + 1);
}

function parseTemplateJson(raw: string): TemplateDefinition | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  const jsonString = fenced?.[1] ?? trimmed;

  try {
    const parsed = JSON.parse(jsonString) as Partial<TemplateDefinition>;
    if (!parsed || !Array.isArray(parsed.fields)) return null;
    const normalizedFields = (parsed.fields as TemplateField[]).map((field) => ({
      ...field,
      displayType: field.displayType ?? "Text",
    }));
    return {
      templateName: parsed.templateName ?? "Untitled Template",
      fields: normalizedFields,
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch {
    return null;
  }
}

function toJsonKey(label: string): string {
  const key = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return key || "field";
}

function normalizeTemplate(template: TemplateDefinition): TemplateDefinition {
  return {
    ...template,
    fields: template.fields.map((field, idx) => ({
      ...field,
      key: field.key && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.key) ? field.key : toJsonKey(field.label || `field_${idx + 1}`),
      displayType: field.displayType ?? "Text",
    })),
    templateContent: {
      staticBlocks: (template.templateContent?.staticBlocks ?? []).map((block, idx) => ({
        key:
          block.key && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(block.key)
            ? block.key
            : `static_${idx + 1}`,
        displayType: block.displayType,
        page: block.page,
        text: block.text,
      })),
    },
  };
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  const jsonString = fenced?.[1] ?? trimmed;
  try {
    return JSON.parse(jsonString) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function generateWithFallback(
  genAI: GoogleGenerativeAI,
  models: string[],
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>,
): Promise<{ text: string; model: string }> {
  const errors: string[] = [];

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(parts);
      const response = await result.response;
      const text = response.text();
      if (text) return { text, model: modelName };
      errors.push(`${modelName}: Empty response`);
    } catch (modelError) {
      errors.push(`${modelName}: ${errorMessage(modelError)}`);
    }
  }

  throw new Error(
    `Gemini request failed for all configured models. Set GEMINI_MODEL to a valid model. Details: ${errors.join(
      " | ",
    )}`,
  );
}

function buildTemplatePrompt(plainText: string, structuredExcerpt: string): string {
  return `You are building a data extraction template from LiteParse output.
Use BOTH:
1) Extracted text/coordinates (structured JSON)
2) Page screenshots (visual cues)

Critical requirements:
- Include fields that are visually present as blank lines and checkboxes, even when text is sparse.
- Use visualItems (blank_line, checkbox, input_box) as first-class evidence for fields that parser text boxes miss.
- Prefer deriving label from nearby accompanying text first; if absent, infer from context second.
- Return precise labels suitable for downstream extraction keys.
- For each field include type from this controlled list only:
  boolean, text, paragraph, date, datetime, name, email, address, image, latlong, enum, enumlist, number, integer, price
- Also include displayType from this controlled list only:
  Checkbox, CheckboxTimer, Text, Long Text, Name, Number, Decimal, Price, Percent, Yes/No, Date, Time, Date/Time, Duration, Ref, Enum, EnumList, Address, LatLong, XY, Email, Phone, URL, Image, Thumbnail, Color, Drawing, Signature, File, Video (Url), Page Header, ChangeCounter, ChangeLocation, ChangeTimestamp, Progress, App

Return STRICT JSON only, no markdown, no extra prose:
{
  "templateName": "string",
  "fields": [
    {
      "key": "json_compatible_snake_case_identifier",
      "label": "string",
      "type": "one_of_allowed_types",
      "displayType": "one_of_allowed_display_types",
      "page": 1,
      "required": false,
      "description": "string",
      "source": "text|context|visual",
      "confidence": 0.0,
      "bbox": { "x": 0, "y": 0, "width": 0, "height": 0 }
    }
  ],
  "templateContent": {
    "staticBlocks": [
      {
        "key": "json_compatible_snake_case_identifier",
        "displayType": "Page Header|Section Header|Text",
        "page": 1,
        "text": "string"
      }
    ]
  },
  "notes": ["string"]
}

LiteParse plain text:
"""
${plainText}
"""

LiteParse structured pages JSON (truncated sample):
\`\`\`json
${structuredExcerpt}
\`\`\`
`;
}

function buildExtractPrompt(
  plainText: string,
  structuredExcerpt: string,
  template: TemplateDefinition | undefined,
  libraryId: string | undefined,
  templateSignature: string | undefined,
): string {
  const templateJson = template ? JSON.stringify(template, null, 2) : "No template available.";
  return `Extract a Form Instance from LiteParse output using the provided Template.

Rules:
- Use template.fields[*].key as JSON output keys.
- Preserve data types conceptually based on field displayType/type.
- Return null where value is not confidently present.
- Do not invent values.

Return STRICT JSON ONLY:
{
  "templateRef": {
    "libraryId": "${libraryId ?? ""}",
    "templateSignature": "${templateSignature ?? ""}"
  },
  "values": {
    "<field_key>": "<value_or_null>"
  }
}

Template JSON:
\`\`\`json
${templateJson}
\`\`\`

LiteParse plain text:
"""
${plainText}
"""

LiteParse structured pages JSON excerpt:
\`\`\`json
${structuredExcerpt}
\`\`\`
`;
}

function buildChatPrompt(
  plainText: string,
  structuredExcerpt: string,
  template: TemplateDefinition | undefined,
  history: ChatMessage[],
  message: string,
): string {
  const templateJson = template ? JSON.stringify(template, null, 2) : "No template available.";
  const historyText = history
    .slice(-8)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  return `You are assisting with document extraction over LiteParse output.

Rules:
- If a template is available, prioritize template-driven extraction from text and structure.
- Only rely on visual assumptions when explicitly needed.
- Be explicit about uncertainty for ambiguous values.
- When returning extracted values, map them to template labels.

Template definition:
\`\`\`json
${templateJson}
\`\`\`

LiteParse plain text:
"""
${plainText}
"""

LiteParse structured pages JSON excerpt:
\`\`\`json
${structuredExcerpt}
\`\`\`

Recent conversation:
${historyText || "No previous messages."}

User message:
${message}
`;
}

export async function POST(req: NextRequest) {
  try {
    const {
      mode = "template",
      text,
      pages,
      template,
      libraryId,
      templateSignature,
      messages = [],
      message,
      includeImages = true,
    }: AnalyzeRequestBody = await req.json();

    if (!text && (!pages || pages.length === 0) && mode !== "chat") {
      return NextResponse.json(
        { error: "No parse output provided. Expected document text or structured pages." },
        { status: 400 },
      );
    }
    if (mode === "chat" && !message) {
      return NextResponse.json({ error: "No chat message provided" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const candidateModels = getModelCandidates(mode);
    const uniqueModels = [...new Set(candidateModels)];

    const plainText = text ? sanitizeText(text) : "No plain text payload was provided.";
    const structuredExcerpt =
      pages && pages.length > 0
        ? compactPagesForPrompt(pages)
        : "No structured page data payload was provided.";

    if (mode === "chat") {
      const prompt = buildChatPrompt(
        plainText,
        structuredExcerpt,
        template,
        messages,
        message ?? "",
      );
      const { text: aiText, model } = await generateWithFallback(genAI, uniqueModels, [{ text: prompt }]);
      return NextResponse.json({ reply: aiText, model });
    }

    if (mode === "extract") {
      const normalizedTemplate = template ? normalizeTemplate(template) : undefined;
      const prompt = buildExtractPrompt(
        plainText,
        structuredExcerpt,
        normalizedTemplate,
        libraryId,
        templateSignature,
      );
      const { text: aiText, model } = await generateWithFallback(genAI, uniqueModels, [{ text: prompt }]);
      const parsed = extractJsonObject(aiText);
      if (parsed) {
        return NextResponse.json({ instance: parsed, extraction: aiText, model });
      }
      return NextResponse.json({ extraction: aiText, model });
    }

    const prompt = buildTemplatePrompt(plainText, structuredExcerpt);
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: prompt }];

    if (includeImages && pages?.length) {
      for (const page of pages.slice(0, MAX_IMAGE_PAGES)) {
        const base64Data = extractBase64Payload(page.image);
        if (!base64Data) continue;
        parts.push({ text: `Page ${page.page} screenshot` });
        parts.push({ inlineData: { mimeType: "image/png", data: base64Data } });
      }
    }

    const { text: aiText, model } = await generateWithFallback(genAI, uniqueModels, parts);
    const parsedTemplate = parseTemplateJson(aiText);

    if (!parsedTemplate) {
      return NextResponse.json({
        model,
        template: { templateName: "Unparsed template", fields: [], notes: ["Model output was not strict JSON."] },
        analysis: aiText,
      });
    }

    const normalizedTemplate = normalizeTemplate(parsedTemplate);
    return NextResponse.json({
      model,
      template: normalizedTemplate,
      analysis: `Identified **${normalizedTemplate.fields.length}** template field(s).`,
    });
  } catch (error) {
    console.error("Analyze API error:", error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
