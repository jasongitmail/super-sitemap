import { createRootRoute, Link, Outlet } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>super-sitemap TanStack Start example</title>
      </head>
      <body>
        <nav>
          <Link to="/">Home</Link> <Link to="/about">About</Link>{' '}
          <Link to="/blog/$slug" params={{ slug: 'hello-world' }}>
            Blog
          </Link>
        </nav>
        <hr />
        <Outlet />
      </body>
    </html>
  );
}
