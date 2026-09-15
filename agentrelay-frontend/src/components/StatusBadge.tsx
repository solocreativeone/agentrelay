const STATUS_STYLES: Record<string, string> = {
  Open: 'bg-text-secondary/15 text-text-secondary',
  Claimed: 'bg-primary/15 text-primary',
  ProofSubmitted: 'bg-pending/15 text-pending',
  Completed: 'bg-verified/15 text-verified',
  Disputed: 'bg-disputed/15 text-disputed',
};

const STATUS_LABELS: Record<string, string> = {
  Open: 'Open',
  Claimed: 'Claimed',
  ProofSubmitted: 'Proof submitted',
  Completed: 'Completed',
  Disputed: 'Disputed',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.Open;
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-medium ${style}`}>
      {label}
    </span>
  );
}
