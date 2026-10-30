// Cadu in the site's palette: the sprite sheet keeps its roles (ADR 0065 of the app), and the site paints them
// with a purple ramp instead of the app's gold, lit from the top left. Used by the page, the tamagotchi and
// scripts/brand-assets.mjs (logo, favicons and share card).
export const COLORS = {
  light: '#e9d5ff',
  body: '#b46bff',
  shade: '#7e3bd6',
  deep: '#4c1d95',
  glow: '#ffffff',
  ink: '#12051f',
  blush: '#f0abfc',
  spark: '#f3e8ff',
  dust: '#d8b4fe',
  alert: '#ff8272',
};
// Grime for the tamagotchi when he is dirty: dark, muted and still purple-leaning, so it reads as dirt.
export const MUD = { M: '#3d3044', N: '#271c2e' };
