# LiteParse Demo App

This demo shows a local LiteParse + Gemini workflow:

1. Upload a document and parse it with LiteParse.
2. Build a template from both extracted text and page screenshots.
3. Review extracted fields (label, type, source, confidence, bounding box).
4. Chat with Gemini for follow-up extraction questions against the parsed document and template.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
In-app usage documentation is available at `/help` (top-right Help navigation).

## Environment

Create `.env.local` with:

```bash
GEMINI_API_KEY=your_api_key_here

# Model routing
# Template generation defaults to Gemini 3.1 Pro
# Extraction/chat defaults to Gemini 3.1 Flash
# Optional overrides:
# GEMINI_TEMPLATE_MODEL=gemini-3.1-pro
# GEMINI_EXTRACTION_MODEL=gemini-3.1-flash

# Firebase Admin (server-side)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

## Notes

- Template generation uses multimodal prompting (text + screenshots).
- Parse output now also includes visual detections (blank lines, checkboxes, and input-like boxes) derived from screenshots.
- Each page includes an overlay screenshot with text and visual bounding boxes for QA and debugging.
- Template matching uses a deterministic document signature.
- If a matching template exists in the selected library, extraction runs with Gemini 3.1 Flash.
- If no template exists, the UI prompts to create/save a new template in the selected library.
- Chat/extraction flows prefer template + text/structure context and do not require screenshots by default.
- Screenshots are still useful when fields rely on visual cues (blank lines, checkboxes, layout-only form elements).
