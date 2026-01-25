export type Rng = {
  seed: number;
  nextUint32: () => number;
  nextFloat: () => number;
  nextInt: (maxExclusive: number) => number;
  nextRange: (min: number, max: number) => number;
  nextSign: () => 1 | -1;
  nextId: (prefix: string) => string;
};

export function createRng(seed: number): Rng {
  let state = (seed >>> 0) || 0x12345678;

  const nextUint32 = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };

  const nextFloat = (): number => nextUint32() / 0x100000000;

  const nextInt = (maxExclusive: number): number => {
    if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) return 0;
    return Math.floor(nextFloat() * maxExclusive);
  };

  const nextRange = (min: number, max: number): number => {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
    if (max <= min) return min;
    return min + nextFloat() * (max - min);
  };

  const nextSign = (): 1 | -1 => (nextFloat() > 0.5 ? 1 : -1);

  const nextId = (prefix: string): string => `${prefix}_${nextUint32().toString(36)}`;

  return { seed: seed >>> 0, nextUint32, nextFloat, nextInt, nextRange, nextSign, nextId };
}

export function createDefaultSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] >>> 0;
  }
  return (Math.floor(Math.random() * 0x100000000) >>> 0) || 0x12345678;
}

export function hashStringToSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

