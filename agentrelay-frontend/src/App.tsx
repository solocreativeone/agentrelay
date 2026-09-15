import { useState } from 'react';
import { AppShell } from './components/AppShell';
import { NetworkGuard } from './components/NetworkGuard';
import { AgentsPage } from './pages/AgentsPage';
import { TasksPage } from './pages/TasksPage';
import { TaskDetailPage } from './pages/TaskDetailPage';

type View = { page: 'agents' } | { page: 'tasks' } | { page: 'task-detail'; taskId: bigint };

export function App() {
  const [view, setView] = useState<View>({ page: 'agents' });

  const activeNav = view.page === 'task-detail' ? 'tasks' : view.page;

  return (
    <AppShell page={activeNav} onNavigate={(page) => setView({ page })}>
      <NetworkGuard>
        {view.page === 'agents' && <AgentsPage />}
        {view.page === 'tasks' && <TasksPage onSelectTask={(taskId) => setView({ page: 'task-detail', taskId })} />}
        {view.page === 'task-detail' && (
          <TaskDetailPage taskId={view.taskId} onBack={() => setView({ page: 'tasks' })} />
        )}
      </NetworkGuard>
    </AppShell>
  );
}
