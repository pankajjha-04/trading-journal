import { AppShell } from '@/components/dashboard/app-shell';

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
