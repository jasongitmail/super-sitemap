<script lang="ts">
  import { page } from '$app/stores';
  const { params } = $page;
</script>

<h1>Blog - Page {params.page}</h1>

<p>Example blog listing page {params.page}.</p>
