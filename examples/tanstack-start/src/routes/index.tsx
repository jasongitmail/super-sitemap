import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <main>
      <h1>super-sitemap TanStack Start example</h1>
      <p>
        This is the TanStack Start example app for the <code>super-sitemap</code> library. It exists
        as an integration test that exercises the library's TanStack Start adapter against a real
        generated route tree.
      </p>
      <p>
        View the generated sitemap: <a href="/sitemap.xml">/sitemap.xml</a>
      </p>
      <p>
        Library repository:{' '}
        <a href="https://github.com/jasongitmail/super-sitemap">
          github.com/jasongitmail/super-sitemap
        </a>
      </p>
    </main>
  );
}
