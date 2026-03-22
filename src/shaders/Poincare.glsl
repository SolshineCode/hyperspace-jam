/*
 * Poincare Disk Hyperbolic Tessellation Shader
 * {7,3} heptagonal tiling in the Poincare disk model.
 */

precision highp float;

uniform float u_time;
uniform float u_amplitude;
uniform vec2 u_resolution;

// Complex number operations for Mobius transforms
vec2 cmul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 cdiv(vec2 a, vec2 b) {
  float d = dot(b, b);
  return vec2(dot(a, b), a.y * b.x - a.x * b.y) / d;
}

vec2 conj(vec2 z) {
  return vec2(z.x, -z.y);
}

// Mobius transformation: (z - a) / (1 - conj(a)*z)
vec2 mobius(vec2 z, vec2 a) {
  return cdiv(z - a, vec2(1.0, 0.0) - cmul(conj(a), z));
}

// Hyperbolic distance from origin
float hdist(vec2 z) {
  float r = length(z);
  if (r >= 1.0) return 10.0;
  return log((1.0 + r) / (1.0 - r));
}

// Rotate a 2D point
vec2 rot(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);

  // Breathing scale from audio amplitude
  float breathe = 1.0 + 0.15 * u_amplitude;
  uv *= 1.1 * breathe;

  float r = length(uv);

  // Outside disk: black
  if (r >= 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Slow rotation
  float rotSpeed = 0.08 + 0.05 * u_amplitude;
  uv = rot(uv, u_time * rotSpeed);

  // Tessellation parameters for {7,3} tiling
  float n = 7.0; // heptagon
  float angleStep = 6.283185 / n;

  // Hyperbolic translation distance for {7,3}
  float coshR = cos(3.14159265 / 3.0) / sin(3.14159265 / n);
  float sinhR = sqrt(coshR * coshR - 1.0);
  float tr = sinhR / (coshR + 1.0); // tanh(R/2) = translation in disk

  // Iteratively reflect into fundamental domain
  vec2 z = uv;
  float iter = 0.0;

  for (int i = 0; i < 40; i++) {
    // Find nearest sector
    float ang = atan(z.y, z.x);
    float sector = floor(ang / angleStep + 0.5) * angleStep;

    // Rotate to canonical sector
    z = rot(z, -sector);
    iter += abs(sector) > 0.01 ? 1.0 : 0.0;

    // Translate toward center
    vec2 center = vec2(tr, 0.0);
    vec2 w = mobius(z, center);

    if (length(w) >= length(z) - 0.0001) break;
    z = w;
    iter += 1.0;
  }

  // Coloring based on iteration count and position
  float d = hdist(z);
  float edge = smoothstep(0.02, 0.06, abs(sin(d * 3.0)));

  // Color palette: deep blues, teals, purples
  float t = mod(iter * 0.1 + u_time * 0.02, 1.0);
  vec3 col1 = vec3(0.02, 0.05, 0.15); // deep navy
  vec3 col2 = vec3(0.05, 0.15, 0.25); // dark teal
  vec3 col3 = vec3(0.1, 0.05, 0.2);   // purple

  vec3 color = mix(col1, col2, sin(iter * 0.7 + u_time * 0.1) * 0.5 + 0.5);
  color = mix(color, col3, sin(iter * 1.1 - u_time * 0.15) * 0.5 + 0.5);

  // Edge highlights
  float edgeLine = 1.0 - smoothstep(0.0, 0.04, abs(fract(d * 1.5) - 0.5) - 0.45);
  color += vec3(0.05, 0.1, 0.15) * edgeLine;

  // Sector-based pattern
  float ang = atan(z.y, z.x);
  float sectorPattern = smoothstep(0.02, 0.04, abs(sin(ang * n * 0.5)));
  color *= 0.7 + 0.3 * sectorPattern;

  // Audio reactive brightness boost
  color *= 0.8 + 0.2 * u_amplitude;

  // Disk edge fade
  float diskEdge = smoothstep(0.98, 0.92, r);
  color *= diskEdge;

  // Clamp to <= 1.0 so bloom doesn't pick up background
  color = min(color, vec3(1.0));

  gl_FragColor = vec4(color, 1.0);
}
