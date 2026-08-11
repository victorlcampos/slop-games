// Aerial perspective: replaces three's flat fog with one that changes colour
// with the viewing direction. Looking at the sun the air turns golden; with
// your back to it, blue. It is what ties the far terrain to the sky instead of
// leaving a band
// azulada colada sobre um horizonte dourado.
//
// The patch is applied to the global ShaderChunks, so it MUST run before
// any material is created.

import * as THREE from 'three';

let patched = false;

export function installAerialPerspective({ sunDirection, sunColor, skyColor, strength = 0.9 }) {
  const uniforms = {
    uAerialSunDir: { value: sunDirection.clone() },
    uAerialSunColor: { value: new THREE.Color(sunColor) },
    uAerialSkyColor: { value: new THREE.Color(skyColor) },
    uAerialStrength: { value: strength },
  };

  if (patched) return uniforms;
  patched = true;

  // The uniforms go into the fog library: every material with fog receives
  // them automatically, with no onBeforeCompile needed on each one.
  Object.assign(THREE.UniformsLib.fog, uniforms);

  THREE.ShaderChunk.fog_pars_vertex += `
varying vec3 vAerialDir;
`;

  THREE.ShaderChunk.fog_vertex += `
vAerialDir = (modelMatrix * vec4(transformed, 1.0)).xyz - cameraPosition;
`;

  THREE.ShaderChunk.fog_pars_fragment += `
varying vec3 vAerialDir;
uniform vec3  uAerialSunDir;
uniform vec3  uAerialSunColor;
uniform vec3  uAerialSkyColor;
uniform float uAerialStrength;
`;

  THREE.ShaderChunk.fog_fragment = `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif

  vec3 aerialDir = normalize(vAerialDir);
  float sunAmt = max(dot(aerialDir, normalize(uAerialSunDir)), 0.0);

  // two lobes: a wide one (Rayleigh) and a narrow one around the sun (Mie)
  vec3 aerial = mix(uAerialSkyColor, uAerialSunColor, pow(sunAmt, 2.0) * 0.55);
  aerial += uAerialSunColor * pow(sunAmt, 9.0) * 0.55;

  vec3 fogCol = mix(fogColor, aerial, uAerialStrength);
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol, fogFactor );
#endif
`;

  return uniforms;
}
