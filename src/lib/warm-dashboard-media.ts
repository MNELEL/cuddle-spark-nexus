// Warm media resources used by the dashboard so first interaction is instant.
// Called right after a successful PIN unlock — we're still inside the user
// gesture, which is what unlocks audio on iOS/Safari.

let warmed = false;

type Win = Window & {
  webkitAudioContext?: typeof AudioContext;
  __caAudioCtx?: AudioContext;
};

/** Get (or lazily create) the shared AudioContext used across the dashboard. */
export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as Win;
  if (w.__caAudioCtx) return w.__caAudioCtx;
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    const ctx = new Ctor();
    w.__caAudioCtx = ctx;
    return ctx;
  } catch {
    return null;
  }
}

function prefetchAsset(href: string) {
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = /\.(mp3|wav|ogg|m4a)$/i.test(href)
    ? "audio"
    : /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(href)
      ? "image"
      : "fetch";
  link.href = href;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}

export function warmDashboardMedia() {
  if (warmed || typeof window === "undefined") return;
  warmed = true;

  // 1. Warm & unlock the shared AudioContext for /sound-board.
  const ctx = getSharedAudioContext();
  if (ctx) {
    try {
      ctx.resume?.().catch(() => {});
      // Silent 1-sample buffer — fully unlocks audio on iOS/Safari.
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);

      // JIT-compile the oscillator + gain graph used by sound-board tones,
      // routed through a muted gain so nothing is audible.
      const mute = ctx.createGain();
      mute.gain.value = 0;
      mute.connect(ctx.destination);
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = 440;
      o.connect(mute);
      const t0 = ctx.currentTime;
      o.start(t0);
      o.stop(t0 + 0.02);
    } catch {
      // best-effort
    }
  }

  // 2. Prefetch any static media assets that live in the dashboard.
  //    (Icons are bundled inside the route chunks preloaded by the router.)
  const assets: string[] = [];
  for (const href of assets) prefetchAsset(href);
}