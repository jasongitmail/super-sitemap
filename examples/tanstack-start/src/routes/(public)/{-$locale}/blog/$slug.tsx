import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(public)/{-$locale}/blog/$slug')({
  component: BlogPostPage,
});

/**
 * Example route using dynamic blog slugs supplied through sitemap paramValues.
 */
function BlogPostPage() {
  const { slug } = Route.useParams();

  return (
    <main>
      <h1>Example blog post</h1>
      <p>Example blog post for {slug}.</p>
    </main>
  );
}
