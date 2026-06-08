"use client";
import { DistortionType } from "@/types/pose";

export const DISTORTIONS: {
  id: DistortionType;
  label: string;
  hint: string;
}[] = [
  { id: "none", label: "없음", hint: "왜곡 미적용" },
  { id: "bulge", label: "볼록", hint: "중심 확대 (어안 약하게)" },
  { id: "pinch", label: "오목", hint: "중심 축소, 가장자리 확대" },
  { id: "swirl", label: "뒤틀림", hint: "중심 회오리 회전" },
  { id: "wave", label: "물결", hint: "사인파 일렁임" },
  { id: "fisheye", label: "어안", hint: "강한 볼록 왜곡" },
];

const MODE: Record<DistortionType, number> = {
  none: 0,
  bulge: 1,
  pinch: 2,
  swirl: 3,
  wave: 4,
  fisheye: 5,
};

const VERT = `
attribute vec2 a;
varying vec2 v;
void main() {
  v = (a + 1.0) * 0.5;
  gl_Position = vec4(a, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 v;
uniform sampler2D t;
uniform int mode;
uniform float k;
const float PI = 3.14159265;
const float CORNER = 0.70710678; // length(0.5,0.5)

void main() {
  vec2 uv = v;
  vec2 c = uv - 0.5;
  float rawLen = length(c);
  float r = rawLen / CORNER;            // 0 center .. 1 corner
  vec2 dir = rawLen > 1e-4 ? c / rawLen : vec2(0.0);
  vec2 suv = uv;

  if (mode == 1) {                      // bulge — magnify center
    float e = 1.0 + k * 2.5;
    float nr = pow(clamp(r, 0.0, 1.0), e);
    suv = 0.5 + dir * nr * CORNER;
  } else if (mode == 2) {               // pinch — shrink center
    float e = 1.0 / (1.0 + k * 2.5);
    float nr = pow(clamp(r, 0.0, 1.0), e);
    suv = 0.5 + dir * nr * CORNER;
  } else if (mode == 3) {               // swirl — rotate by radius
    float ang = k * 3.2 * (1.0 - clamp(r, 0.0, 1.0));
    float s = sin(ang), co = cos(ang);
    suv = 0.5 + vec2(c.x * co - c.y * s, c.x * s + c.y * co);
  } else if (mode == 4) {               // wave — sinusoidal ripple
    suv = uv + k * 0.04 * vec2(sin(uv.y * PI * 6.0), sin(uv.x * PI * 6.0));
  } else if (mode == 5) {               // fisheye — strong bulge
    float e = 1.0 + k * 4.5;
    float nr = pow(clamp(r, 0.0, 1.0), e);
    suv = 0.5 + dir * nr * CORNER;
  }

  suv = clamp(suv, 0.0, 1.0);
  gl_FragColor = texture2D(t, suv);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? "shader compile failed");
  }
  return sh;
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = dataUrl;
  if (img.decode) {
    await img.decode();
  } else {
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });
  }
  return img;
}

// Apply a lens distortion to a captured dataURL and return a new dataURL.
// Returns the source unchanged for `none` / zero strength.
export async function applyDistortion(
  srcDataUrl: string,
  type: DistortionType,
  strength: number,
): Promise<string> {
  if (type === "none" || strength <= 0) return srcDataUrl;

  const img = await loadImage(srcDataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) return srcDataUrl; // graceful fallback

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return srcDataUrl;
  gl.useProgram(prog);

  // Fullscreen quad
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const aLoc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

  // Texture from image (flipY so orientation matches)
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.uniform1i(gl.getUniformLocation(prog, "t"), 0);
  gl.uniform1i(gl.getUniformLocation(prog, "mode"), MODE[type]);
  gl.uniform1f(gl.getUniformLocation(prog, "k"), strength);

  gl.viewport(0, 0, w, h);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  const out = canvas.toDataURL("image/png");

  // cleanup
  gl.deleteTexture(tex);
  gl.deleteBuffer(buf);
  gl.deleteProgram(prog);
  return out;
}
