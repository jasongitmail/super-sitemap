import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/(public)/{-$locale}/optionals/many/{-$paramA}/{-$paramB}/foo'
)({
  component: OptionalManyFooPage,
});

/**
 * Example route using optional params before a static child path.
 */
function OptionalManyFooPage() {
  const { paramA, paramB } = Route.useParams();

  return (
    <main>
      <h1>Example optional params before a static path</h1>
      <p>
        Optional values: {paramA} / {paramB}
      </p>
    </main>
  );
}
