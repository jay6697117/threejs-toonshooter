export type SfxId =
  | 'uiToggle'
  | 'uiClick'
  | 'weaponFire'
  | 'weaponDry'
  | 'explosion'
  | 'pickup'
  | 'airdrop'
  | 'matchEnd';

export const SFX_MAP: Record<SfxId, { frequencyHz: number; durationSeconds: number; bus: 'sfx' | 'music' }> = {
  uiToggle: { frequencyHz: 520, durationSeconds: 0.05, bus: 'sfx' },
  uiClick: { frequencyHz: 640, durationSeconds: 0.04, bus: 'sfx' },
  weaponFire: { frequencyHz: 520, durationSeconds: 0.03, bus: 'sfx' },
  weaponDry: { frequencyHz: 220, durationSeconds: 0.04, bus: 'sfx' },
  explosion: { frequencyHz: 140, durationSeconds: 0.08, bus: 'sfx' },
  pickup: { frequencyHz: 720, durationSeconds: 0.05, bus: 'sfx' },
  airdrop: { frequencyHz: 620, durationSeconds: 0.06, bus: 'sfx' },
  matchEnd: { frequencyHz: 360, durationSeconds: 0.12, bus: 'music' }
};

