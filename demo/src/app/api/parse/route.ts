import { NextRequest, NextResponse } from "next/server";
import { LiteParse } from "@llamaindex/liteparse";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const runtime = "nodejs";

interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ParsedPage {
  page: number;
  width: number;
  height: number;
  textItems: TextItem[];
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to temp file to avoid PDF.js ArrayBuffer detachment bugs in memory
    const tempPath = path.join(os.tmpdir(), `liteparse-demo-${Date.now()}.pdf`);
    await fs.writeFile(tempPath, buffer);

    // Initialize LiteParse instance
    const parser = new LiteParse({
      outputFormat: "json",
      preciseBoundingBox: true, 
      ocrEnabled: false, // Keep it fast for the demo
      dpi: 150 
    });

    console.log("Parsing document...");
    const result = await parser.parse(tempPath);
    
    if (!result.json) {
      await fs.unlink(tempPath).catch(console.error);
      return NextResponse.json({ error: "Failed to parse JSON" }, { status: 500 });
    }

    const pageCount = result.pages.length;
    // Limit to 20 pages max for the UI demo to avoid huge payloads
    const limit = Math.min(pageCount, 20);
    const pageNumbers = Array.from({ length: limit }, (_, i) => i + 1);

    console.log(`Taking screenshots of ${limit} pages...`);
    const screenshots = await parser.screenshot(tempPath, pageNumbers);

    // Clean up temp file safely
    await fs.unlink(tempPath).catch(console.error);

    // Map the JSON structure to include raw screenshot images only
    const pages = (result.json.pages.slice(0, limit) as ParsedPage[]).map((pageData) => {
      const screenshot = screenshots.find((s) => s.pageNum === pageData.page);
      let imageBase64 = "";
      let imageWidth = pageData.width;
      let imageHeight = pageData.height;
      if (screenshot) {
        imageWidth = screenshot.width || pageData.width;
        imageHeight = screenshot.height || pageData.height;
        imageBase64 = `data:image/png;base64,${screenshot.imageBuffer.toString("base64")}`;
      }

      return {
        ...pageData,
        image: imageBase64,
        imageWidth,
        imageHeight,
      };
    });

    return NextResponse.json({ pages, text: result.text });
  } catch (error) {
    console.error("Parse API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown parse error" },
      { status: 500 },
    );
  }
}
