/**
 * Generates an HTTP response containing an XML sitemap with the provided paths.
 * Default headers set 1h CDN cache & no browser cache.
 *
 * @public
 * @param origin - E.g. `https://example.com`. No trailing slash.
 * @param paths  - Array of string paths to include in the sitemap. Each should
 *                 start with '/'; but if not, it will be added.
 * @param [customHeaders] - An optional object of custom headers to override
 *                          defaults.
 */
export async function response(
	{
		origin,
		excludePatterns,
		paramValues
	}: {
		origin: string;
		excludePatterns?: string[] | [];
		paramValues?: Record<string, string[]> | {};
	},
	customHeaders: Record<string, string> = {}
): Promise<Response> {
	const paths = generatePaths(excludePatterns, paramValues);
	const body = generateBody(origin, new Set(paths));

	// Merge keys case-insensitive
	const headers = {
		'cache-control': 'max-age=0, s-maxage=3600', // 1h CDN cache
		'content-type': 'application/xml',
		...Object.fromEntries(
			Object.entries(customHeaders).map(([key, value]) => [key.toLowerCase(), value])
		)
	};

	return new Response(body, { headers });
}

/**
 * Generates an XML response body based on the provided paths, using sitemap
 * structure from https://kit.svelte.dev/docs/seo#manual-setup-sitemaps.
 *
 * @public
 * @param origin - E.g. `https://mydomain.com`. No trailing slash b/c we want
 *                  `/` to represent the index page entry to be added to the
 *                  sitemap.
 * @param paths - Array of string paths to include in the sitemap. Each should
 *                start with '/'; but if not, it will be added.
 * @returns The generated XML sitemap as a string.
 *
 * @notes
 * - Google ignores changefreq and priority.
 * - We could consider adding `<lastmod>`, but not worrying about this. Specify
 *   the time in the correct format: W3C Datetime for XML sitemaps
 *   https://developers.google.com/search/blog/2014/10/best-practices-for-xml-sitemaps-rssatom
 */
export function generateBody(origin: string, paths: Set<string>): string {
	const normalizedPaths = Array.from(paths).map((path) => (path[0] !== '/' ? `/${path}` : path));

	return `<?xml version="1.0" encoding="UTF-8" ?>
<urlset
  xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="https://www.google.com/schemas/sitemap-news/0.9"
  xmlns:xhtml="https://www.w3.org/1999/xhtml"
  xmlns:mobile="https://www.google.com/schemas/sitemap-mobile/1.0"
  xmlns:image="https://www.google.com/schemas/sitemap-image/1.1"
  xmlns:video="https://www.google.com/schemas/sitemap-video/1.1"
>${normalizedPaths
		.map(
			(path: string) => `
  <url>
    <loc>${origin}${path}</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`
		)
		.join('')}
</urlset>`;
}

/**
 * @public
 */
export function generatePaths(
	excludePatterns: string[] = [],
	paramValues: Record<string, string[]> = {}
): string[] {
	let routes = Object.keys(import.meta.glob('/src/routes/**/+page.svelte'));
	routes = filterRoutes(routes, excludePatterns);

	let parameterizedPaths;
	[routes, parameterizedPaths] = buildParameterizedPaths(routes, paramValues);

	return [...routes, ...parameterizedPaths];
}

/**
 * @private
 */
export function filterRoutes(routes: string[], excludePatterns: string[]): string[] {
	return (
		routes
			// remove `/src/routes` prefix and `+page.svelte suffix`
			.map((x) => x.substring(11, x.length - 12))

			// remove any routes that match an exclude pattern--e.g. `(dashboard)`
			.filter((x) => !excludePatterns.some((pattern) => new RegExp(pattern).test(x)))

			// remove `/(groups)` because decorative only
			.map((x) => x.replaceAll(/\/\(\w+\)/g, ''))

			// remove trailing "/" except from the homepage
			.map((x) => (x !== '/' && x.endsWith('/') ? x.slice(0, -1) : x))

			.sort()
	);
}

/**
 * @private
 * Generate an array of string paths containing param values instead of the
 * `[param]` placeholder using data from param values. E.g. `/blog/hello-world` &
 * `/blog/another-post`, instead of `/blog/[slug]`.
 */
export function buildParameterizedPaths(
	routes: string[],
	paramValues: Record<string, string[]>
): [string[], string[]] {
	const parameterizedPaths = [];

	for (const route in paramValues) {
		if (!routes.includes(route)) {
			throw new Error(
				`Sitemap: '${route}' was provided as a property in your sitemap's paramValues, but does not exist as a route within your project's 'src/routes/'. Remove this property from paramValues.`
			);
		}

		// Generate paths containing data for param values–e.g. `/blog/hello-world`
		parameterizedPaths.push(...paramValues[route].map((value) => route.replace(/\[.*\]/, value)));

		// Remove route containing param placeholder–e.g. `/blog/[slug]`
		routes.splice(routes.indexOf(route), 1);
	}

	// Throw error if app contains any parameterized routes NOT handled in the
	// sitemap, to alert the developer. Prevents accidental omission of any paths.
	for (const route of routes) {
		const regex = /.*\[[^\]]+\].*/;
		if (regex.test(route)) {
			throw new Error(
				`Sitemap: Parameterized route was not handled: '${route}'\nUpdate your sitemap's excludedPatterns to exclude this route OR add data for this route's param to the paramValues object within your sitemap.`
			);
		}
	}

	return [routes, parameterizedPaths];
}
