import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(public)/{-$locale}/')({
  component: HomePage,
});

function HomePage() {
  return (
    <main>
      <h1>TanStack Start + Super Sitemap example</h1>
      <p>
        This example app shows how{' '}
        <a href="https://github.com/jasongitmail/super-sitemap">Super Sitemap</a> discovers TanStack
        Start routes, including dynamic params, optional params, localized routes, and route
        exclusions.
      </p>
      <p>
        View the config: <code>examples/tanstack-start/src/routes/sitemap{-$page}[.]xml.ts</code>
      </p>
      <p>
        View the generated sitemap: <a href="/sitemap.xml">/sitemap.xml</a>
      </p>
      <p>
        Open your browser&apos;s dev inspector to view the XML structure. This example will not be
        styled as you expect in the browser, but it is valid XML. This is because browsers do not
        apply their XML stylesheet when the XML contains <code>xhtml:link</code> elements, like
        those used in this example for hreflang alternate links.
      </p>
      <p>
        Star on GitHub at{' '}
        <a href="https://github.com/jasongitmail/super-sitemap">
          github.com/jasongitmail/super-sitemap
        </a>
        .
      </p>
      <iframe
        src="https://ghbtns.com/github-btn.html?user=jasongitmail&repo=super-sitemap&type=star&count=true&size=large"
        frameBorder="0"
        scrolling="0"
        width="170"
        height="30"
        title="GitHub"
      />
    </main>
  );
}
