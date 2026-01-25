export type Settings = {
  version: 1;
  graphics: {
    maxDpr: number;
    shadows: boolean;
  };
  audio: {
    master: number;
    sfx: number;
    music: number;
  };
};

const STORAGE_KEY = 'sanguoShooterSettings';

export function getDefaultSettings(): Settings {
  return {
    version: 1,
    graphics: {
      maxDpr: 2,
      shadows: true
    },
    audio: {
      master: 0.9,
      sfx: 0.9,
      music: 0.7
    }
  };
}

export function loadSettings(): Settings {
  const fallback = getDefaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    if (parsed.version !== 1) return fallback;

    return {
      version: 1,
      graphics: {
        maxDpr: clampNumber(parsed.graphics?.maxDpr ?? fallback.graphics.maxDpr, 1, 3),
        shadows: Boolean(parsed.graphics?.shadows ?? fallback.graphics.shadows)
      },
      audio: {
        master: clampNumber(parsed.audio?.master ?? fallback.audio.master, 0, 1),
        sfx: clampNumber(parsed.audio?.sfx ?? fallback.audio.sfx, 0, 1),
        music: clampNumber(parsed.audio?.music ?? fallback.audio.music, 0, 1)
      }
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

