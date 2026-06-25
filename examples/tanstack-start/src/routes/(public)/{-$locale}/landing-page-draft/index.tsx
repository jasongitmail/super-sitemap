import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(public)/{-$locale}/landing-page-draft/')({
  component: LandingPageDraftPage,
});

/**
 * Example excluded route matched by an exact pattern in route exclusions.
 */
function LandingPageDraftPage() {
  return (
    <main>
      <h1>Landing page draft</h1>
    </main>
  );
}
