export const GAME_CONFIG = {
  arena: {
    width: 26,
    depth: 18,
    bounds: { minX: -13, maxX: 13, minZ: -9, maxZ: 9 }
  },
  player: {
    hp: 100,
    speedMetersPerSecond: 6,
    dashSpeedMetersPerSecond: 12,
    dashDurationSeconds: 0.3,
    dashCooldownSeconds: 3,
    radiusMeters: 0.5,
    hurtRadiusMeters: 0.6
  }
} as const;

