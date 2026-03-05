// Vertex shader: fullscreen triangle via gl_VertexID (3 verts, no buffers)
export const vertexShaderSource = /* glsl */ `#version 300 es
precision highp float;

out vec2 vUV;

void main() {
  // Generates a triangle that covers the full clip space:
  //   vertex 0: (-1, -1)
  //   vertex 1: ( 3, -1)
  //   vertex 2: (-1,  3)
  float x = -1.0 + float((gl_VertexID & 1) << 2);
  float y = -1.0 + float((gl_VertexID & 2) << 1);
  vUV = vec2(x, y) * 0.5 + 0.5;
  gl_Position = vec4(x, y, 0.0, 1.0);
}
`;

// Fragment shader: 3D simplex noise → dual-palette gradient with blend
export const fragmentShaderSource = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

// ---- Uniforms ----
uniform float u_time;
uniform float u_aspect;
uniform float u_noiseScaleX;
uniform float u_noiseScaleY;
uniform float u_scrollSpeed;
uniform float u_evolveSpeed;

#define MAX_STOPS 8

uniform vec3  u_paletteA[MAX_STOPS];
uniform float u_positionsA[MAX_STOPS];
uniform int   u_stopCountA;

uniform vec3  u_paletteB[MAX_STOPS];
uniform float u_positionsB[MAX_STOPS];
uniform int   u_stopCountB;

uniform float u_blend;

// ---- Cursor distortion uniforms ----
uniform vec2  u_cursor;           // normalized cursor position in UV space
uniform int   u_cursorMode;       // 0 = noise warp, 1 = velocity offset
uniform float u_cursorRadius;     // outer falloff radius in UV space
uniform float u_cursorStrength;   // distortion amount
uniform float u_cursorFalloffWidth; // width of falloff band (inner = radius - falloffWidth)
uniform vec2  u_cursorVelocity;   // smoothed cursor velocity in UV/s
uniform float u_cursorNoiseScale; // frequency of the warp noise
uniform float u_cursorNoiseSpeed; // evolution speed of the warp noise
uniform int   u_cursorOctaves;    // FBM octaves for the warp noise
uniform float u_cursorLacunarity; // frequency multiplier per octave

// ---- Ghost trail uniforms ----
#define MAX_GHOSTS 10
uniform vec2  u_ghostPos[MAX_GHOSTS];
uniform float u_ghostStrength[MAX_GHOSTS];
uniform int   u_ghostCount;

// ---- 3D Simplex Noise (Ashima / webgl-noise, public domain) ----
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  // Permutations
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
  + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  // Gradients: 7x7 points over a square, mapped onto an octahedron.
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  // Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

// ---- Gradient sampling ----
vec3 sampleGradient(vec3 palette[MAX_STOPS], float positions[MAX_STOPS], int stopCount, float t) {
  t = clamp(t, 0.0, 1.0);

  if (stopCount <= 1) return palette[0];

  // Below first stop
  if (t <= positions[0]) return palette[0];

  // Walk stops
  for (int i = 1; i < MAX_STOPS; i++) {
    if (i >= stopCount) break;
    if (t <= positions[i]) {
      float range = positions[i] - positions[i - 1];
      float local = (range > 0.0001) ? (t - positions[i - 1]) / range : 0.0;
      return mix(palette[i - 1], palette[i], local);
    }
  }

  // Above last stop
  return palette[stopCount - 1];
}

