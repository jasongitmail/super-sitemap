import { sampledPaths, sampledUrls } from '$lib/sampled'; // Import from 'super-sitemap' in your app

export async function load() {
  const meta = {
    description: `About this site`,
    title: `About`,
  };

  console.log('sampledUrls', await sampledUrls('http://localhost:5173/sitemap.xml'));
  console.log('sampledPaths', await sampledPaths('http://localhost:5173/sitemap.xml'));

  return { meta };
}
