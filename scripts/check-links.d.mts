export declare const ROOT: string;
export declare const SITE_HOST: string;
export declare function readRoutePaths(): string[];
export declare function extractLinks(text: string): { internal: string[]; external: string[] };
export declare function auditLinks(): {
  problems: { file: string; link: string; reason: string }[];
  externalUrls: string[];
  fileCount: number;
  linkCount: number;
  routeCount: number;
};
