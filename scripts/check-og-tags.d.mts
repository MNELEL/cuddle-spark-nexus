export declare const ROOT: string;
export declare const IMAGE_RULES: {
  recommended: { width: number; height: number };
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  ratioMin: number;
  ratioMax: number;
  formats: string[];
  minBytes: number;
  maxBytes: number;
};
export declare function extractMeta(text: string, consts: Record<string, string>): Record<string, string | null>;
export declare function imageSize(buf: Buffer): { width: number; height: number } | null;
export declare function auditOgAssets(): {
  problems: { file: string; reason: string }[];
  count: number;
  urls: string[];
};
export declare function auditOgTags(): {
  problems: { file: string; reason: string }[];
  routeCount: number;
  assetCount: number;
  images: string[];
};
