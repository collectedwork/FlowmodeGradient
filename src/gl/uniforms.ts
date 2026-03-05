/**
 * Uniform helper: caches uniform locations and provides typed setters.
 */

export interface UniformLocations {
  u_time: WebGLUniformLocation | null;
  u_aspect: WebGLUniformLocation | null;
  u_noiseScaleX: WebGLUniformLocation | null;
  u_noiseScaleY: WebGLUniformLocation | null;
  u_scrollSpeed: WebGLUniformLocation | null;
  u_evolveSpeed: WebGLUniformLocation | null;
  u_paletteA: WebGLUniformLocation | null;
  u_positionsA: WebGLUniformLocation | null;
  u_stopCountA: WebGLUniformLocation | null;
  u_paletteB: WebGLUniformLocation | null;
  u_positionsB: WebGLUniformLocation | null;
  u_stopCountB: WebGLUniformLocation | null;
  u_blend: WebGLUniformLocation | null;
  u_cursor: WebGLUniformLocation | null;
  u_cursorRadius: WebGLUniformLocation | null;
  u_cursorStrength: WebGLUniformLocation | null;
  u_cursorNoiseScale: WebGLUniformLocation | null;
  u_cursorNoiseSpeed: WebGLUniformLocation | null;
  u_cursorOctaves: WebGLUniformLocation | null;
  u_cursorLacunarity: WebGLUniformLocation | null;
}

const UNIFORM_NAMES: (keyof UniformLocations)[] = [
  'u_time',
  'u_aspect',
  'u_noiseScaleX',
  'u_noiseScaleY',
  'u_scrollSpeed',
  'u_evolveSpeed',
  'u_paletteA',
  'u_positionsA',
  'u_stopCountA',
  'u_paletteB',
  'u_positionsB',
  'u_stopCountB',
  'u_blend',
  'u_cursor',
  'u_cursorRadius',
  'u_cursorStrength',
  'u_cursorNoiseScale',
  'u_cursorNoiseSpeed',
  'u_cursorOctaves',
  'u_cursorLacunarity',
];

export function getUniformLocations(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): UniformLocations {
  const locs = {} as UniformLocations;
  for (const name of UNIFORM_NAMES) {
    locs[name] = gl.getUniformLocation(program, name);
  }
  return locs;
}

/**
 * Set all uniforms for a single frame.
 *
 * `paletteA` / `paletteB` are flat Float32Arrays of length MAX_STOPS * 3
 * (RGB triples).
 * `positionsA` / `positionsB` are Float32Arrays of length MAX_STOPS.
 */
export function setUniforms(
  gl: WebGL2RenderingContext,
  locs: UniformLocations,
  params: {
    time: number;
    aspect: number;
    noiseScaleX: number;
    noiseScaleY: number;
    scrollSpeed: number;
    evolveSpeed: number;
    paletteA: Float32Array;
    positionsA: Float32Array;
    stopCountA: number;
    paletteB: Float32Array;
    positionsB: Float32Array;
    stopCountB: number;
    blend: number;
    cursor: [number, number];
    cursorRadius: number;
    cursorStrength: number;
    cursorNoiseScale: number;
    cursorNoiseSpeed: number;
    cursorOctaves: number;
    cursorLacunarity: number;
  },
) {
  gl.uniform1f(locs.u_time, params.time);
  gl.uniform1f(locs.u_aspect, params.aspect);
  gl.uniform1f(locs.u_noiseScaleX, params.noiseScaleX);
  gl.uniform1f(locs.u_noiseScaleY, params.noiseScaleY);
  gl.uniform1f(locs.u_scrollSpeed, params.scrollSpeed);
  gl.uniform1f(locs.u_evolveSpeed, params.evolveSpeed);
  gl.uniform3fv(locs.u_paletteA, params.paletteA);
  gl.uniform1fv(locs.u_positionsA, params.positionsA);
  gl.uniform1i(locs.u_stopCountA, params.stopCountA);
  gl.uniform3fv(locs.u_paletteB, params.paletteB);
  gl.uniform1fv(locs.u_positionsB, params.positionsB);
  gl.uniform1i(locs.u_stopCountB, params.stopCountB);
  gl.uniform1f(locs.u_blend, params.blend);
  gl.uniform2f(locs.u_cursor, params.cursor[0], params.cursor[1]);
  gl.uniform1f(locs.u_cursorRadius, params.cursorRadius);
  gl.uniform1f(locs.u_cursorStrength, params.cursorStrength);
  gl.uniform1f(locs.u_cursorNoiseScale, params.cursorNoiseScale);
  gl.uniform1f(locs.u_cursorNoiseSpeed, params.cursorNoiseSpeed);
  gl.uniform1i(locs.u_cursorOctaves, params.cursorOctaves);
  gl.uniform1f(locs.u_cursorLacunarity, params.cursorLacunarity);
}
