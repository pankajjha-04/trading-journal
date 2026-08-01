import { AppShell } from '@/components/dashboard/app-shell';

export default function JournalLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
