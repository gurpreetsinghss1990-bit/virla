export type NativeProgressBarProps = {
  progress: number;
  color: string;
  trackColor: string;
  height?: number;
};

export const clampProgress = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};
