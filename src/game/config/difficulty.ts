export const DIFFICULTY_IDS = ['easy', 'normal', 'hard'] as const;
export type DifficultyId = (typeof DIFFICULTY_IDS)[number];

export type DifficultyConfig = {
  id: DifficultyId;
  name: string;
  aiAimErrorMultiplier: number;
  aiFireConfidenceMultiplier: number;
  aiThinkIntervalSteps: number;
};

export const DIFFICULTY_CONFIGS: Record<DifficultyId, DifficultyConfig> = {
  easy: { id: 'easy', name: 'Easy', aiAimErrorMultiplier: 1.6, aiFireConfidenceMultiplier: 0.75, aiThinkIntervalSteps: 3 },
  normal: { id: 'normal', name: 'Normal', aiAimErrorMultiplier: 1.0, aiFireConfidenceMultiplier: 1.0, aiThinkIntervalSteps: 2 },
  hard: { id: 'hard', name: 'Hard', aiAimErrorMultiplier: 0.7, aiFireConfidenceMultiplier: 1.15, aiThinkIntervalSteps: 1 }
};
