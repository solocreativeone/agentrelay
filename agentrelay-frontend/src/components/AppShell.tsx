import { type ReactNode } from 'react';
import { ConnectButton } from './ConnectButton';

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
    <div className="flex min-h-screen bg-bg">
      <aside className="flex w-56 flex-col border-r border-border bg-surface px-4 py-6">
        <div className="mb-8 flex items-center gap-2 px-2">
          <img src="/logo.svg" alt="" className="h-7 w-7" />
          <div>
            <h1 className="font-display text-xl font-semibold text-text-primary">AgentRelay</h1>
            <p className="text-xs text-text-secondary">Arbitrum Sepolia</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          <NavItem label="Agents" active={page === 'agents'} onClick={() => onNavigate('agents')} />
          <NavItem label="Tasks" active={page === 'tasks'} onClick={() => onNavigate('tasks')} />
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-border px-8 py-4">
          <ConnectButton />
        </header>
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}

function NavItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
        active ? 'bg-primary/15 text-primary' : 'text-text-secondary hover:bg-border/50 hover:text-text-primary'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-primary' : 'bg-text-secondary/40'}`} />
      {label}
    </button>
  );
}
