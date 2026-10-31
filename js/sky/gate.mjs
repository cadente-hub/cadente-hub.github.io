// Whether the hero sky moves (WebGL2) or is drawn once as an SVG. The site sells an app that leaves the fan alone,
// so the sky never runs where it would cost the visitor: reduced motion, no WebGL2, data saver, or a small device.
export function skyMode({ reducedMotion = false, webgl2 = true, saveData = false, deviceMemory, cores } = {}) {
  if (reducedMotion || !webgl2 || saveData) return 'static';
  if (deviceMemory !== undefined && deviceMemory <= 2) return 'static';
  if (cores !== undefined && cores <= 2) return 'static';
  return 'webgl';
}

export const browserSkyMode = () => skyMode({
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  webgl2: typeof WebGL2RenderingContext !== 'undefined',
  saveData: navigator.connection?.saveData === true,
  deviceMemory: navigator.deviceMemory,
  cores: navigator.hardwareConcurrency,
});
