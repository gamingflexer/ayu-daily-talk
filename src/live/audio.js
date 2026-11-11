// Browser audio for the Live API.
//  - Mic: any device rate → 16 kHz mono 16-bit PCM, ~100 ms chunks, base64.
//  - Speaker: 24 kHz 16-bit PCM chunks played back to back; stop() on barge-in.
// Echo cancellation is on so Ayu does not hear herself through the speaker.

const WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ratio = sampleRate / options.processorOptions.targetRate;
    this.chunk = Math.round(options.processorOptions.targetRate * 0.1);
    this.buf = new Int16Array(this.chunk);
    this.n = 0;
    this.pos = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let sum = 0;
    // Linear resample to the target rate.
    while (this.pos < ch.length) {
      const i = Math.floor(this.pos);
      const f = this.pos - i;
      const a = ch[i];
      const b = i + 1 < ch.length ? ch[i + 1] : a;
      const s = Math.max(-1, Math.min(1, a + (b - a) * f));
      sum += s * s;
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.chunk) {
        this.port.postMessage({ pcm: this.buf.buffer, rms: Math.sqrt(sum / this.chunk) }, [this.buf.buffer]);
        this.buf = new Int16Array(this.chunk);
        this.n = 0;
        sum = 0;
      }
      this.pos += this.ratio;
    }
    this.pos -= ch.length;
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
`;

export function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Start the microphone.
 * @param {{targetRate?: number, onChunk: (b64: string) => void, onLevel?: (rms: number) => void}} opts
 */
export async function startMic({ targetRate = 16000, onChunk, onLevel }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = new AudioContext();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'pcm-capture', { processorOptions: { targetRate } });
  let muted = false;
  node.port.onmessage = (e) => {
    onLevel?.(muted ? 0 : e.data.rms);
    if (!muted) onChunk(bytesToBase64(e.data.pcm));
  };
  src.connect(node);
  // Keep the graph pulling without making sound.
  const sink = ctx.createGain();
  sink.gain.value = 0;
  node.connect(sink).connect(ctx.destination);

  return {
    stream,
    setMuted(v) {
      muted = v;
      stream.getAudioTracks().forEach((t) => (t.enabled = !v));
    },
    async stop() {
      stream.getTracks().forEach((t) => t.stop());
      node.port.onmessage = null;
      await ctx.close().catch(() => {});
    },
  };
}

/** Plays 16-bit PCM chunks back to back. */
export function createPlayer(sampleRate = 24000) {
  const ctx = new AudioContext({ sampleRate });
  let at = 0;
  const live = new Set();
  return {
    play(b64) {
      if (ctx.state === 'suspended') ctx.resume();
      const bytes = base64ToBytes(b64);
      const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1);
      const buf = ctx.createBuffer(1, pcm.length, sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.connect(ctx.destination);
      at = Math.max(at, ctx.currentTime + 0.03);
      node.start(at);
      at += buf.duration;
      live.add(node);
      node.onended = () => live.delete(node);
    },
    /** She started talking: drop what Ayu was saying. */
    stop() {
      for (const n of live) {
        try {
          n.stop();
        } catch {
          // already stopped
        }
      }
      live.clear();
      at = 0;
    },
    get speaking() {
      return live.size > 0;
    },
    close() {
      this.stop();
      return ctx.close().catch(() => {});
    },
  };
}

/** Grabs JPEG frames (≤1 fps, as the Live API asks) from a video stream. */
export function startFrames(stream, onFrame, { fps = 1, width = 640 } = {}) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  video.play().catch(() => {});
  const canvas = document.createElement('canvas');
  const timer = setInterval(() => {
    if (!video.videoWidth) return;
    const scale = Math.min(1, width / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    onFrame(b64);
  }, 1000 / fps);
  return () => {
    clearInterval(timer);
    video.srcObject = null;
  };
}
