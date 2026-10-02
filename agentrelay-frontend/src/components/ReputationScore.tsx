export function ReputationScore({ score, hasRatings }: { score: number; hasRatings: boolean }) {
  if (!hasRatings) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-border/60 bg-surface-subtle px-2 py-0.5 font-mono text-[11px] text-text-muted">
        Unrated
      </span>
    );
  }

  const isHigh = score >= 80;
  const isMid = score >= 50;

  const textColor = isHigh ? 'text-verified' : isMid ? 'text-pending' : 'text-disputed';
  const barBg = isHigh ? 'bg-verified' : isMid ? 'bg-pending' : 'bg-disputed';

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-baseline gap-0.5">
        <span className={`font-mono text-sm font-bold tabular-nums ${textColor}`}>{score}</span>
        <span className="font-mono text-[10px] text-text-muted">/100</span>
      </div>
      <div className="h-1.5 w-20 overflow-hidden rounded-full border border-border/60 bg-surface-subtle">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barBg}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}
