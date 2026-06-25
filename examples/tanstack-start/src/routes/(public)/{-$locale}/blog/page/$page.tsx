import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(public)/{-$locale}/blog/page/$page')({
  component: BlogPageNumberPage,
});

/**
 * Example excluded route for paginated blog listings.
 */
function BlogPageNumberPage() {
  const { page } = Route.useParams();

  return (
    <main>
      <h1>Blog - Page {page}</h1>
    </main>
  );
}
