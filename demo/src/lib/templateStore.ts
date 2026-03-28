import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseServices } from "@/lib/firebaseAdmin";

export interface StoredTemplateRecord {
  id: string;
  libraryId: string;
  signature: string;
  templateName: string;
  template: unknown;
  sourcePdfPath: string;
  sourcePdfUrl?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const COLLECTION = "libraries";

function templateDocPath(libraryId: string, signature: string): string {
  return `${COLLECTION}/${libraryId}/templates/${signature}`;
}

export async function findTemplateBySignature(libraryId: string, signature: string) {
  const { db } = getFirebaseServices();
  const ref = db.doc(templateDocPath(libraryId, signature));
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as Omit<StoredTemplateRecord, "id">;
  return {
    id: snap.id,
    ...data,
  } satisfies StoredTemplateRecord;
}

export async function saveTemplateRecord(input: {
  libraryId: string;
  signature: string;
  templateName: string;
  template: unknown;
  sourcePdfPath: string;
  sourcePdfUrl?: string;
}) {
  const { db } = getFirebaseServices();
  const ref = db.doc(templateDocPath(input.libraryId, input.signature));

  const existing = await ref.get();
  const now = Timestamp.now();

  const payload = {
    libraryId: input.libraryId,
    signature: input.signature,
    templateName: input.templateName,
    template: input.template,
    sourcePdfPath: input.sourcePdfPath,
    sourcePdfUrl: input.sourcePdfUrl,
    updatedAt: now,
    createdAt: existing.exists ? existing.data()?.createdAt ?? now : now,
  };

  await ref.set(payload, { merge: true });
  return {
    id: ref.id,
    ...payload,
  } satisfies StoredTemplateRecord;
}
