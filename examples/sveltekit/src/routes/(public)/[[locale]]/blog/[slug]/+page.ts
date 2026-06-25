// Example route using dynamic blog slugs supplied through sitemap paramValues.
export async function load() {
  const meta = {
    description: `Login meta description...`,
    title: `Login`,
  };

  return { meta };
}
