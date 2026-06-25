import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(public)/{-$locale}/$foo')({
  component: FooPage,
});

/**
 * Example route using a dynamic param supplied through sitemap paramValues.
 */
function FooPage() {
  const { foo } = Route.useParams();

  return (
    <main>
      <h1>Example dynamic route</h1>
      <p>Example page for {foo}.</p>
    </main>
  );
}
