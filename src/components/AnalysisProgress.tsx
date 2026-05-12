import { useAppStore } from '../store';

export function AnalysisProgress() {
  const progress = useAppStore((s) => s.analysisProgress);

  if (!progress) return null;

  const pct = Math.round((progress.done / progress.total) * 100);

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
      <div className="flex items-center justify-between">
        <span>Analyzing… {progress.done} / {progress.total}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-amber-200">
        <div
          className="h-full bg-amber-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
