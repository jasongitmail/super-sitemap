import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(public)/{-$locale}/pricing')({
  component: PricingPage,
});

function PricingPage() {
  return (
    <main>
      <h1>Pricing</h1>
    </main>
  );
}
