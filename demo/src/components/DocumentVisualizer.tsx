"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  UploadCloud,
  File as FileIcon,
  Loader2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  SendHorizontal,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface VisualItem {
  kind: "blank_line" | "checkbox" | "input_box";
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface PageData {
  page: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
  image: string;
  textItems: TextItem[];
  visualItems?: VisualItem[];
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
  | "ChangeCounter"
  | "ChangeLocation"
  | "ChangeTimestamp"
  | "Progress"
  | "App";

interface TemplateField {
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
  bboxes?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

interface TemplateDefinition {
  templateName: string;
  fields: TemplateField[];
  notes: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface MatchedTemplateInfo {
  templateName?: string;
  sourcePdfUrl?: string;
  signature?: string;
}

interface BoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DrawTarget =
  | { mode: "none" }
  | { mode: "assign"; fieldIndex: number }
  | { mode: "add"; draft: { label: string; type: FieldType; displayType: DisplayType } };

export default function DocumentVisualizer() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateLookupState, setTemplateLookupState] = useState<
    "idle" | "checking" | "found" | "none" | "error"
  >("idle");
  const [libraryId, setLibraryId] = useState("default-library");
  const [templateSignature, setTemplateSignature] = useState<string | null>(null);
  const [matchedTemplateInfo, setMatchedTemplateInfo] = useState<MatchedTemplateInfo | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [pages, setPages] = useState<PageData[]>([]);
  const [documentText, setDocumentText] = useState("");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateDefinition | null>(null);
  const [analysisModel, setAnalysisModel] = useState<string | null>(null);
  const [extractionModel, setExtractionModel] = useState<string | null>(null);
  const [chatModel, setChatModel] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");
  const [newFieldDisplayType, setNewFieldDisplayType] = useState<DisplayType>("Text");
  const [drawTarget, setDrawTarget] = useState<DrawTarget>({ mode: "none" });
  const [dragging, setDragging] = useState<{
    page: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [draggingTemplateBox, setDraggingTemplateBox] = useState<{
    fieldIndex: number;
    boxIndex: number;
    page: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [hoveredText, setHoveredText] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const pageOverlayRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const fieldRowRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const fieldTypes: FieldType[] = [
    "boolean",
    "text",
    "paragraph",
    "date",
    "datetime",
    "name",
    "email",
    "address",
    "image",
    "latlong",
    "enum",
    "enumlist",
    "number",
    "integer",
    "price",
  ];
  const displayTypes: DisplayType[] = [
    "Checkbox",
    "CheckboxTimer",
    "Text",
    "Long Text",
    "Name",
    "Number",
    "Decimal",
    "Price",
    "Percent",
    "Yes/No",
    "Date",
    "Time",
    "Date/Time",
    "Duration",
    "Ref",
    "Enum",
    "EnumList",
    "Address",
    "LatLong",
    "XY",
    "Email",
    "Phone",
    "URL",
    "Image",
    "Thumbnail",
    "Color",
    "Drawing",
    "Signature",
    "File",
    "Video (Url)",
    "Page Header",
    "ChangeCounter",
    "ChangeLocation",
    "ChangeTimestamp",
    "Progress",
    "App",
  ];

  const getFieldBoxes = (field: TemplateField): BoxRect[] => {
    if (field.bboxes?.length) return field.bboxes;
    if (field.bbox) return [field.bbox];
    return [];
  };

  const normalizeEditableBox = (box: BoxRect): BoxRect => {
    const minW = 12;
    const minH = 12;
    return {
      x: box.x,
      y: box.y,
      width: Number.isFinite(box.width) ? Math.max(minW, box.width) : minW,
      height: Number.isFinite(box.height) ? Math.max(minH, box.height) : minH,
    };
  };

  const toStructuredPages = (sourcePages: PageData[]) => {
    return sourcePages.map((p) => ({
      page: p.page,
      width: p.width,
      height: p.height,
      image: p.image,
      textItems: p.textItems,
      visualItems: p.visualItems ?? [],
    }));
  };

  const toTextStructurePages = (sourcePages: PageData[]) => {
    return sourcePages.map((p) => ({
      page: p.page,
      width: p.width,
      height: p.height,
      textItems: p.textItems,
      visualItems: p.visualItems ?? [],
    }));
  };

  const updateTemplateField = (index: number, updater: (field: TemplateField) => TemplateField) => {
    setTemplate((prev) => {
      if (!prev) return prev;
      if (index < 0 || index >= prev.fields.length) return prev;
      const updatedFields = [...prev.fields];
      updatedFields[index] = updater(updatedFields[index]);
      return { ...prev, fields: updatedFields };
    });
  };

  const updateTemplateFieldBox = (
    fieldIndex: number,
    boxIndex: number,
    updater: (box: BoxRect) => BoxRect,
  ) => {
    updateTemplateField(fieldIndex, (field) => {
      const boxes = getFieldBoxes(field);
      if (boxIndex < 0 || boxIndex >= boxes.length) return field;
      const updated = [...boxes];
      updated[boxIndex] = normalizeEditableBox(updater(normalizeEditableBox(updated[boxIndex])));
      return {
        ...field,
        bbox: updated[0],
        bboxes: updated,
      };
    });
  };

  useEffect(() => {
    if (!draggingTemplateBox) return;

    const onMouseMove = (event: MouseEvent) => {
      const page = pages.find((p) => p.page === draggingTemplateBox.page);
      const overlay = pageOverlayRefs.current[draggingTemplateBox.page];
      if (!page || !overlay) return;

      const rect = overlay.getBoundingClientRect();
      const relX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      const relY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
      const px = relX * page.width;
      const py = relY * page.height;

      updateTemplateFieldBox(draggingTemplateBox.fieldIndex, draggingTemplateBox.boxIndex, (box) => ({
        ...box,
        x: Math.max(0, Math.min(page.width - box.width, px - draggingTemplateBox.offsetX)),
        y: Math.max(0, Math.min(page.height - box.height, py - draggingTemplateBox.offsetY)),
      }));
    };

    const onMouseUp = () => {
      setDraggingTemplateBox(null);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [draggingTemplateBox, pages]);

  useEffect(() => {
    if (selectedFieldIndex === null) return;
    const rowEl = fieldRowRefs.current[selectedFieldIndex];
    if (!rowEl) return;
    rowEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedFieldIndex]);

  const getPageCoordinates = (
    e: React.MouseEvent<HTMLDivElement>,
    pageWidth: number,
    pageHeight: number,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const relY = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return {
      x: relX * pageWidth,
      y: relY * pageHeight,
    };
  };

  const normalizeBox = (startX: number, startY: number, endX: number, endY: number): BoxRect => {
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    return { x, y, width, height };
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const runExtraction = async (nextTemplate: TemplateDefinition, nextText: string, nextPages: PageData[]) => {
    setExtracting(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "extract",
          text: nextText,
          pages: toTextStructurePages(nextPages),
          template: nextTemplate,
          includeImages: false,
        }),
      });
      const data = await res.json();
      if (data.extraction) setAnalysis(data.extraction);
      if (data.model) setExtractionModel(data.model);
      if (data.error) setAnalysis(`**Extraction Error:** ${data.error}`);
    } catch {
      setAnalysis("**Error extracting field values from template.**");
    } finally {
      setExtracting(false);
    }
  };

  const lookupTemplate = async (nextText: string, nextPages: PageData[]) => {
    setTemplateLookupState("checking");
    try {
      const res = await fetch("/api/templates/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryId,
          text: nextText,
          pages: toTextStructurePages(nextPages),
        }),
      });
      const data = await res.json();

      if (data.found && data.template) {
        setTemplateLookupState("found");
        setTemplate(data.template);
        setSelectedFieldIndex(data.template.fields?.length ? 0 : null);
        setMatchedTemplateInfo({
          templateName: data.templateName,
          sourcePdfUrl: data.sourcePdfUrl,
          signature: data.signature,
        });
        setTemplateSignature(data.signature ?? null);
        setAnalysis(`Using template **${data.templateName || "Unnamed Template"}** from library **${libraryId}**.`);
        await runExtraction(data.template, nextText, nextPages);
        return;
      }

      setTemplateLookupState("none");
      setTemplateSignature(data.signature ?? null);
      setMatchedTemplateInfo(null);
      setTemplate(null);
      setSelectedFieldIndex(null);
      setAnalysis(
        `No existing template match in library **${libraryId}**. Create a new template (Gemini 3.1 Pro) and save it.`,
      );
    } catch (error) {
      setTemplateLookupState("error");
      setTemplate(null);
      setSelectedFieldIndex(null);
      setAnalysis(
        `Template lookup failed (likely Firebase config/auth issue). You can still create a new template manually. ${
          error instanceof Error ? error.message : ""
        }`,
      );
    }
  };

  const generateTemplateFromCurrentDoc = async () => {
    setAnalyzing(true);
    try {
      const aiRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "template",
          text: documentText,
          pages: toStructuredPages(pages),
          includeImages: true,
        }),
      });
      const aiData = await aiRes.json();
      if (!aiData.template) {
        setAnalysis(`**Template generation error:** ${aiData.error || "No template output"}`);
        return null;
      }
      setTemplate(aiData.template);
      setSelectedFieldIndex(aiData.template.fields?.length ? 0 : null);
      if (aiData.model) setAnalysisModel(aiData.model);
      if (aiData.analysis) setAnalysis(aiData.analysis);
      return aiData.template as TemplateDefinition;
    } catch {
      setAnalysis("**Error communicating with Gemini template model.**");
      return null;
    } finally {
      setAnalyzing(false);
    }
  };

  const saveTemplateToLibrary = async (templateToSave: TemplateDefinition) => {
    if (!file) {
      setAnalysis("Cannot save template: original file is not available.");
      return;
    }
    setSavingTemplate(true);
    try {
      const payload = new FormData();
      payload.append("libraryId", libraryId);
      payload.append("text", documentText);
      payload.append("pages", JSON.stringify(toTextStructurePages(pages)));
      payload.append("template", JSON.stringify(templateToSave));
      payload.append("templateName", templateToSave.templateName || "Untitled Template");
      payload.append("file", file);

      const res = await fetch("/api/templates/save", {
        method: "POST",
        body: payload,
      });
      const data = await res.json();
      if (data.ok) {
        setTemplateLookupState("found");
        setTemplateSignature(data.signature ?? null);
        setMatchedTemplateInfo({
          templateName: data.templateName,
          sourcePdfUrl: data.sourcePdfUrl,
          signature: data.signature,
        });
        setAnalysis(
          `Template **${data.templateName || "Unnamed Template"}** saved to library **${libraryId}**.`,
        );
      } else {
        setAnalysis(`Template save failed: ${data.error || "Unknown error"}`);
      }
    } catch {
      setAnalysis("Template save failed due to network or server error.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    setPages([]);
    setDocumentText("");
    setAnalysis(null);
    setTemplate(null);
    setAnalysisModel(null);
    setExtractionModel(null);
    setChatModel(null);
    setChatMessages([]);
    setChatInput("");
    setSelectedFieldIndex(null);
    setDrawTarget({ mode: "none" });
    setDragging(null);
    setDraggingTemplateBox(null);
    setTemplateLookupState("idle");
    setTemplateSignature(null);
    setMatchedTemplateInfo(null);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch("/api/parse", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      if (data.pages) {
        setPages(data.pages);
        setDocumentText(data.text ?? "");
        await lookupTemplate(data.text ?? "", data.pages);
      } else {
        alert(data.error || "Failed to parse document");
      }
    } catch (err) {
      alert("Error parsing document");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPages([]);
    setDocumentText("");
    setAnalysis(null);
    setTemplate(null);
    setAnalysisModel(null);
    setExtractionModel(null);
    setChatModel(null);
    setChatMessages([]);
    setChatInput("");
    setSelectedFieldIndex(null);
    setDrawTarget({ mode: "none" });
    setDragging(null);
    setDraggingTemplateBox(null);
    setTemplateLookupState("idle");
    setTemplateSignature(null);
    setMatchedTemplateInfo(null);
  };

  const sendChatMessage = async () => {
    const message = chatInput.trim();
    if (!message || !documentText) return;

    const history = [...chatMessages];
    const nextMessages = [...history, { role: "user" as const, content: message }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          message,
          messages: history,
          text: documentText,
          pages: toTextStructurePages(pages),
          template,
          includeImages: false,
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else if (data.error) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Gemini API Error: ${data.error}` },
        ]);
      }
      if (data.model) setChatModel(data.model);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error communicating with Gemini API." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleCreateTemplateAndSave = async () => {
    if (!documentText || !pages.length) return;
    const nextTemplate = await generateTemplateFromCurrentDoc();
    if (!nextTemplate) return;
    await saveTemplateToLibrary(nextTemplate);
    await runExtraction(nextTemplate, documentText, pages);
  };

  const handleSaveCurrentTemplate = async () => {
    if (!template) return;
    await saveTemplateToLibrary(template);
  };

  const beginAssignBoxForSelectedField = () => {
    if (selectedFieldIndex === null) return;
    setDrawTarget({ mode: "assign", fieldIndex: selectedFieldIndex });
  };

  const beginAddFieldWithBox = () => {
    const trimmed = newFieldLabel.trim();
    if (!trimmed) return;
    setDrawTarget({
      mode: "add",
      draft: { label: trimmed, type: newFieldType, displayType: newFieldDisplayType },
    });
  };

  const handlePageMouseDown = (e: React.MouseEvent<HTMLDivElement>, page: PageData) => {
    if (drawTarget.mode === "none") return;
    const pt = getPageCoordinates(e, page.width, page.height);
    setDragging({
      page: page.page,
      startX: pt.x,
      startY: pt.y,
      currentX: pt.x,
      currentY: pt.y,
    });
  };

  const handlePageMouseMove = (e: React.MouseEvent<HTMLDivElement>, page: PageData) => {
    if (!dragging || dragging.page !== page.page) return;
    const pt = getPageCoordinates(e, page.width, page.height);
    setDragging((prev) => (prev ? { ...prev, currentX: pt.x, currentY: pt.y } : prev));
  };

  const completeDrawing = (page: PageData, dragState: NonNullable<typeof dragging>) => {
    const box = normalizeBox(
      dragState.startX,
      dragState.startY,
      dragState.currentX,
      dragState.currentY,
    );

    if (box.width < 4 || box.height < 4) return;

    if (drawTarget.mode === "assign") {
      updateTemplateField(drawTarget.fieldIndex, (field) => ({
        ...field,
        page: page.page,
        bbox: box,
        bboxes: [box],
        source: field.source === "visual" ? field.source : "visual",
      }));
      return;
    }

    if (drawTarget.mode === "add") {
      setTemplate((prev) => {
        const base: TemplateDefinition = prev ?? {
          templateName: "Manual Template",
          fields: [],
          notes: [],
        };
        const newField: TemplateField = {
          label: drawTarget.draft.label,
          type: drawTarget.draft.type,
          displayType: drawTarget.draft.displayType,
          page: page.page,
          required: false,
          description: "Manually added field.",
          source: "visual",
          confidence: 1,
          bbox: box,
          bboxes: [box],
        };
        const next = { ...base, fields: [...base.fields, newField] };
        setSelectedFieldIndex(next.fields.length - 1);
        return next;
      });
      setNewFieldLabel("");
      setNewFieldDisplayType("Text");
      return;
    }

    // no-op
  };

  const handlePageMouseUp = (_e: React.MouseEvent<HTMLDivElement>, page: PageData) => {
    if (!dragging || dragging.page !== page.page) return;
    completeDrawing(page, dragging);
    setDragging(null);
    setDrawTarget({ mode: "none" });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-neutral-200">
      {/* Upload Header */}
      <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-neutral-900 border-b border-neutral-800 shrink-0 shadow-lg z-10">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">LiteParse Studio</h1>
        
        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 uppercase tracking-wide">Library</span>
            <input
              value={libraryId}
              onChange={(e) => setLibraryId(e.target.value)}
              className="w-44 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
              placeholder="library id"
            />
          </div>
          {pages.length > 0 && (
            <button
              onClick={handleReset}
              className="mr-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors font-medium shadow-lg"
            >
              Upload New Document
            </button>
          )}
          {hoveredText && (
            <div className="bg-neutral-800 text-sm py-1 px-3 rounded-md max-w-sm truncate border border-neutral-700">
              <span className="text-neutral-400 mr-2">Hover:</span> {hoveredText}
            </div>
          )}
          <button
            onClick={() => setZoom(z => Math.max(0.2, z - 0.2))}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-sm text-neutral-400 font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(3, z + 0.2))}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors"
          >
            <ZoomIn size={18} />
          </button>
          <Link
            href="/help"
            className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors text-xs"
            title="Open usage guide and workflow documentation"
          >
            Help
          </Link>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden bg-[#0a0a0c]">
        {pages.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center p-8">
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 w-full max-w-2xl
                ${file ? 'border-indigo-500 bg-indigo-500/10' : 'border-neutral-700 hover:border-neutral-500 bg-neutral-900/50'}
              `}
            >
              <UploadCloud className="w-16 h-16 mx-auto mb-4 text-neutral-400" />
              <h3 className="text-xl font-semibold mb-2">Drag & Drop your PDF</h3>
              <p className="text-neutral-500 mb-6 font-light">or click to browse local files</p>
              
              <input
                type="file"
                accept=".pdf,.docx,.png,.jpg"
                className="hidden"
                id="file-upload"
                onChange={(e) => e.target.files && setFile(e.target.files[0])}
              />
              
              <div className="flex items-center justify-center space-x-4">
                <label
                  htmlFor="file-upload"
                  className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg cursor-pointer transition-colors shadow-md"
                >
                  Select File
                </label>
                {file && (
                  <button
                    onClick={handleProcess}
                    disabled={loading}
                    className="flex items-center px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors font-medium shadow-lg shadow-indigo-900/20 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <FileIcon className="w-5 h-5 mr-2" />}
                    {loading ? "Processing..." : "Parse + Match Template"}
                  </button>
                )}
              </div>
              
              {file && (
                <div className="mt-8 text-sm text-indigo-300 bg-indigo-950/30 inline-flex items-center px-4 py-2 rounded-full">
                  <FileIcon className="w-4 h-4 mr-2" />
                  {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Left Box: PDF Render */}
            <div className="flex-1 overflow-auto p-8 pb-32 flex flex-col items-center">
              <div className="flex flex-col space-y-12 items-center w-full">
                {pages.map((p, i) => {
                  const scaleX = 100 / p.width;
                  const scaleY = 100 / p.height;
                  
                  return (
                    <div key={i} className="flex flex-col items-center">
                      <div className="text-sm text-neutral-500 mb-3 tracking-widest uppercase">Page {p.page}</div>
                      
                      <div
                        className="relative bg-white shadow-2xl overflow-hidden ring-1 ring-white/10"
                        style={{
                          width: p.width * zoom,
                          height: p.height * zoom,
                        }}
                      >
                        <img
                          src={p.image}
                          alt={`Page ${p.page}`}
                          className="absolute inset-0 w-full h-full pointer-events-none"
                        />
                        
                        <div className="absolute inset-0 w-full h-full pointer-events-none origin-top-left">
                          {p.textItems.map((item, idx) => {
                            const left = item.x * scaleX;
                            const top = item.y * scaleY;
                            const width = item.width * scaleX;
                            const height = item.height * scaleY;
                            
                            return (
                              <div
                                key={idx}
                                onMouseEnter={() => setHoveredText(item.text)}
                                onMouseLeave={() => setHoveredText(null)}
                                className="absolute border border-indigo-500/40 bg-indigo-400/10 hover:bg-orange-400/40 hover:border-orange-500 transition-colors pointer-events-auto cursor-crosshair rounded-sm"
                                style={{
                                  left: `${left}%`,
                                  top: `${top}%`,
                                  width: `${width}%`,
                                  height: `${height}%`,
                                }}
                              >
                              </div>
                            )
                          })}
                        </div>

                        <div
                          ref={(el) => {
                            pageOverlayRefs.current[p.page] = el;
                          }}
                          className={`absolute inset-0 ${
                            drawTarget.mode !== "none" || selectedFieldIndex !== null || draggingTemplateBox
                              ? "pointer-events-auto"
                              : "pointer-events-none"
                          }`}
                          onMouseDown={(e) => handlePageMouseDown(e, p)}
                          onMouseMove={(e) => handlePageMouseMove(e, p)}
                          onMouseUp={(e) => handlePageMouseUp(e, p)}
                        >
                          {template?.fields.map((field, fieldIdx) => {
                            if (field.page !== p.page) return null;
                            if (selectedFieldIndex !== fieldIdx) return null;
                            const boxes = getFieldBoxes(field);
                            if (!boxes.length) return null;
                            return boxes.map((box, boxIdx) => {
                              const left = (box.x / p.width) * 100;
                              const top = (box.y / p.height) * 100;
                              const width = (box.width / p.width) * 100;
                              const height = (box.height / p.height) * 100;
                              const selected = selectedFieldIndex === fieldIdx;
                              const normalizedBox = normalizeEditableBox(box);
                              const nLeft = (normalizedBox.x / p.width) * 100;
                              const nTop = (normalizedBox.y / p.height) * 100;
                              const nWidth = (normalizedBox.width / p.width) * 100;
                              const nHeight = (normalizedBox.height / p.height) * 100;
                              return (
                                <div
                                  key={`field-box-${fieldIdx}-${boxIdx}`}
                                  className={`absolute rounded-sm border ${
                                    selected
                                      ? "border-orange-400 bg-orange-300/35 shadow-[0_0_0_1px_rgba(251,146,60,0.95)] cursor-move"
                                      : "border-cyan-400/60 bg-cyan-300/10"
                                  }`}
                                  style={{
                                    left: `${nLeft}%`,
                                    top: `${nTop}%`,
                                    width: `${nWidth}%`,
                                    height: `${nHeight}%`,
                                  }}
                                  onMouseDown={(e) => {
                                    if (!selected) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const pt = getPageCoordinates(e, p.width, p.height);
                                    if (
                                      box.width !== normalizedBox.width ||
                                      box.height !== normalizedBox.height
                                    ) {
                                      updateTemplateFieldBox(fieldIdx, boxIdx, () => normalizedBox);
                                    }
                                    setDraggingTemplateBox({
                                      fieldIndex: fieldIdx,
                                      boxIndex: boxIdx,
                                      page: p.page,
                                      offsetX: pt.x - normalizedBox.x,
                                      offsetY: pt.y - normalizedBox.y,
                                    });
                                  }}
                                  title="Selected field box: drag to move"
                                />
                              );
                            });
                          })}

                          {dragging && dragging.page === p.page && (
                            (() => {
                              const draft = normalizeBox(
                                dragging.startX,
                                dragging.startY,
                                dragging.currentX,
                                dragging.currentY,
                              );
                              return (
                                <div
                                  className="absolute rounded-sm border-2 border-amber-400 bg-amber-300/20"
                                  style={{
                                    left: `${(draft.x / p.width) * 100}%`,
                                    top: `${(draft.y / p.height) * 100}%`,
                                    width: `${(draft.width / p.width) * 100}%`,
                                    height: `${(draft.height / p.height) * 100}%`,
                                  }}
                                />
                              );
                            })()
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right Box: Template + Chat */}
            <div className="w-1/3 min-w-[350px] max-w-lg border-l border-neutral-800 bg-neutral-900/40 p-6 flex flex-col shadow-2xl">
              <div className="flex items-center text-indigo-400 mb-6 pb-4 border-b border-neutral-800">
                <Sparkles className="w-5 h-5 mr-3" />
                <h2 className="text-xl font-semibold">Gemini Template + Chat</h2>
              </div>

              <div className="flex-1 overflow-auto pr-2 custom-scrollbar space-y-6">
                {(analyzing || extracting || savingTemplate || templateLookupState === "checking") ? (
                  <div className="flex flex-col items-center justify-center h-48 text-neutral-500 space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <span className="animate-pulse">
                      {templateLookupState === "checking"
                        ? "Checking for existing template signature..."
                        : analyzing
                          ? "Generating template with Gemini 3.1 Pro..."
                          : extracting
                            ? "Extracting values with Gemini 3.1 Flash..."
                            : "Saving template to Firebase..."}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 text-xs space-y-1">
                      <div>
                        Library: <span className="text-neutral-200">{libraryId}</span>
                      </div>
                      <div>
                        Template signature:{" "}
                        <span className="text-neutral-300 break-all">
                          {templateSignature ?? "Not available yet"}
                        </span>
                      </div>
                      {matchedTemplateInfo?.sourcePdfUrl && (
                        <a
                          className="text-indigo-300 underline"
                          href={matchedTemplateInfo.sourcePdfUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open matched template source PDF
                        </a>
                      )}
                    </div>

                    {analysisModel && (
                      <div className="text-xs text-neutral-500">
                        Template model: <span className="text-neutral-300">{analysisModel}</span> (target:
                        Gemini 3.1 Pro)
                      </div>
                    )}
                    {extractionModel && (
                      <div className="text-xs text-neutral-500">
                        Extraction model: <span className="text-neutral-300">{extractionModel}</span> (target:
                        Gemini 3.1 Flash)
                      </div>
                    )}
                    {(templateLookupState === "none" || templateLookupState === "error") && (
                      <div className="rounded-md border border-amber-600 bg-amber-900/20 p-3 text-sm text-amber-200 space-y-2">
                        <div>
                          {templateLookupState === "none"
                            ? "No matching template found in this library."
                            : "Template lookup unavailable. You can still create a new template."}
                        </div>
                        <button
                          onClick={() => void handleCreateTemplateAndSave()}
                          className="w-full rounded-md bg-amber-700 hover:bg-amber-600 px-3 py-2 text-sm"
                        >
                          Create New Template (Pro) + Save to Library
                        </button>
                      </div>
                    )}
                    {template && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => void runExtraction(template, documentText, pages)}
                          className="rounded-md bg-indigo-700 hover:bg-indigo-600 px-3 py-2 text-sm"
                        >
                          Extract Values (Flash)
                        </button>
                        <button
                          onClick={() => void handleSaveCurrentTemplate()}
                          className="rounded-md bg-emerald-700 hover:bg-emerald-600 px-3 py-2 text-sm"
                        >
                          Save Template Changes
                        </button>
                      </div>
                    )}
                    {template && (
                      <div>
                        <h3 className="text-sm uppercase tracking-wide text-neutral-400 mb-3">
                          Extracted Template Fields ({template.fields.length})
                        </h3>
                        <div className="space-y-2 max-h-56 overflow-auto">
                          {template.fields.map((field, idx) => (
                            <button
                              key={`${field.label}-${idx}`}
                              ref={(el) => {
                                fieldRowRefs.current[idx] = el;
                              }}
                              className={`w-full text-left rounded-md border p-3 ${
                                selectedFieldIndex === idx
                                  ? "border-emerald-500 bg-emerald-900/20"
                                  : "border-neutral-800 bg-neutral-900"
                              }`}
                              onClick={() => setSelectedFieldIndex(idx)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-white truncate">{field.label}</span>
                                <span className="text-[11px] uppercase tracking-wide px-2 py-1 rounded bg-indigo-900/40 text-indigo-200">
                                  {field.type}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-neutral-400">
                                page {field.page} • source {field.source} • confidence{" "}
                                {Math.round((field.confidence ?? 0) * 100)}%
                              </div>
                              <div className="mt-1 text-[11px] text-neutral-500">
                                display: {field.displayType ?? "Text"}
                              </div>
                              {field.bbox && (
                                <div className="mt-1 text-[11px] text-neutral-500">
                                  box x:{field.bbox.x}, y:{field.bbox.y}, w:{field.bbox.width}, h:{field.bbox.height}
                                </div>
                              )}
                              {!field.bbox && !field.bboxes?.length && (
                                <div className="mt-1 text-[11px] text-amber-300">
                                  No bounding box yet. Select and set one from PDF.
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {template && (
                      <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs uppercase tracking-wide text-neutral-400">Template JSON</h4>
                          <button
                            onClick={() => void navigator.clipboard.writeText(JSON.stringify(template, null, 2))}
                            className="rounded bg-neutral-800 hover:bg-neutral-700 px-2 py-1 text-[11px]"
                          >
                            Copy JSON
                          </button>
                        </div>
                        <pre className="max-h-36 overflow-auto rounded border border-neutral-800 bg-neutral-950 p-2 text-[11px] text-neutral-300">
                          {JSON.stringify(template, null, 2)}
                        </pre>
                      </div>
                    )}

                    {template && selectedFieldIndex !== null && template.fields[selectedFieldIndex] && (
                      <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 space-y-3">
                        <h4 className="text-xs uppercase tracking-wide text-neutral-400">
                          Selected Field Editor
                        </h4>
                        <div className="space-y-2">
                          <label className="block text-xs text-neutral-400">Label</label>
                          <input
                            value={template.fields[selectedFieldIndex].label}
                            onChange={(e) =>
                              updateTemplateField(selectedFieldIndex, (field) => ({
                                ...field,
                                label: e.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs text-neutral-400">Type</label>
                          <select
                            value={template.fields[selectedFieldIndex].type}
                            onChange={(e) =>
                              updateTemplateField(selectedFieldIndex, (field) => ({
                                ...field,
                                type: e.target.value as FieldType,
                              }))
                            }
                            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
                          >
                            {fieldTypes.map((ft) => (
                              <option key={ft} value={ft}>
                                {ft}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs text-neutral-400">Display Type</label>
                          <select
                            value={template.fields[selectedFieldIndex].displayType ?? "Text"}
                            onChange={(e) =>
                              updateTemplateField(selectedFieldIndex, (field) => ({
                                ...field,
                                displayType: e.target.value as DisplayType,
                              }))
                            }
                            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
                          >
                            {displayTypes.map((dt) => (
                              <option key={dt} value={dt}>
                                {dt}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={beginAssignBoxForSelectedField}
                          className="w-full rounded-md bg-emerald-700 hover:bg-emerald-600 px-3 py-2 text-sm"
                        >
                          Set / Replace Box On PDF
                        </button>
                      </div>
                    )}

                    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 space-y-3">
                      <h4 className="text-xs uppercase tracking-wide text-neutral-400">Add Field + Draw Box</h4>
                      <div className="space-y-2">
                        <label className="block text-xs text-neutral-400">Label</label>
                        <input
                          value={newFieldLabel}
                          onChange={(e) => setNewFieldLabel(e.target.value)}
                          className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
                          placeholder="e.g. Applicant Signature"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs text-neutral-400">Type</label>
                        <select
                          value={newFieldType}
                          onChange={(e) => setNewFieldType(e.target.value as FieldType)}
                          className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
                        >
                          {fieldTypes.map((ft) => (
                            <option key={ft} value={ft}>
                              {ft}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs text-neutral-400">Display Type</label>
                        <select
                          value={newFieldDisplayType}
                          onChange={(e) => setNewFieldDisplayType(e.target.value as DisplayType)}
                          className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
                        >
                          {displayTypes.map((dt) => (
                            <option key={dt} value={dt}>
                              {dt}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={beginAddFieldWithBox}
                        disabled={!newFieldLabel.trim()}
                        className="w-full rounded-md bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 px-3 py-2 text-sm"
                      >
                        Add Field Then Draw Box On PDF
                      </button>
                    </div>

                    {drawTarget.mode !== "none" && (
                      <div className="rounded-md border border-amber-600 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
                        Drawing mode active. Drag on a page to place the box.
                        <button
                          onClick={() => {
                            setDrawTarget({ mode: "none" });
                            setDragging(null);
                          }}
                          className="ml-2 underline"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {analysis && (
                      <div className="prose prose-invert prose-p:text-neutral-300 max-w-none">
                        <ReactMarkdown
                          components={{
                            h1: (props) => (
                              <h1 className="text-xl font-bold text-white mb-3 leading-tight" {...props} />
                            ),
                            h2: (props) => (
                              <h2 className="text-lg font-semibold text-indigo-300 mt-5 mb-2" {...props} />
                            ),
                            p: (props) => (
                              <p className="text-neutral-300 leading-relaxed mb-3 text-sm" {...props} />
                            ),
                            strong: (props) => (
                              <strong className="font-semibold text-white" {...props} />
                            ),
                          }}
                        >
                          {analysis}
                        </ReactMarkdown>
                      </div>
                    )}

                    <div className="border-t border-neutral-800 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm uppercase tracking-wide text-neutral-400">Chat</h3>
                        {chatModel && (
                          <span className="text-[11px] text-neutral-500">Model: {chatModel}</span>
                        )}
                      </div>

                      <div className="space-y-2 max-h-56 overflow-auto mb-3">
                        {chatMessages.length === 0 ? (
                          <div className="text-xs text-neutral-500">
                            Ask extraction questions against this document + template.
                          </div>
                        ) : (
                          chatMessages.map((msg, i) => (
                            <div
                              key={i}
                              className={`rounded-md px-3 py-2 text-sm ${
                                msg.role === "user"
                                  ? "bg-indigo-700/30 text-indigo-100"
                                  : "bg-neutral-800 text-neutral-200"
                              }`}
                            >
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ))
                        )}
                        {chatLoading && (
                          <div className="text-xs text-neutral-500 flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Gemini is responding...
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void sendChatMessage();
                            }
                          }}
                          placeholder="Ask about extracted fields or values..."
                          className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                          disabled={chatLoading || !documentText}
                        />
                        <button
                          onClick={() => void sendChatMessage()}
                          disabled={chatLoading || !chatInput.trim() || !documentText}
                          className="p-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <SendHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
