export type SfxId =
  | 'uiToggle'
  | 'uiClick'
  | 'weaponFire'
  | 'weaponDry'
  | 'weaponHit'
  | 'weaponImpact'
  | 'explosion'
  | 'throw'
  | 'smoke'
  | 'trapTrigger'
  | 'nearMiss'
  | 'slowmo'
  | 'pickup'
  | 'airdrop'
  | 'matchEnd';

export const SFX_MAP: Record<SfxId, { frequencyHz: number; durationSeconds: number; bus: 'sfx' | 'music' }> = {
  uiToggle: { frequencyHz: 520, durationSeconds: 0.05, bus: 'sfx' },
  uiClick: { frequencyHz: 640, durationSeconds: 0.04, bus: 'sfx' },
  weaponFire: { frequencyHz: 520, durationSeconds: 0.03, bus: 'sfx' },
  weaponDry: { frequencyHz: 220, durationSeconds: 0.04, bus: 'sfx' },
  weaponHit: { frequencyHz: 780, durationSeconds: 0.035, bus: 'sfx' },
  weaponImpact: { frequencyHz: 420, durationSeconds: 0.03, bus: 'sfx' },
  explosion: { frequencyHz: 140, durationSeconds: 0.08, bus: 'sfx' },
  throw: { frequencyHz: 600, durationSeconds: 0.045, bus: 'sfx' },
  smoke: { frequencyHz: 300, durationSeconds: 0.06, bus: 'sfx' },
  trapTrigger: { frequencyHz: 260, durationSeconds: 0.07, bus: 'sfx' },
  nearMiss: { frequencyHz: 920, durationSeconds: 0.03, bus: 'sfx' },
  slowmo: { frequencyHz: 340, durationSeconds: 0.1, bus: 'music' },
  pickup: { frequencyHz: 720, durationSeconds: 0.05, bus: 'sfx' },
  airdrop: { frequencyHz: 620, durationSeconds: 0.06, bus: 'sfx' },
  matchEnd: { frequencyHz: 360, durationSeconds: 0.12, bus: 'music' }
};
