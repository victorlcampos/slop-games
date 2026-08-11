// Perspectiva aérea: substitui o fog chapado do three por um que muda de cor
// conforme a direção do olhar. Olhando para o sol o ar fica dourado; de costas,
// azul. É o que amarra o terreno distante ao céu em vez de deixar uma faixa
// azulada colada sobre um horizonte dourado.
//
// O patch é feito nos ShaderChunk globais, então PRECISA rodar antes de
// qualquer material ser criado.

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

  // Os uniforms entram na biblioteca de fog: todo material com fog passa a
  // recebê-los automaticamente, sem precisar de onBeforeCompile em cada um.
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

  // dois lóbulos: um largo (Rayleigh) e um estreito em volta do sol (Mie)
  vec3 aerial = mix(uAerialSkyColor, uAerialSunColor, pow(sunAmt, 2.0) * 0.55);
  aerial += uAerialSunColor * pow(sunAmt, 9.0) * 0.55;

  vec3 fogCol = mix(fogColor, aerial, uAerialStrength);
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol, fogFactor );
#endif
`;

  return uniforms;
}
