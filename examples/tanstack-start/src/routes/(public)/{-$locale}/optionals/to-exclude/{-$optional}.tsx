import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(public)/{-$locale}/optionals/to-exclude/{-$optional}')({
  component: ExcludedOptionalPage,
});

/**
 * Example excluded route using an optional param.
 */
function ExcludedOptionalPage() {
  return (
    <main>
      <h1>Example excluded optional route</h1>
    </main>
  );
}
