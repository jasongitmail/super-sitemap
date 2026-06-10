import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/blog/$slug')({
  component: BlogPostPage,
});

function BlogPostPage() {
  const { slug } = Route.useParams();
  return (
    <main>
      <h1>Blog post: {slug}</h1>
      <p>A parameterized route. Its param values are supplied to super-sitemap via paramValues.</p>
    </main>
  );
}
