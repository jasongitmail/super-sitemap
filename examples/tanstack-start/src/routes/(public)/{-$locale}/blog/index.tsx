import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(public)/{-$locale}/blog/')({
  component: BlogPage,
});

function BlogPage() {
  return (
    <main>
      <h1>Blog</h1>
      <p>Example blog index.</p>
    </main>
  );
}
