import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(public)/{-$locale}/optionals/many/{-$paramA}/{-$paramB}/')({
  component: OptionalManyTwoParamsPage,
});

/**
 * Example route using two optional params.
 */
function OptionalManyTwoParamsPage() {
  const { paramA, paramB } = Route.useParams();

  return (
    <main>
      <h1>Example optional params</h1>
      <p>
        Optional values: {paramA} / {paramB}
      </p>
    </main>
  );
}
