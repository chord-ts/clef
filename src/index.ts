import './styles.css';
import { registerElement } from './element';

export { mount } from './mount.svelte';
export { version } from './version';
export type * from './public';

registerElement();