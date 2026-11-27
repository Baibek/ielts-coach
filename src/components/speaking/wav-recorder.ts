"use client";

// Records microphone audio and encodes it as 16 kHz mono 16-bit WAV, a format
// every speech-to-text provider accepts (Groq Whisper and Gemini).

const TARGET_RATE = 16_000;

export type Recording = { blob: Blob; durationSec: number };

export class WavRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private chunks: Float32Array[] = [];
  private startedAt = 0;
  level = 0; // 0..1, for a simple input meter

  /** Ask for the microphone once; throws a DOMException ("NotAllowedError", …) if refused. */
  async open(): Promise<void> {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
  }

  async start(): Promise<void> {
    await this.open();
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    await this.ctx.resume();
    this.source = this.ctx.createMediaStreamSource(this.stream!);
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    this.chunks = [];
    this.node.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(data));
      let sum = 0;
      for (let i = 0; i < data.length; i += 16) sum += data[i] * data[i];
      this.level = Math.min(1, Math.sqrt(sum / (data.length / 16)) * 4);
    };
    this.source.connect(this.node);
    this.node.connect(this.ctx.destination);
    this.startedAt = performance.now();
  }

  async stop(): Promise<Recording> {
    const durationSec = (performance.now() - this.startedAt) / 1000;
    const rate = this.ctx?.sampleRate ?? 48_000;
    this.node?.disconnect();
    this.source?.disconnect();
    await this.ctx?.close().catch(() => {});
    this.node = null;
    this.source = null;
    this.ctx = null;
    this.level = 0;
    const samples = downsample(concat(this.chunks), rate, TARGET_RATE);
    this.chunks = [];
    return { blob: encodeWav(samples, TARGET_RATE), durationSec };
  }

  close() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}

function concat(chunks: Float32Array[]): Float32Array {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from <= to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
