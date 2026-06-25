import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(authenticated)/dashboard/')({
  component: DashboardPage,
});

/**
 * Example excluded route matched by the dashboard sitemap pattern.
 */
function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
    </main>
  );
}
