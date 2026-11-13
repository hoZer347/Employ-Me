// GLSL coloured as Loom's shader editor colours it, for the code boxes beside
// the Engine tab's shader demos.
//
// The words and colours mirror Loom's own: KEYWORDS is TextEditor's GLSL
// keyword list, ENGINE_NAMES the names in ENGINE_SHADER_SYMBOLS, which the
// editor colours as known identifiers, and COLORS its dark palette.
// glsl.test.mjs checks all three against the engine's sources.

export const KEYWORDS = new Set([
  "atomic_uint", "attribute", "bool", "break", "buffer", "bvec2", "bvec3", "bvec4", "case", "centroid",
  "coherent", "const", "continue", "default", "discard", "dmat2", "dmat2x2", "dmat2x3", "dmat2x4", "dmat3",
  "dmat3x2", "dmat3x3", "dmat3x4", "dmat4", "dmat4x2", "dmat4x3", "dmat4x4", "do", "double", "dvec2", "dvec3",
  "dvec4", "else", "false", "flat", "float", "for", "highp", "if", "iimage1D", "iimage1DArray", "iimage2D",
  "iimage2DArray", "iimage2DMS", "iimage2DMSArray", "iimage2DRect", "iimage3D", "iimageBuffer", "iimageCube",
  "iimageCubeArray", "image1D", "image1DArray", "image2D", "image2DArray", "image2DMS", "image2DMSArray",
  "image2DRect", "image3D", "imageBuffer", "imageCube", "imageCubeArray", "in", "inout", "int", "invariant",
  "isampler1D", "isampler1DArray", "isampler2D", "isampler2DArray", "isampler2DMS", "isampler2DMSArray",
  "isampler2DRect", "isampler3D", "isamplerBuffer", "isamplerCube", "isamplerCubeArray", "ivec2", "ivec3",
  "ivec4", "layout", "lowp", "mat2", "mat2x2", "mat2x3", "mat2x4", "mat3", "mat3x2", "mat3x3", "mat3x4",
  "mat4", "mat4x2", "mat4x3", "mat4x4", "mediump", "noperspective", "out", "patch", "precise", "precision",
  "readonly", "restrict", "return", "sample", "sampler1D", "sampler1DArray", "sampler1DArrayShadow",
  "sampler1DShadow", "sampler2D", "sampler2DArray", "sampler2DArrayShadow", "sampler2DMS", "sampler2DMSArray",
  "sampler2DRect", "sampler2DRectShadow", "sampler2DShadow", "sampler3D", "samplerBuffer", "samplerCube",
  "samplerCubeArray", "samplerCubeArrayShadow", "samplerCubeShadow", "shared", "smooth", "struct", "subroutine",
  "switch", "true", "uimage1D", "uimage1DArray", "uimage2D", "uimage2DArray", "uimage2DMS", "uimage2DMSArray",
  "uimage2DRect", "uimage3D", "uimageBuffer", "uimageCube", "uimageCubeArray", "uint", "uniform", "usampler1D",
  "usampler1DArray", "usampler2D", "usampler2DArray", "usampler2DMS", "usampler2DMSArray", "usampler2DRect",
  "usampler3D", "usamplerBuffer", "usamplerCube", "usamplerCubeArray", "uvec2", "uvec3", "uvec4", "varying",
  "vec2", "vec3", "vec4", "void", "volatile", "while", "writeonly",
]);

export const ENGINE_NAMES = new Set([
  "u_model", "u_color", "u_shadowsOff", "u_time", "u_seed", "u_viewProjection", "u_cameraPosition",
  "u_lightViewProjection", "u_shadowTexel", "u_lightDirection", "u_lightColor", "u_ambient", "u_shadowMap",
  "LoomLightSpace", "LoomShadow", "LoomDiffuse", "LoomLight", "u_scene", "u_sceneDepth", "u_frame", "u_deltaTime",
  "u_writing", "u_layer0", "u_layer1", "u_layer2", "u_layer3", "Compute", "LoomRead", "LoomSize", "LoomCount",
  "LoomIndex", "LoomCell", "LoomScreenPixel",
  "LoomScenePixel", "LoomSceneDepth", "LoomScenePosition", "LoomSceneNormal", "PixelKernel", "PositionKernel",
  "NormalKernel",
]);

export const COLORS = {
  text: "rgb(224 224 224)",
  keyword: "rgb(197 134 192)",
  number: "rgb(181 206 168)",
  string: "rgb(206 145 120)",
  punctuation: "rgb(255 255 153)",
  preprocessor: "rgb(64 192 128)",
  identifier: "rgb(156 220 254)",
  knownIdentifier: "rgb(79 193 255)",
  comment: "rgb(106 153 85)",
  background: "rgb(30 30 30)",
} as const;

type Kind = Exclude<keyof typeof COLORS, "text" | "background">;

const TOKENS: [Kind, RegExp][] = [
  ["preprocessor", /[ \t]*#.*/y],
  ["comment", /\/\/.*|\/\*[\s\S]*?(\*\/|$)/y],
  ["string", /"(\\.|[^"\\\n])*"?|'(\\.|[^'\\\n])*'?/y],
  ["identifier", /[A-Za-z_]\w*/y],
  ["number", /(0[xX][0-9a-fA-F]+|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)[fFuUlL]*/y],
  ["punctuation", /[!%&()*+,\-./:;<=>?[\]^{|}~]/y],
];

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const span = (kind: Kind, text: string) => `<span style="color:${COLORS[kind]}">${escape(text)}</span>`;

function identifierKind(word: string): Kind {
  if (KEYWORDS.has(word)) return "keyword";
  return ENGINE_NAMES.has(word) ? "knownIdentifier" : "identifier";
}

/** `source` as HTML, each token in a span of its colour. */
export function highlight(source: string): string {
  let html = "";
  let plain = "";
  let at = 0;

  while (at < source.length) {
    const lineStart = at === 0 || source[at - 1] === "\n";
    let matched = false;

    for (const [kind, pattern] of TOKENS) {
      if (kind === "preprocessor" && !lineStart) continue;
      pattern.lastIndex = at;
      const found = pattern.exec(source);
      if (!found || found[0] === "") continue;
      html += escape(plain) + span(kind === "identifier" ? identifierKind(found[0]) : kind, found[0]);
      plain = "";
      at += found[0].length;
      matched = true;
      break;
    }

    if (!matched) plain += source[at++];
  }

  return html + escape(plain);
}
