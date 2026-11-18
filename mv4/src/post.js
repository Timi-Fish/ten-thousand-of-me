// 景深：离对焦面越远越虚，做出贴着案面拍的微距感。接在主画面之后、泛光之前。
// 每个像素按自己的深度算出该虚多少，再在一个圆盘范围里取样平均；亮点会被虚成圆斑。
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const TAPS = 64;
export class DepthOfFieldPass extends Pass {
  // focus：对焦距离（离镜头多远的东西最清楚），每帧由表演设置；strength：虚化强度；maxBlur：最多虚到几个像素
  constructor(camera, width, height, strength = 80, maxBlur = 14) {
    super();
    this.camera = camera;
    this.focus = 10;
    this.gain = 1;                                                     // 这一帧虚化加重几倍（1 是平常；大于 1 时前景虚成一团团色斑，不挡后面的戏）。最多虚到的像素数也跟着放宽，到 2 倍为止
    this.strength = strength; this.maxBlur = maxBlur;
    this.material = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uNear: { value: camera.near }, uFar: { value: camera.far }, uFocus: { value: 10 }, uStrength: { value: strength }, uMax: { value: maxBlur }, uPixel: { value: new THREE.Vector2(1 / width, 1 / height) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse, tDepth; uniform float uNear, uFar, uFocus, uStrength, uMax; uniform vec2 uPixel; varying vec2 vUv;
        float distanceAt(vec2 uv) { float d = texture2D(tDepth, uv).x; return uNear * uFar / (uFar - d * (uFar - uNear)); }   // 这个像素离镜头多远
        float blurOf(float dist) { return min(abs(1.0 / uFocus - 1.0 / dist) * uStrength, uMax); }                          // 该虚多少个像素
        vec3 colorAt(vec2 uv) { vec3 c = texture2D(tDiffuse, uv).rgb; return any(isnan(c)) || any(isinf(c)) ? vec3(0.0) : c; }   // 哪个着色器万一算出一个无效的像素，在这里拦下，不让后面的模糊把它扩散到整帧
        void main() {
          float here = distanceAt(vUv), mine = blurOf(here);
          vec3 sum = colorAt(vUv); float weight = 1.0;
          for (int i = 1; i < ${TAPS}; i++) {
            float r = sqrt(float(i) / ${TAPS}.0) * uMax, a = float(i) * 2.39996;
            vec2 uv = vUv + vec2(cos(a), sin(a)) * r * uPixel;
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) continue;   // 取到画面外面的不算：否则取到的是画面最边上那一列像素，亮的东西贴着画面边移动时，它的光会跟着边上那一列忽亮忽暗
            float there = distanceAt(uv), theirs = blurOf(there);
            if (there > here) theirs = min(theirs, mine * 2.0);          // 后面的东西不许糊到前面清楚的东西上
            float w = smoothstep(r - 1.0, r + 1.0, theirs);              // 那个像素的虚化圈盖得到这里，才算它一份
            sum += colorAt(uv) * w; weight += w;
          }
          gl_FragColor = vec4(sum / weight, 1.0);
        }`,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  render(renderer, writeBuffer, readBuffer) {
    const u = this.material.uniforms;
    u.tDiffuse.value = readBuffer.texture; u.tDepth.value = readBuffer.depthTexture; u.uFocus.value = this.focus;
    u.uStrength.value = this.strength * this.gain; u.uMax.value = this.maxBlur * Math.min(this.gain, 2);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}
