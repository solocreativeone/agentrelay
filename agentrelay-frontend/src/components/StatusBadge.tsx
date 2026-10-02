type StatusConfig = {
  label: string;
  badgeClass: string;
  dotClass: string;
  ping?: boolean;
};

const STATUS_CONFIGS: Record<string, StatusConfig> = {
  Open: {
    label: 'Open',
    badgeClass: 'bg-primary/10 text-primary border-primary/30',
    dotClass: 'bg-primary',
  },
  Claimed: {
    label: 'Claimed',
    badgeClass: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    dotClass: 'bg-indigo-400',
    ping: true,
  },
  ProofSubmitted: {
    label: 'Proof Submitted',
    badgeClass: 'bg-pending/10 text-pending border-pending/30',
    dotClass: 'bg-pending',
    ping: true,
  },
  Completed: {
    label: 'Completed',
    badgeClass: 'bg-verified/10 text-verified border-verified/30',
    dotClass: 'bg-verified',
  },
  Disputed: {
    label: 'Disputed',
    badgeClass: 'bg-disputed/10 text-disputed border-disputed/30',
    dotClass: 'bg-disputed',
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIGS[status] ?? {
    label: status,
    badgeClass: 'bg-surface-subtle text-text-secondary border-border',
    dotClass: 'bg-text-secondary',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-tight ${config.badgeClass}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {config.ping && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${config.dotClass}`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      </span>
      <span>{config.label}</span>
    </span>
  );
}
