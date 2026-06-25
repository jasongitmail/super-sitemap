import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(public)/{-$locale}/optionals/many/{-$paramA}')({
  component: OptionalManyPage,
});

/**
 * Example route using one optional param.
 */
function OptionalManyPage() {
  const { paramA } = Route.useParams();

  return (
    <main>
      <h1>Example optional param</h1>
      <p>Optional value: {paramA}</p>
    </main>
  );
}
