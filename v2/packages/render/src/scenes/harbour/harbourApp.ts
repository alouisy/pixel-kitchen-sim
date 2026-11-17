import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';

const SKY = 0xbfe3f5;

/** Renderer, lights, fog and the camera rig for the harbour diorama. The camera frames the whole kiosk and drifts slightly toward the chefs. */
export class HarbourApp {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(38, 1, 0.1, 200);
  readonly sun: DirectionalLight;
  private aspect = 1;
  private readonly focus = new Vector3(0, 0, 0.3);
  private readonly look = new Vector3(0, 0, 0.3);
  private orbit = 0;
  private shakeAmount = 0;
  /** 'play' frames the kiosk; 'title' slowly orbits for the menu backdrop. */
  mode: 'play' | 'title' = 'title';

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new Color(SKY);
    this.scene.fog = new Fog(SKY, 42, 120);
    // Warm sunny afternoon: sky-blue hemisphere over a sand bounce.
    this.scene.add(new HemisphereLight(0xaedcff, 0xe6cf9c, 1.15));
    const sun = new DirectionalLight(0xffe0ad, 2.6);
    sun.position.set(-9, 16, 8);
    sun.castShadow = true;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 3.5;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = c.bottom = -12;
    c.right = c.top = 12;
    c.near = 1;
    c.far = 50;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  private readonly resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  };

  shake(amount: number): void {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  /** `chefCentroid` is the mean chef position (x, z); the camera leans 20 % toward it. */
  render(dt: number, time: number, chefCentroid: { x: number; z: number } | null): void {
    const cam = this.camera;
    const tanV = Math.tan((cam.fov * Math.PI) / 360);
    if (this.mode === 'title') {
      this.orbit += dt * 0.05;
      const d = Math.max(18, 8.5 / (tanV * this.aspect));
      this.look.set(1.2, 0.6, 0.2);
      cam.position.set(this.look.x + Math.sin(0.55 + Math.sin(this.orbit) * 0.35) * d * 0.55, 6.5 + d * 0.25, this.look.z + d * 0.9);
      cam.lookAt(this.look);
    } else {
      const lean = chefCentroid ?? { x: 0, z: 0 };
      const tx = lean.x * 0.12;
      const tz = 0.4 + lean.z * 0.1;
      const k = 1 - Math.exp(-4 * dt);
      this.focus.x += (tx - this.focus.x) * k;
      this.focus.z += (tz - this.focus.z) * k;
      const need = Math.max(15, 5.6 / (tanV * this.aspect));
      const pitch = (54 * Math.PI) / 180;
      cam.position.set(this.focus.x, need * Math.sin(pitch), this.focus.z + need * Math.cos(pitch));
      this.look.set(this.focus.x, 0.2, this.focus.z - 0.2);
      cam.lookAt(this.look);
    }
    if (this.shakeAmount > 0.002) {
      cam.position.x += Math.sin(time * 71) * this.shakeAmount;
      cam.position.y += Math.cos(time * 63) * this.shakeAmount;
      this.shakeAmount *= Math.exp(-5 * dt);
    } else this.shakeAmount = 0;
    this.renderer.render(this.scene, cam);
  }

  /** Project a world point to CSS pixels; null when behind the camera. */
  project(x: number, y: number, z: number): { x: number; y: number } | null {
    const v = new Vector3(x, y, z).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }
}
