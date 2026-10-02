import { type ReactNode } from 'react';
import { ConnectButton } from './ConnectButton';
import { CONTRACTS } from '../config/contracts';
import { truncateAddress } from '../lib/format';

type Page = 'agents' | 'tasks';

export function AppShell({
  page,
  onNavigate,
  children,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-bg text-text-primary antialiased">
      {/* Sidebar (Desktop) / Top Nav (Mobile & Tablet) */}
      <aside className="border-b lg:border-b-0 lg:border-r border-border/80 bg-surface/95 px-4 py-3.5 lg:px-4 lg:py-5 backdrop-blur-md lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:justify-between">
        <div>
          {/* Brand Header */}
          <div className="mb-3 lg:mb-6 px-1 lg:px-2 flex items-center justify-between lg:block">
            <div className="flex items-center gap-2.5 lg:gap-3">
              <div className="relative flex h-8 w-8 lg:h-10 lg:w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-gradient-to-b from-[#141E30] to-[#0A0F1A] shadow-md shadow-black/30">
                <img src="/logo.svg" alt="AgentRelay" className="h-5 w-5 lg:h-6 lg:w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-display text-base lg:text-lg font-bold tracking-tight text-text-primary">
                    AgentRelay
                  </h1>
                </div>
                <p className="hidden lg:block font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Escrow Protocol
                </p>
              </div>
            </div>

            {/* Network Badge */}
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-surface-subtle/80 px-2 lg:px-2.5 py-1 lg:py-1.5 shadow-inner lg:mt-4 lg:justify-between">
              <div className="flex items-center gap-1.5 lg:gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-arbitrum/60 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-arbitrum"></span>
                </span>
                <span className="font-mono text-xs font-medium text-text-secondary">Arbitrum Sepolia</span>
              </div>
              <span className="hidden lg:inline rounded border border-border/60 bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                421614
              </span>
            </div>
          </div>

          {/* Navigation */}
          <div className="hidden lg:block px-2 mb-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Protocol Modules
            </span>
          </div>
          <nav className="grid grid-cols-2 gap-2 lg:flex lg:flex-col lg:gap-1.5">
            <NavItem
              label="Agent Registry"
              sublabel="Identity & Reputation"
              active={page === 'agents'}
              onClick={() => onNavigate('agents')}
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            />
            <NavItem
              label="Task Escrow"
              sublabel="Work & Settlement"
              active={page === 'tasks'}
              onClick={() => onNavigate('tasks')}
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              }
            />
          </nav>
        </div>

        {/* Sidebar Footer: Protocol Info (Desktop only) */}
        <div className="hidden lg:block rounded-xl border border-border/60 bg-surface-subtle/80 p-3 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
              Arbitrum Stylus
            </span>
            <span className="flex h-1.5 w-1.5 rounded-full bg-verified"></span>
          </div>
          <p className="font-mono text-[10px] leading-relaxed text-text-muted">
            Rust-native verification on EVM+WASM.
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 lg:pl-64">
        {/* Top Bar Header */}
        <header className="sticky top-0 z-20 flex h-14 sm:h-16 items-center justify-between border-b border-border/80 bg-bg/90 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-mono truncate mr-2">
            <span className="hidden sm:inline font-semibold tracking-tight text-text-primary">AgentRelay</span>
            <span className="hidden sm:inline text-text-muted">/</span>
            <span className="font-medium text-primary truncate">
              {page === 'agents' ? 'Agent Registry' : 'Task Escrow Marketplace'}
            </span>
          </div>
          <div className="shrink-0">
            <ConnectButton />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>

        {/* Protocol Footer Anchor */}
        <footer className="mt-auto border-t border-border/70 bg-surface-subtle/60 px-4 sm:px-6 lg:px-8 py-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-[11px] font-mono text-text-muted sm:flex-row">
            <div className="flex items-center gap-2 text-center sm:text-left">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-verified"></span>
              <span className="font-medium text-text-secondary">AgentRelay Protocol</span>
              <span>•</span>
              <span>Arbitrum Sepolia (421614)</span>
            </div>
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-3 gap-y-1 text-text-secondary/70">
              <span title={CONTRACTS.identity}>Identity: {truncateAddress(CONTRACTS.identity)}</span>
              <span>•</span>
              <span title={CONTRACTS.escrow}>Escrow: {truncateAddress(CONTRACTS.escrow)}</span>
              <span>•</span>
              <span title={CONTRACTS.validation}>Stylus: {truncateAddress(CONTRACTS.validation)}</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function NavItem({
  label,
  sublabel,
  active,
  onClick,
  icon,
}: {
  label: string;
  sublabel?: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-2.5 lg:gap-3 rounded-xl px-2.5 py-2 lg:px-3 lg:py-2.5 text-left transition-all duration-150 ${
        active
          ? 'border border-primary/30 bg-primary/10 text-primary shadow-sm shadow-primary/5'
          : 'border border-transparent text-text-secondary hover:border-border/60 hover:bg-surface-hover/70 hover:text-text-primary'
      }`}
    >
      <div
        className={`flex h-7 w-7 lg:h-8 lg:w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
          active
            ? 'border-primary/40 bg-primary/20 text-primary'
            : 'border-border/60 bg-surface-subtle text-text-muted group-hover:border-border group-hover:text-text-primary'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs lg:text-sm font-medium tracking-tight leading-snug truncate">{label}</span>
          {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-sm shadow-primary"></span>}
        </div>
        {sublabel && (
          <span
            className={`hidden sm:block truncate font-mono text-[10px] leading-tight transition-colors ${
              active ? 'text-primary/70' : 'text-text-muted group-hover:text-text-secondary'
            }`}
          >
            {sublabel}
          </span>
        )}
      </div>
    </button>
  );
}
