/*
 * Poincaré Disk Hyperbolic Tessellation — {7,3} Heptagonal Tiling
 *
 * Algorithm: "Fold/Reflect" — for each pixel, iteratively reflect back to
 * the fundamental domain using Möbius translations. GPU-friendly pure ALU math.
 *
 * Uniforms:
 *   u_time: float       — elapsed time for animation
 *   u_amplitude: float   — master audio level from Tone.Meter (0.0-1.0)
 *   u_resolution: vec2   — viewport dimensions
 *
 * Audio reactivity:
 *   - Rotation speed increases with amplitude
 *   - Tessellation "breathes" (scales) with amplitude
 *   - Color saturation and edge glow respond to amplitude
 *
 * Performance: ~20 iterations per pixel, pure ALU, no texture fetches.
 * Easily 60fps at 1080p on any GPU from the last 5+ years.
 *
 * Reference implementations:
 *   - https://www.shadertoy.com/view/3llXR4 (Hyperbolic Truchet tiles)
 *   - https://www.shadertoy.com/view/ssd3zX (Movable Hyperbolic Tessellation)
 *   - https://github.com/felixbauckholt/hyperbolic_canvas
 */

precision highp float;

uniform float u_time;
uniform float u_amplitude;
uniform vec2 u_resolution;

#define PI 3.14159265359
#define ITER 20

// ──── Complex number arithmetic (vec2 = x + iy) ────

vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
}

vec2 cconj(vec2 a) {
    return vec2(a.x, -a.y);
}

vec2 cdiv(vec2 a, vec2 b) {
    return cmul(a, cconj(b)) / dot(b, b);
}

vec2 cexp(vec2 a) {
    return exp(a.x) * vec2(cos(a.y), sin(a.y));
}

// ──── Hyperbolic geometry ────

// Möbius translation: shifts point 'a' to origin within the Poincaré disk
vec2 hypShift(vec2 z, vec2 a) {
    return cdiv(z - a, vec2(1.0, 0.0) - cmul(cconj(a), z));
}

// ──── Tessellation: {P, Q} tiling ────
// P = polygon sides, Q = polygons per vertex
// Hyperbolic condition: (P-2)(Q-2) > 4

const int P = 7;   // heptagons
const int Q = 3;   // 3 per vertex

// Fold into fundamental domain.
// Returns: x = fold count (for coloring), y = distance from center (for edges)
vec2 fold(vec2 z, float rotAngle) {
    // Compute shift distance for {P, Q} tiling
    float tanP = tan(PI / float(P));
    float tanQ = tan(PI / 2.0 - PI / float(Q));
    float d = sqrt((tanQ - tanP) / (tanQ + tanP));

    // Rotation per polygon edge
    vec2 rv = cexp(vec2(0.0, 2.0 * PI / float(P)));
    // Shift vector (direction to adjacent tile center)
    vec2 dv = vec2(d, 0.0);

    // Apply global rotation (animated + audio-reactive)
    z = cmul(z, cexp(vec2(0.0, rotAngle)));

    float foldCount = 0.0;
    int streak = 0;

    for (int i = 0; i < ITER; i++) {
        // Rotate shift direction to next edge
        dv = cmul(dv, rv);
        // Try shifting toward this neighbor
        vec2 shifted = hypShift(z, dv);
        if (dot(shifted, shifted) < dot(z, z)) {
            // Closer to center — accept and negate (reflection)
            z = -shifted;
            foldCount += 1.0;
            streak = 0;
        } else {
            streak++;
            if (streak >= P) break; // converged to fundamental domain
        }
    }

    return vec2(foldCount, length(z));
}

// ──── Color utilities ────

vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

// ──── Main ────

void main() {
    // Map pixel to [-1, 1] with aspect correction
    vec2 uv = (2.0 * gl_FragCoord.xy - u_resolution) / min(u_resolution.x, u_resolution.y);

    // Audio-reactive breathing scale
    float breathe = 1.0 + 0.12 * u_amplitude;
    uv *= breathe;

    float r = length(uv);

    // Outside disk — black
    if (r >= 1.0) {
        gl_FragColor = vec4(vec3(0.0), 1.0);
        return;
    }

    // Disk edge fade (avoids hard boundary)
    float edgeFade = smoothstep(1.0, 0.95, r);

    // Animated rotation (slow base + audio boost)
    float rotSpeed = 0.08 + 0.3 * u_amplitude;
    float rotAngle = u_time * rotSpeed;

    // Fold into fundamental domain
    vec2 result = fold(uv, rotAngle);
    float foldCount = result.x;
    float dist = result.y;

    // ──── Coloring ────

    // Hue: slow drift + fold-based variation + audio hue shift
    float hue = fract(foldCount * 0.14 + u_time * 0.02 + u_amplitude * 0.08);

    // Saturation: high for festival projection, boosted by audio
    float sat = 0.8 + 0.15 * u_amplitude;

    // Value: parity-based contrast (alternating light/dark tiles)
    float val = mod(foldCount, 2.0) < 1.0 ? 0.85 : 0.15;

    // Edge detection: bright lines at tile boundaries
    float tanP = tan(PI / float(P));
    float tanQ = tan(PI / 2.0 - PI / float(Q));
    float dCenter = sqrt((tanQ - tanP) / (tanQ + tanP));
    float halfD = dCenter * 0.5;

    float edgeDist = abs(dist - halfD);
    float edgeLine = 1.0 - smoothstep(0.0, 0.04 + 0.02 * u_amplitude, edgeDist);

    // Mix tile color with complementary edge glow
    vec3 tileColor = hsv2rgb(vec3(hue, sat, val));
    vec3 edgeColor = hsv2rgb(vec3(fract(hue + 0.5), 0.6, 1.0));

    vec3 color = mix(tileColor, edgeColor, edgeLine * 0.7);

    // Apply disk edge fade
    color *= edgeFade;

    // Vignette darkening toward boundary
    color *= mix(1.0, 0.3, pow(r, 4.0));

    gl_FragColor = vec4(color, 1.0);
}
