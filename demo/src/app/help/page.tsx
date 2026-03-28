import Link from "next/link";

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-neutral-200 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">LiteParse Studio Help</h1>
          <Link
            href="/"
            className="px-4 py-2 rounded-md bg-indigo-700 hover:bg-indigo-600 text-sm"
          >
            Back To Studio
          </Link>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-indigo-300">What The Boxes Mean</h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-neutral-300">
            <li>Indigo hover boxes: LiteParse text item bounding boxes.</li>
            <li>No additional candidate overlay boxes are rendered.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-indigo-300">Standard Workflow</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-neutral-300">
            <li>Choose a Library ID and upload a document.</li>
            <li>App parses with LiteParse and checks template signature in Firebase.</li>
            <li>If template exists: extract values immediately (Gemini Flash path).</li>
            <li>If no template exists: create a new template (Gemini Pro path), then save as final step.</li>
            <li>Refine fields and boxes manually, then save to library.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-indigo-300">Right Pane Modes</h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-neutral-300">
            <li><strong>Field Edit</strong>: configure field labels, keys, types, display types, and field boxes.</li>
            <li><strong>Extract</strong>: run extraction and inspect form instance output plus chat.</li>
            <li><strong>Form Template Edit</strong>: page tabs + accordion groups for body text, page/section headers, and merge preview.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-indigo-300">Editing Template Fields</h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-neutral-300">
            <li>Select a field in Extracted Template Fields to highlight its mapped box.</li>
            <li>Edit key/label/type/display type from the field editor.</li>
            <li>Click on the PDF to jump the selected orange box to that location (centered).</li>
            <li>Drag the selected orange box to move it.</li>
            <li>Use Set/Replace Box On PDF to redraw an exact field region.</li>
            <li>Use Add Field + Draw Box for missing fields.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-indigo-300">Shortcuts And Controls</h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-neutral-300">
            <li><strong>Enter</strong> in Chat input: send message.</li>
            <li><strong>Mouse drag</strong> center divider: resize left PDF pane and right control pane.</li>
            <li><strong>Mouse wheel / scroll</strong> in left pane: navigate PDF pages.</li>
            <li><strong>Zoom +/- buttons</strong>: change PDF rendering scale.</li>
            <li><strong>Copy JSON</strong> buttons: copy template or extracted JSON for downstream systems.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-indigo-300">Second Pass Merge Placement</h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-neutral-300">
            <li>Use <strong>Apply Field Edits To Body (Pass 2)</strong> in Form Template Edit to inject merge placeholders from field boxes.</li>
            <li>Merged Preview options let you hide page references and switch between merge codes and sample-value substitution.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-indigo-300">Model Routing</h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-neutral-300">
            <li>Template generation route targets Gemini 3.1 Pro first.</li>
            <li>Extraction/chat routes target Gemini 3.1 Flash first.</li>
            <li>Fallback models apply if the primary model is unavailable in your account.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
