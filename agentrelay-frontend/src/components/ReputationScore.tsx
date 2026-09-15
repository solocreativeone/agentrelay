export function ReputationScore({ score, hasRatings }: { score: number; hasRatings: boolean }) {
  if (!hasRatings) {
    return <span className="text-sm text-text-secondary">No ratings yet</span>;
  }

  const color = score >= 80 ? 'text-verified' : score >= 50 ? 'text-pending' : 'text-disputed';

  return (
    <div className="flex items-center gap-2">
      <span className={`font-display text-2xl font-semibold ${color}`}>{score}</span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
        <div
          className={`h-full ${score >= 80 ? 'bg-verified' : score >= 50 ? 'bg-pending' : 'bg-disputed'}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
