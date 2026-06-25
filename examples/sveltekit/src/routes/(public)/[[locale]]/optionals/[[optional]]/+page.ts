// Example route using a SvelteKit optional param with sitemap paramValues.
export async function load() {
  const meta = {
    description: `Foo meta description...`,
    title: `Foo`,
  };

  return { meta };
}
