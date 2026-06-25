<script lang="ts">
  import { page } from '$app/stores';
  const { params } = $page;
</script>

<h1>Example dynamic route</h1>

<p>Example page for {params.foo}.</p>
