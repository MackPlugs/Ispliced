export type BpmFilterType = "exact" | "range";

export interface BpmFilter {
  minBpm?: number;
  maxBpm?: number;
  bpm?: string;
}
