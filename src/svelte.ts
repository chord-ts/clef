import ClefComponent from './components/Clef.svelte';
import type { Component } from 'svelte';
import type { MountOptions } from './public';

export const Clef: Component<{ options: MountOptions }> = ClefComponent;
export type * from './public';
