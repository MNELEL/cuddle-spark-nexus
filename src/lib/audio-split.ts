/**
 * פיצול אוטומטי של הקלטות שיעור כבדות לחלקים קטנים שה-AI יכול לתמלל.
 * ההקלטה מפוענחת בדפדפן, מסוננת לדיבור (מונו, 16kHz — טווח הדיבור),
 * ומחולקת לקטעים באורך אחיד. כל קטע נשמר כשיעור נפרד ("חלק 1 מתוך 3").
 */

/** קצב דגימה שמתאים לדיבור ומקטין את הקובץ פי כמה. */
export const SPEECH_SAMPLE_RATE = 16000;
/** גודל מקסימלי לחלק אחד (בייטים) — מתחת למגבלת התמלול של 24MB. */
export const MAX_PART_BYTES = 18 * 1024 * 1024;

export type AudioPart = {
  file: File;
  index: number;
  total: number;
  seconds: number;
};

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** ממזג לערוץ אחד ומדלל לקצב דיבור. */
function toMonoSpeech(buf: AudioBuffer): Float32Array {
  const channels = buf.numberOfChannels;
  const ratio = buf.sampleRate / SPEECH_SAMPLE_RATE;
  const outLen = Math.floor(buf.length / ratio);
  const out = new Float32Array(outLen);
  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c++) data.push(buf.getChannelData(c));
  for (let i = 0; i < outLen; i++) {
    const src = Math.floor(i * ratio);
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += data[c][src] ?? 0;
    out[i] = sum / channels;
  }
  return out;
}

/**
 * מחלק קובץ אודיו לחלקים מוכנים לתמלול.
 * קובץ קטן שאין צורך לפצל מוחזר כחלק בודד ללא עיבוד מיותר.
 */
export async function splitAudioForTranscription(
  file: File,
  maxBytes: number = MAX_PART_BYTES,
): Promise<AudioPart[]> {
  const AudioCtx: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (file.size <= maxBytes || !AudioCtx) {
    return [{ file, index: 1, total: 1, seconds: 0 }];
  }

  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
    const mono = toMonoSpeech(decoded);
    const bytesPerSample = 2;
    const samplesPerPart = Math.floor((maxBytes - 44) / bytesPerSample);
    const total = Math.max(1, Math.ceil(mono.length / samplesPerPart));
    const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_") || "lesson";

    const parts: AudioPart[] = [];
    for (let i = 0; i < total; i++) {
      const slice = mono.subarray(i * samplesPerPart, Math.min((i + 1) * samplesPerPart, mono.length));
      const blob = encodeWav(slice, SPEECH_SAMPLE_RATE);
      parts.push({
        file: new File([blob], `${base}-part${i + 1}.wav`, { type: "audio/wav" }),
        index: i + 1,
        total,
        seconds: Math.round(slice.length / SPEECH_SAMPLE_RATE),
      });
    }
    return parts;
  } finally {
    void ctx.close();
  }
}
