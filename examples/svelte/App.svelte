<script lang="ts">
  import { Clef } from '@chord-ts/clef/svelte';

  // reactive: mutate fields or replace the object — the widget updates without a reload
  let options = $state({ url: '/openrpc.json', endpoint: '/rpc' });
</script>

<Clef {options} />
