import { createRootRoute, Outlet } from '@tanstack/react-router';

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
        <Outlet />
      </body>
    </html>
  );
}
