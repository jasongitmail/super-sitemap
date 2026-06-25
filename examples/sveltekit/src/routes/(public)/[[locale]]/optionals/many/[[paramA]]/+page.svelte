<script lang="ts">
  import { page } from '$app/stores';
  const { params } = $page;
</script>

<h1>Example optional param</h1>

<p>Optional value: {params.paramA}</p>
