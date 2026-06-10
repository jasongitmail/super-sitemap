import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/about')({
  component: AboutPage,
});

function AboutPage() {
  return (
    <main>
      <h1>About</h1>
      <p>A static route included in the generated sitemap.</p>
    </main>
  );
}
