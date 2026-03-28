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
            <li>If no template exists: create a new template (Gemini Pro path) and save.</li>
            <li>Refine fields and boxes manually, then save template updates.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-indigo-300">Editing Template Fields</h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-neutral-300">
            <li>Select a field in Extracted Template Fields to highlight its mapped box.</li>
            <li>Edit label/type from the field editor.</li>
            <li>Use Set/Replace Box On PDF to redraw an exact field region.</li>
            <li>Use Add Field + Draw Box for missing fields.</li>
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
