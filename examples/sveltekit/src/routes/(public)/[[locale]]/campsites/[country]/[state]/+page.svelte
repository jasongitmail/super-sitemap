<script lang="ts">
  import { page } from '$app/stores';
  const { params } = $page;
</script>

<h1>Example campsite page</h1>

<p>Location: {params.country} / {params.state}</p>
