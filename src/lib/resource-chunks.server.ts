/**
 * Server-only helper: split verbatim source text into chunks and store them
 * with embeddings, so the library can quote the original document (not only
 * the AI summary) when answering questions or generating new material.
 */
import { embedText } from "./embeddings.server";

const CHUNK_SIZE = 1200;
const OVERLAP = 150;
const MAX_CHUNKS = 60;

export function chunkText(text: string): string[] {
  const clean = (text ?? "").replace(/\r/g, "").trim();
  if (!clean) return [];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length && out.length < MAX_CHUNKS) {
    let end = Math.min(i + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      const brk = clean.lastIndexOf("\n", end);
      if (brk > i + CHUNK_SIZE * 0.5) end = brk;
    }
    const piece = clean.slice(i, end).trim();
    if (piece) out.push(piece);
    if (end >= clean.length) break;
    i = Math.max(end - OVERLAP, i + 1);
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = { from: (t: string) => any };

/** Replaces all chunks of a resource with freshly embedded ones. Never throws. */
export async function indexResourceChunks(
  supabase: SupabaseLike,
  ownerId: string,
  resourceId: string,
  text: string,
): Promise<{ chunks: number }> {
  try {
    const pieces = chunkText(text);
    await supabase.from("resource_chunks").delete().eq("resource_id", resourceId);
    if (pieces.length === 0) return { chunks: 0 };

    const rows: { resource_id: string; owner_id: string; chunk_index: number; content: string; embedding: string | null }[] = [];
    for (let idx = 0; idx < pieces.length; idx++) {
      const vec = await embedText(pieces[idx]!);
      rows.push({
        resource_id: resourceId,
        owner_id: ownerId,
        chunk_index: idx,
        content: pieces[idx]!,
        embedding: vec ? `[${vec.join(",")}]` : null,
      });
    }
    const { error } = await supabase.from("resource_chunks").insert(rows as never);
    if (error) console.error("[chunks insert]", error);
    return { chunks: rows.length };
  } catch (e) {
    console.error("[indexResourceChunks]", e);
    return { chunks: 0 };
  }
}
