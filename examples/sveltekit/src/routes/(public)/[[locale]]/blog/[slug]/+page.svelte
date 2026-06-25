<script lang="ts">
  import { page } from '$app/stores';
  const { params } = $page;
</script>

<h1>Example blog post</h1>

<p>Example blog post for {params.slug}.</p>
