import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(public)/{-$locale}/blog/tag/$tag/page/$page')({
  component: BlogTagPageNumberPage,
});

/**
 * Example excluded route for paginated blog tag listings.
 */
function BlogTagPageNumberPage() {
  const { page, tag } = Route.useParams();

  return (
    <main>
      <h1>Example posts tagged {tag}</h1>
      <p>
        Example page {page} for posts tagged {tag}.
      </p>
    </main>
  );
}
