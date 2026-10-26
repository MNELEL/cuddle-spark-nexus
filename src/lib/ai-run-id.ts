const HEADER = "X-Lovable-AIG-Run-ID";
export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(HEADER)) headers.set(HEADER, runId);
      const response = await fetch(input, { ...init, headers });
      runId ??= response.headers.get(HEADER)?.trim() || undefined;
      return response;
    },
  };
}