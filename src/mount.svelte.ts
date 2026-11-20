import { mount as svelteMount, unmount } from 'svelte';
import Clef from './components/Clef.svelte';
import type { ClefHandle, MountOptions } from './public';

export function mount(target: string | Element, options: MountOptions = {}): ClefHandle {
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!element) throw new Error(`clef: mount target "${String(target)}" not found`);
  const props = $state({ options });
  const component = svelteMount(Clef, { target: element, props });
  return {
    update(next: MountOptions) {
      // merge, not replace: swapping the options object would retrigger the
      // document-load effect even for theme-only updates
      Object.assign(props.options, next);
    },
    destroy() {
      unmount(component);
    }
  };
}