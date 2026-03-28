import { NextRequest, NextResponse } from "next/server";
import { computeTemplateSignature } from "@/lib/signature";
import { getFirebaseServices } from "@/lib/firebaseAdmin";
import { saveTemplateRecord } from "@/lib/templateStore";

export const runtime = "nodejs";

interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PageData {
  page: number;
  width: number;
  height: number;
  textItems: TextItem[];
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown template save error";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const libraryId = String(formData.get("libraryId") ?? "");
    const text = String(formData.get("text") ?? "");
    const pagesRaw = String(formData.get("pages") ?? "[]");
    const templateRaw = String(formData.get("template") ?? "{}");
    const templateName = String(formData.get("templateName") ?? "Untitled Template");
    const file = formData.get("file") as File | null;

    if (!libraryId || !text || !pagesRaw || !templateRaw || !file) {
      return NextResponse.json(
        { error: "libraryId, text, pages, template, and file are required." },
        { status: 400 },
      );
    }

    const pages = JSON.parse(pagesRaw) as PageData[];
    const template = JSON.parse(templateRaw) as unknown;
    const signature = computeTemplateSignature(text, pages);

    const { bucket } = getFirebaseServices();
    const safeName = sanitizeFileName(file.name || "source.pdf");
    const path = `libraries/${libraryId}/templates/${signature}/source/${Date.now()}-${safeName}`;

    const bytes = Buffer.from(await file.arrayBuffer());
    const storageFile = bucket.file(path);
    await storageFile.save(bytes, {
      contentType: file.type || "application/pdf",
      resumable: false,
      metadata: {
        cacheControl: "private, max-age=31536000",
      },
    });

    const [signedUrl] = await storageFile.getSignedUrl({
      action: "read",
      expires: "2099-01-01",
    });

    const record = await saveTemplateRecord({
      libraryId,
      signature,
      templateName,
      template,
      sourcePdfPath: path,
      sourcePdfUrl: signedUrl,
    });

    return NextResponse.json({
      ok: true,
      signature,
      templateId: record.id,
      templateName: record.templateName,
      sourcePdfUrl: record.sourcePdfUrl,
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
