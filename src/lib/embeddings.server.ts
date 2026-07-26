/**
 * Server-only embeddings helper.
 * Delegates to the shared Gateway caller (openai/text-embedding-3-small, 1536 dims).
 */
import { callLovableAIEmbeddings } from "./ai-gateway.server";

export async function embedText(text: string): Promise<number[] | null> {
  return callLovableAIEmbeddings(text);
}

/** Format a vector as pgvector text literal (also accepted by postgrest for vector cols). */
export function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}