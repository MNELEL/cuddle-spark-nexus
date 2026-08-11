export type LhRun = { url: string; isRepresentativeRun?: boolean; summary?: Record<string, number> };
export declare function verdict(score: number | null | undefined, threshold: number): string;
export declare function pct(score: number | null | undefined): string;
export declare function pickRuns(manifest: LhRun[]): LhRun[];
export declare function buildSummary(input: {
  manifest: LhRun[];
  assertions?: { auditId: string; url?: string; operator?: string; expected?: unknown; actual?: unknown }[];
  thresholds: Record<string, number>;
}): {
  markdown: string;
  rows: { path: string; url: string; scores: Record<string, number | null> }[];
  failures: { path: string; category: string; score: number; threshold: number }[];
};
export declare function summaryFromDisk(thresholds: Record<string, number>): ReturnType<typeof buildSummary>;
