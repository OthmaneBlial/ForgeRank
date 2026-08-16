export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"] as const;

export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export function confidenceFromObservations(observations: number, required: number): Confidence {
  if (required <= 0 || observations >= required) return "HIGH";
  if (observations >= Math.ceil(required * 0.65)) return "MEDIUM";
  if (observations >= 2) return "LOW";
  return "INSUFFICIENT";
}

export const CONFIDENCE_MULTIPLIER: Record<Confidence, number> = {
  HIGH: 1,
  MEDIUM: 0.92,
  LOW: 0.75,
  INSUFFICIENT: 0.5,
};
