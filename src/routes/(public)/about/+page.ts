import * as env from '$env/static/public';

export async function load() {
  const meta = {
    title: `About`,
    description: `About this site`
  };

  return { meta };
}
