import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(public)/{-$locale}/optionals/{-$optional}')({
  component: OptionalPage,
});

/**
 * Example route using a TanStack optional param with sitemap paramValues.
 */
function OptionalPage() {
  const { optional } = Route.useParams();

  return (
    <main>
      <h1>Example optional param</h1>
      <p>Optional value: {optional}</p>
    </main>
  );
}
