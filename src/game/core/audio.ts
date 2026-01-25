import { SFX_MAP, type SfxId } from '../audio/sfxMap';

export type AudioBuses = {
  master: GainNode;
  sfx: GainNode;
  music: GainNode;
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private buses: AudioBuses | null = null;

  getContext(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    }
    return this.ctx;
  }

  getBuses(): AudioBuses {
    if (!this.buses) {
      const ctx = this.getContext();
      const master = ctx.createGain();
      const sfx = ctx.createGain();
      const music = ctx.createGain();

      sfx.connect(master);
      music.connect(master);
      master.connect(ctx.destination);

      this.buses = { master, sfx, music };
    }
    return this.buses;
  }

  async unlock(): Promise<void> {
    const ctx = this.getContext();
    if (ctx.state === 'running') return;
    await ctx.resume();
  }

  setVolumes(volumes: { master: number; sfx: number; music: number }): void {
    const buses = this.getBuses();
    buses.master.gain.value = clamp01(volumes.master);
    buses.sfx.gain.value = clamp01(volumes.sfx);
    buses.music.gain.value = clamp01(volumes.music);
  }

  playBeep(options?: { frequencyHz?: number; durationSeconds?: number; bus?: 'sfx' | 'music' }): void {
    const ctx = this.getContext();
    const buses = this.getBuses();

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = options?.frequencyHz ?? 440;

    const gain = ctx.createGain();
    gain.gain.value = 0.0;

    const now = ctx.currentTime;
    const duration = options?.durationSeconds ?? 0.06;
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.005);
    gain.gain.linearRampToValueAtTime(0.0, now + duration);

    osc.connect(gain);
    gain.connect((options?.bus ?? 'sfx') === 'music' ? buses.music : buses.sfx);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playSfx(id: SfxId): void {
    const cfg = SFX_MAP[id];
    this.playBeep({ frequencyHz: cfg.frequencyHz, durationSeconds: cfg.durationSeconds, bus: cfg.bus });
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
