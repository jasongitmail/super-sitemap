<script lang="ts">
  import { page } from '$app/stores';
  const { params } = $page;
</script>

<h1>Example posts tagged {params.tag}</h1>

<p>Example page {params.page} for posts tagged {params.tag}.</p>
