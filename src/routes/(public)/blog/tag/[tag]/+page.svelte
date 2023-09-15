<script lang="ts">
  import { page } from '$app/stores';
  const { params } = $page;
</script>

<h1>Posts tagged {params.tag}</h1>

<p>Show posts tagged {params.tag} or 404.</p>
