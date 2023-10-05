<script lang="ts">
  import { match } from '/src/params/integer';

  console.log(match('foo'));
  console.log(match(1));
</script>

<h1>Foo=integer parameterized route</h1>

<p>
  Static paths have highest specificity. `/[foo=integer]` has medium specificity, and `/[foo]` has
  lowest specificity.
</p>

<p>
  Exists to test route specificity handling by `sampled.findFirstMatches()` (an internal function)
</p>
