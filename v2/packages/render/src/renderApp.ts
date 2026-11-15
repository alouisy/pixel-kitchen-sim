import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  HemisphereLight,
  PCFSoftShadowMap,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { ChefView } from './chefView.js';
import { DioramaCamera } from './camera.js';
import { createGround } from './ground.js';

/** "Mushroom Meadow" lighting preset (docs/v2/07 §3.3). */
function addMeadowLights(scene: Scene): DirectionalLight {
  scene.add(new HemisphereLight(0xbfe3c9, 0x6b8f4e, 1.1));
  const sun = new DirectionalLight(0xffe2b0, 2.2);
  sun.position.set(12, 20, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -25;
  cam.right = cam.top = 25;
  cam.near = 1;
  cam.far = 70;
  scene.add(sun);
  return sun;
}

export class RenderApp {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly cameraRig = new DioramaCamera();
  private chefs: ChefView[] = [];
  private prev: Float32Array<ArrayBufferLike> = new Float32Array(0);
  private curr: Float32Array<ArrayBufferLike> = new Float32Array(0);
  private alpha = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new Color(0xbfe3c9);
    addMeadowLights(this.scene);
    this.scene.add(createGround());
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  private readonly resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.cameraRig.resize(w / h);
  };

  /** prev/curr hold x,y,z,yaw per chef slot. */
  setChefStates(prev: Float32Array, curr: Float32Array, alpha: number): void {
    const count = curr.length / 4;
    while (this.chefs.length < count) {
      const view = new ChefView(this.chefs.length);
      this.chefs.push(view);
      this.scene.add(view.group);
    }
    this.prev = prev.length === curr.length ? prev : curr;
    this.curr = curr;
    this.alpha = alpha;
  }

  render(dt: number): void {
    this.chefs.forEach((chef, i) => chef.setInterpolated(this.prev, this.curr, i * 4, this.alpha));
    const first = this.chefs[0];
    if (first) this.cameraRig.update(first.group.position, dt);
    this.renderer.render(this.scene, this.cameraRig.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }
}

export function createRenderer(canvas: HTMLCanvasElement): RenderApp {
  return new RenderApp(canvas);
}
