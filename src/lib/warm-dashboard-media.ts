// Warm media resources used by the dashboard so first interaction is instant.
// Called right after a successful PIN unlock (user gesture).

let warmed = false;

export function warmDashboardMedia() {
  if (warmed || typeof window === "undefined") return;
  warmed = true;

  // 1. Warm a shared AudioContext for /sound-board (WebAudio chimes/beeps).
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) {
      const ctx = new Ctor();
      (window as unknown as { __caAudioCtx?: AudioContext }).__caAudioCtx = ctx;
      // Resume now while we still have the unlock gesture in scope.
      ctx.resume?.().catch(() => {});
      // Play a silent buffer to fully unlock audio on iOS/Safari.
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    }
  } catch {
    // best-effort
  }

  // 2. Prefetch lucide icon chunks + any future image assets used by the dashboard.
  //    Icons are bundled with the route chunks, so route preload above already covers them.
  //    Add explicit <link rel="prefetch"> hooks here if/when image/audio files are introduced.
  const assets: string[] = [];
  for (const href of assets) {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = href.endsWith(".mp3") || href.endsWith(".wav") || href.endsWith(".ogg") ? "audio" : "image";
    link.href = href;
    document.head.appendChild(link);
  }
}