// ---- Main ----
void main() {
  // Aspect-corrected UVs
  vec2 uv = vUV;
  uv.x *= u_aspect;

  // ---- Unified cursor + trail distortion ----
  // Build a single smooth falloff field from the cursor AND the ghost trail,
  // then apply distortion once so there's no double-up at the cursor/trail junction.

  float inner = max(u_cursorRadius - u_cursorFalloffWidth, 0.0);

  // Start with the live cursor as a point contributor
  vec2 cursorAspect = vec2(u_cursor.x * u_aspect, u_cursor.y);
  float cursorDist = length(uv - cursorAspect);
  float combinedFalloff = (1.0 - smoothstep(inner, u_cursorRadius, cursorDist)) * u_cursorStrength;

  // Add a segment from cursor → first ghost (bridges the gap)
  if (u_ghostCount >= 1 && u_ghostStrength[0] >= 0.001) {
    vec2 pA = cursorAspect;
    vec2 pB = vec2(u_ghostPos[0].x * u_aspect, u_ghostPos[0].y);
    vec2 seg = pB - pA;
    float segLen = length(seg);
    float t_seg = (segLen > 0.0001) ? clamp(dot(uv - pA, seg) / (segLen * segLen), 0.0, 1.0) : 0.0;
    vec2 closest = pA + seg * t_seg;
    float d = length(uv - closest);
    float interpStrength = mix(u_cursorStrength, u_cursorStrength * u_ghostStrength[0], t_seg);
    float gf = (1.0 - smoothstep(inner, u_cursorRadius, d)) * interpStrength;
    combinedFalloff = max(combinedFalloff, gf);
  }

  // Walk ghost segments
  for (int g = 0; g < MAX_GHOSTS - 1; g++) {
    if (g + 1 >= u_ghostCount) break;
    float sA = u_ghostStrength[g];
    float sB = u_ghostStrength[g + 1];
    if (max(sA, sB) < 0.001) continue;

    vec2 pA = vec2(u_ghostPos[g].x * u_aspect, u_ghostPos[g].y);
    vec2 pB = vec2(u_ghostPos[g + 1].x * u_aspect, u_ghostPos[g + 1].y);

    vec2 seg = pB - pA;
    float segLen = length(seg);
    float t_seg = (segLen > 0.0001) ? clamp(dot(uv - pA, seg) / (segLen * segLen), 0.0, 1.0) : 0.0;
    vec2 closest = pA + seg * t_seg;
    float d = length(uv - closest);

    float interpStrength = mix(sA, sB, t_seg) * u_cursorStrength;
    float gf = (1.0 - smoothstep(inner, u_cursorRadius, d)) * interpStrength;
    combinedFalloff = max(combinedFalloff, gf);
  }

  // Last ghost as a point
  if (u_ghostCount >= 1) {
    int last = u_ghostCount - 1;
    float sL = u_ghostStrength[last];
    if (sL >= 0.001) {
      vec2 pL = vec2(u_ghostPos[last].x * u_aspect, u_ghostPos[last].y);
      float dL = length(uv - pL);
      float gfL = (1.0 - smoothstep(inner, u_cursorRadius, dL)) * sL * u_cursorStrength;
      combinedFalloff = max(combinedFalloff, gfL);
    }
  }

  // Apply distortion once with the unified falloff
  if (combinedFalloff > 0.001) {
    if (u_cursorMode == 0) {
      // FBM noise warp
      float amp = 1.0;
      float freq = u_cursorNoiseScale;
      float nx = 0.0;
      float ny = 0.0;
      float totalAmp = 0.0;
      for (int o = 0; o < 6; o++) {
        if (o >= u_cursorOctaves) break;
        nx += amp * snoise(vec3(uv * freq, u_time * u_cursorNoiseSpeed));
        ny += amp * snoise(vec3(uv * freq + 100.0, u_time * u_cursorNoiseSpeed));
        totalAmp += amp;
        freq *= u_cursorLacunarity;
        amp *= 0.5;
      }
      nx /= totalAmp;
      ny /= totalAmp;
      uv += vec2(nx, ny) * combinedFalloff;
    } else {
      // Velocity offset
      float speed = length(u_cursorVelocity);
      if (speed > 0.001) {
        vec2 dir = u_cursorVelocity / speed;
        dir.x *= u_aspect;
        dir = normalize(dir);
        float speedFactor = clamp(speed * 0.5, 0.0, 1.0);
        uv += dir * combinedFalloff * speedFactor;
      }
    }
  }

  // Scale for noise frequency (per-axis)
  uv.x *= u_noiseScaleX;
  uv.y *= u_noiseScaleY;

  // Scroll upward over time
  uv.y -= u_time * u_scrollSpeed;

  // 3D noise: x, y spatial + z evolves over time
  float n = snoise(vec3(uv, u_time * u_evolveSpeed));

  // Map from [-1, 1] to [0, 1]
  float t = n * 0.5 + 0.5;

  // Sample both palettes
  vec3 colorA = sampleGradient(u_paletteA, u_positionsA, u_stopCountA, t);
  vec3 colorB = sampleGradient(u_paletteB, u_positionsB, u_stopCountB, t);

  // Blend between palettes
  vec3 finalColor = mix(colorA, colorB, u_blend);

  fragColor = vec4(finalColor, 1.0);
}
`;
