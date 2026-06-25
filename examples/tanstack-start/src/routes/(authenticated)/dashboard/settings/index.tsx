import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(authenticated)/dashboard/settings/')({
  component: DashboardSettingsPage,
});

/**
 * Example excluded route matched by the dashboard sitemap pattern.
 */
function DashboardSettingsPage() {
  return (
    <main>
      <h1>Dashboard settings</h1>
    </main>
  );
}
