import { NextRequest, NextResponse } from "next/server";
import { computeTemplateSignature } from "@/lib/signature";
import { findTemplateBySignature } from "@/lib/templateStore";

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

interface MatchRequest {
  libraryId?: string;
  text?: string;
  pages?: PageData[];
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown template match error";
}

export async function POST(req: NextRequest) {
  try {
    const { libraryId, text, pages }: MatchRequest = await req.json();

    if (!libraryId) {
      return NextResponse.json({ error: "libraryId is required" }, { status: 400 });
    }
    if (!text || !pages?.length) {
      return NextResponse.json({ error: "text and pages are required" }, { status: 400 });
    }

    const signature = computeTemplateSignature(text, pages);
    const record = await findTemplateBySignature(libraryId, signature);

    if (!record) {
      return NextResponse.json({ signature, found: false });
    }

    return NextResponse.json({
      signature,
      found: true,
      template: record.template,
      templateName: record.templateName,
      sourcePdfUrl: record.sourcePdfUrl,
      libraryId: record.libraryId,
      templateId: record.id,
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
