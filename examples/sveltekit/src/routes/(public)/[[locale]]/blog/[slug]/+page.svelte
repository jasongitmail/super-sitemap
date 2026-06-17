<script lang="ts">
  import { page } from '$app/stores';
  const { params } = $page;
</script>

<h1>A blog post</h1>

<p>Show a blog post for {params.slug} or 404.</p>
