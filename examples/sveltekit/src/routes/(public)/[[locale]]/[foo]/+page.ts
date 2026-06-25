// Example route using a dynamic param supplied through sitemap paramValues.
export async function load() {
  const meta = {
    description: `Foo meta description...`,
    title: `Foo`,
  };

  return { meta };
}
