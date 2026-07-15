export const PROFIT_THRESHOLDS = [
  { label: "Усі", value: 0 },
  { label: "+10k", value: 10_000 },
  { label: "+20k", value: 20_000 },
  { label: "+30k", value: 30_000 },
  { label: "+50k", value: 50_000 },
  { label: "+75k", value: 75_000 },
  { label: "+100k", value: 100_000 },
  { label: "+150k", value: 150_000 },
  { label: "+200k", value: 200_000 },
  { label: "+300k", value: 300_000 },
  { label: "+500k", value: 500_000 },
  { label: "+750k", value: 750_000 },
  { label: "+1M", value: 1_000_000 },
  { label: "+2M", value: 2_000_000 },
  { label: "+5M", value: 5_000_000 },
] as const;

export const DEFAULT_PROFIT_THRESHOLD = 10_000;
