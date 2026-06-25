import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(public)/{-$locale}/campsites/$country/$state')({
  component: CampsitesPage,
});

/**
 * Example route using multi-segment params with per-URL sitemap metadata.
 */
function CampsitesPage() {
  const { country, state } = Route.useParams();

  return (
    <main>
      <h1>Example campsite page</h1>
      <p>
        Location: {country} / {state}
      </p>
    </main>
  );
}
