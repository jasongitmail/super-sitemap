import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(public)/{-$locale}/blog/tag/$tag')({
  component: BlogTagPage,
});

/**
 * Example route using dynamic blog tags supplied through sitemap paramValues.
 */
function BlogTagPage() {
  const { tag } = Route.useParams();

  return (
    <main>
      <h1>Example posts tagged {tag}</h1>
    </main>
  );
}
