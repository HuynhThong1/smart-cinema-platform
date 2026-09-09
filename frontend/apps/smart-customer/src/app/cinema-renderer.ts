import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface SceneState {
  stage: number;
  seat: string;
  combo: number;
  support: number | null;
  resolved: boolean;
  rating: number;
  cleaned: boolean;
  playing: boolean;
}

const POINTS = [
  [-4.4, 3.6],
  [-6.35, -2.05],
  [-2.95, -2.05],
  [-0.25, 1.2],
  [3.3, -0.6],
  [5.5, 3.25],
  [1.45, 3.7],
  [7, 1.15],
] as const;

/** Browser-only, procedural diorama. No remote models, textures or customer data. */
export class CinemaRenderer {
  private readonly scene = new T.Scene();
  private readonly camera = new T.PerspectiveCamera(35, 1, 0.1, 100);
  private readonly renderer: T.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly world = new T.Group();
  private readonly materials = new Map<string, T.MeshStandardMaterial>();
  private readonly textures = new Set<T.Texture>();
  private readonly resizeObserver: ResizeObserver;
  private readonly visibilityObserver: IntersectionObserver;
  private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly seatMeshes = new Map<string, T.Mesh[]>();
  private readonly bulbs: T.Mesh[] = [];
  private readonly labelTextures: {
    texture: T.CanvasTexture;
    vi: string;
    en: string;
    color: string;
    bg: string;
  }[] = [];
  private readonly guest = new T.Group();
  private readonly snacks = new T.Group();
  private readonly drink = new T.Group();
  private readonly cleaner = new T.Group();
  private readonly gate = new T.Group();
  private readonly filmMaterial: T.ShaderMaterial;
  private readonly beam: T.Mesh;
  private readonly careLight: T.Mesh;
  private readonly stageRing: T.Mesh;
  private readonly guestTarget = new T.Vector3();
  private readonly screenLight = new T.PointLight(0x7baeff, 12, 10, 2);
  private readonly sun = new T.DirectionalLight(0xffe8d1, 4);
  private state: SceneState = {
    stage: 0,
    seat: 'C4',
    combo: 1,
    support: null,
    resolved: false,
    rating: 0,
    cleaned: false,
    playing: false,
  };
  private language = '';
  private frame = 0;
  private disposed = false;
  private visible = true;
  private lastTime = 0;
  private filmTime = 0;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private readonly projected = new T.Vector3();

  constructor(
    private readonly host: HTMLElement,
    private readonly events: { markers: HTMLButtonElement[]; failed: () => void },
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 2), 2.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.style.cssText =
      'display:block;width:100%;height:100%;touch-action:pan-y;';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.enableZoom = false; // Page scroll stays available; explicit buttons control zoom.
    this.controls.minPolarAngle = 0.5;
    this.controls.maxPolarAngle = 1.24;
    this.controls.minAzimuthAngle = -0.95;
    this.controls.maxAzimuthAngle = 0.95;
    this.controls.rotateSpeed = 0.55;
    this.controls.touches.ONE = T.TOUCH.ROTATE;
    this.renderer.domElement.style.touchAction = 'pan-y';
    this.controls.target.set(0, 0.8, 0);
    this.resetCamera();
    this.scene.add(this.world);
    this.scene.add(new T.HemisphereLight(0xafd4ff, 0x334466, 2.3));
    this.sun.position.set(-7, 14, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -12;
    this.sun.shadow.camera.right = 12;
    this.sun.shadow.camera.top = 10;
    this.sun.shadow.camera.bottom = -10;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun);
    const rim = new T.DirectionalLight(0x568eff, 3);
    rim.position.set(6, 6, -8);
    this.scene.add(rim);
    this.buildArchitecture();
    this.buildServiceCounter(() => this.buildBoxOffice(), -6.35, -3.4, 0.2);
    this.buildServiceCounter(() => this.buildConcessions(), -2.95, -3.45, -3.45);
    this.buildLobby();
    this.buildAuditorium();
    this.buildGuestServices();
    this.filmMaterial = new T.ShaderMaterial({
      uniforms: { time: { value: 0 }, screening: { value: 0 } },
      vertexShader:
        'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec2 vUv; uniform float time; uniform float screening;
        void main(){vec2 p=(vUv-.5)*vec2(1.8,1.);float a=atan(p.y,p.x);float d=length(p);float ring=exp(-abs(d-.25-.018*sin(a*5.+time)) * 60.);
        vec3 c=mix(vec3(.025,.12,.29),vec3(.09,.3,.6),vUv.y);c+=ring*vec3(1.,.38,.08);
        float stars=pow(max(0.,sin(p.x*96.+p.y*27.)*sin(p.y*131.-p.x*13.)),36.);c+=stars*.8;
        c+=exp(-d*9.)*vec3(.1,.3,.6);c*=.75+screening*.5;gl_FragColor=vec4(c,1.);}`,
    });
    const screen = new T.Mesh(new T.PlaneGeometry(5.8, 2.28), this.filmMaterial);
    screen.position.set(3.4, 2.05, -4.91);
    this.world.add(screen);
    this.screenLight.position.set(3.4, 2.7, -3.6);
    this.scene.add(this.screenLight);
    const beamGeometry = new T.ConeGeometry(1.35, 5.1, 32, 1, true);
    beamGeometry.rotateX(Math.PI / 2);
    this.beam = new T.Mesh(
      beamGeometry,
      new T.MeshBasicMaterial({
        color: 0x94caff,
        transparent: true,
        opacity: 0.065,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    this.beam.position.set(3.4, 2.2, -2.4);
    this.beam.rotation.x = -0.12;
    this.world.add(this.beam);
    this.careLight = this.sphere(0.08, '#6ff3c2', 5.5, 1.17, 2.8);
    this.stageRing = new T.Mesh(new T.TorusGeometry(0.42, 0.035, 8, 48), this.mat('#ffae65', 2));
    this.stageRing.rotation.x = -Math.PI / 2;
    this.stageRing.position.set(-4.4, 0.06, 3.6);
    this.world.add(this.stageRing);
    this.person(this.guest, 0, 0, 0, '#f26b38');
    this.world.add(this.guest);
    this.guest.position.set(-4.4, 0, 3.6);
    this.buildMarkers();
    this.mergeStaticGeometry();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.start();
      else this.stop();
    });
    this.visibilityObserver.observe(host);
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    document.addEventListener('visibilitychange', this.visibilityChanged);
    this.resize();
    this.start();
  }

  private mat(color: string, emissive = 0) {
    const key = color + ':' + emissive;
    let material = this.materials.get(key);
    if (!material) {
      material = new T.MeshStandardMaterial({
        color,
        roughness: 0.52,
        metalness: 0.12,
        emissive: color,
        emissiveIntensity: emissive,
      });
      this.materials.set(key, material);
    }
    return material;
  }
  private box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: string,
    parent: T.Object3D = this.world,
    round = 0.025,
    emissive = 0,
  ) {
    const mesh = new T.Mesh(
      round
        ? new RoundedBoxGeometry(w, h, d, 1, Math.min(round, w / 3, h / 3, d / 3))
        : new T.BoxGeometry(w, h, d),
      this.mat(color, emissive),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  private sphere(
    radius: number,
    color: string,
    x: number,
    y: number,
    z: number,
    parent: T.Object3D = this.world,
  ) {
    const mesh = new T.Mesh(new T.SphereGeometry(radius, 12, 8), this.mat(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  private cylinder(
    rt: number,
    rb: number,
    h: number,
    color: string,
    x: number,
    y: number,
    z: number,
    parent: T.Object3D = this.world,
  ) {
    const mesh = new T.Mesh(new T.CylinderGeometry(rt, rb, h, 16), this.mat(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  private textTexture(text: string, color: string, bg: string, aspect = 4) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(2048, Math.round(256 * aspect));
    canvas.height = 256;
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
    this.textures.add(texture);
    this.drawText(texture, text, color, bg);
    return texture;
  }
  private drawText(texture: T.CanvasTexture, text: string, color: string, bg: string) {
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    let size = canvas.height * 0.7;
    ctx.font = `600 ${size}px Georgia, serif`;
    size *= Math.min(1, (canvas.width * 0.94) / ctx.measureText(text).width);
    ctx.font = `600 ${size}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    texture.needsUpdate = true;
  }
  private sign(
    vi: string,
    en: string,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    color = '#fff',
    bg = '#034ea2',
  ) {
    const texture = this.textTexture(vi, color, bg, w / h);
    this.labelTextures.push({ texture, vi, en, color, bg });
    const mesh = new T.Mesh(
      new T.PlaneGeometry(w, h),
      new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide, toneMapped: false }),
    );
    mesh.position.set(x, y, z);
    this.world.add(mesh);
    return mesh;
  }
  private plant(x: number, z: number, scale = 1) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    this.world.add(g);
    this.cylinder(0.24, 0.18, 0.4, '#ecddd0', 0, 0.2, 0, g);
    this.cylinder(0.035, 0.045, 0.65, '#647d4e', 0, 0.65, 0, g);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const leaf = this.sphere(
        0.25,
        i % 2 ? '#2f796d' : '#52a183',
        Math.sin(a) * 0.18,
        0.72 + i * 0.045,
        Math.cos(a) * 0.16,
        g,
      );
      leaf.scale.set(0.7, 1.9, 0.4);
      leaf.rotation.z = Math.sin(a) * 0.65;
    }
  }
  private person(parent: T.Object3D, x: number, y: number, z: number, color: string) {
    const g = new T.Group();
    g.position.set(x, y, z);
    parent.add(g);
    this.box(0.26, 0.36, 0.2, 0, 0.48, 0, color, g, 0.07);
    this.sphere(0.135, '#e4b697', 0, 0.82, 0, g);
    const hair = this.sphere(0.14, '#263248', 0, 0.89, -0.02, g);
    hair.scale.set(1, 0.62, 1);
    for (const side of [-1, 1]) {
      this.box(0.09, 0.26, 0.11, side * 0.075, 0.19, 0, '#233951', g);
      this.box(0.1, 0.07, 0.19, side * 0.075, 0.04, 0.03, '#e2eaf1', g);
      const arm = this.box(0.075, 0.31, 0.085, side * 0.18, 0.45, 0, color, g, 0.03);
      arm.rotation.z = side * 0.15;
    }
    return g;
  }
  private buildArchitecture() {
    this.box(17, 0.6, 11.5, 0, -0.4, 0, '#12304f', this.world, 0.2);
    this.box(17.1, 0.08, 11.6, 0, -0.12, 0, '#5086b4', this.world, 0.1);
    this.box(16.8, 0.13, 11.3, 0, -0.02, 0, '#d9dce0', this.world, 0.12);
    this.box(16.7, 0.055, 0.07, 0, -0.26, 5.74, '#f3a06a', this.world, 0, 2);
    this.box(0.07, 0.055, 11.4, -8.51, -0.26, 0, '#69bafa', this.world, 0, 1);
    // Lobby tile joints and a warm carpet leading from the entrance to the gate.
    for (let x = -8; x < 8; x += 1.1)
      this.box(0.012, 0.012, 11, x, 0.055, 0, '#b6c2cd', this.world, 0);
    for (let z = -5; z < 5.5; z += 1.1)
      this.box(16.6, 0.012, 0.012, 0, 0.055, z, '#b6c2cd', this.world, 0);
    this.box(2.2, 0.025, 3, -3.8, 0.08, 3.8, '#cb643f', this.world, 0.05);
    this.box(8.8, 0.025, 1.3, 1.2, 0.08, 1.7, '#235077', this.world, 0.05);
    this.box(17, 0.1, 0.16, 0, 2.8, -5.45, '#448ac4');
    this.box(17, 2.8, 0.2, 0, 1.4, -5.55, '#173a64');
    this.box(0.18, 2.7, 7.5, -8.4, 1.35, -1.7, '#3b5f83');
    this.box(16.7, 0.06, 0.06, 0, 2.65, -5.4, '#8dcfff', this.world, 0, 2);
    this.box(0.06, 0.06, 7.5, -8.27, 2.6, -1.7, '#ffc994', this.world, 0, 2);
    this.sign('Galaxy Cinema', 'Galaxy Cinema', 5.4, 0.85, -4.95, 2.04, -5.42, '#fff', '#173a64');
    this.sign(
      'Một thế giới điện ảnh',
      'A world of cinema',
      4.3,
      0.38,
      -4.95,
      1.46,
      -5.42,
      '#98badd',
      '#173a64',
    );
    for (let i = 0; i < 16; i++) {
      const b = this.sphere(0.045, '#ffe1a3', -7.65 + i * 0.36, 2.65, -5.3);
      b.material = this.mat('#ffce86', 3);
      this.bulbs.push(b);
    }
    this.plant(-7.6, 4.6, 1.3);
    this.plant(7.7, 4.6, 1.15);
    this.plant(-0.7, -4.7, 0.8);
  }
  /** Keep each counter's fixtures, staff and interactive products together in one service row. */
  private buildServiceCounter(build: () => void, x: number, z: number, originalZ: number) {
    const firstChild = this.world.children.length;
    build();
    const fixtures = this.world.children.slice(firstChild);
    const counter = new T.Group();
    fixtures.forEach((fixture) => {
      fixture.position.x += 5.2;
      fixture.position.z -= originalZ;
      counter.add(fixture);
    });
    counter.scale.x = 0.68;
    counter.position.set(x, 0, z);
    this.world.add(counter);
  }
  private buildBoxOffice() {
    this.box(4.6, 1, 0.9, -5.2, 0.55, 0.2, '#1555a0', this.world, 0.08);
    this.box(4.85, 0.12, 1.1, -5.2, 1.1, 0.2, '#f5e4ca', this.world, 0.06);
    this.box(4.45, 0.06, 0.03, -5.2, 0.18, 0.665, '#ffaa5d', this.world, 0, 2);
    this.sign('VÉ XEM PHIM', 'BOX OFFICE', 3.2, 0.4, -5.2, 0.65, 0.663, '#fff', '#1555a0');
    for (const x of [-6.55, -4.45]) {
      this.box(0.08, 0.25, 0.08, x, 1.3, 0.2, '#23384e');
      const monitor = this.box(0.58, 0.4, 0.07, x, 1.56, 0.22, '#21344f', this.world, 0.025);
      monitor.rotation.x = -0.15;
      this.box(0.47, 0.29, 0.015, x, 1.56, 0.266, '#8bc4eb', this.world, 0.01, 0.4);
      this.box(0.37, 0.025, 0.15, x, 1.17, 0.5, '#70849b');
      this.person(this.world, x, 0, -0.65, '#f26b38');
    }
    for (const x of [-7, -5.6, -4.2]) {
      this.cylinder(0.1, 0.14, 0.06, '#50667c', x, 0.11, 1.9);
      this.cylinder(0.025, 0.025, 0.65, '#c6d4dd', x, 0.45, 1.9);
      this.sphere(0.06, '#cfdae5', x, 0.79, 1.9);
      if (x < -4.3) this.box(1.3, 0.07, 0.035, x + 0.7, 0.7, 1.9, '#f26b38');
    }
  }
  private buildConcessions() {
    this.box(4.6, 1, 1, -5.2, 0.55, -3.45, '#e97840', this.world, 0.08);
    this.box(4.85, 0.12, 1.15, -5.2, 1.1, -3.45, '#f4e5cd', this.world, 0.05);
    this.sign('BẮP & NƯỚC', 'POPCORN & DRINKS', 3.5, 0.4, -5.2, 0.6, -2.94, '#fff', '#c96333');
    for (let i = 0; i < 11; i++)
      this.box(0.06, 0.74, 0.025, -7.35 + i * 0.43, 0.57, -2.93, '#ffc28f');
    this.box(4.5, 0.04, 0.02, -5.2, 0.17, -2.92, '#ffd9a0', this.world, 0, 2);
    // Popcorn warmer, glass panels, warm corn and soda dispenser.
    this.box(0.9, 0.13, 0.65, -6.7, 1.24, -3.55, '#d74929');
    this.box(0.98, 0.13, 0.72, -6.7, 2.08, -3.55, '#c94c2e');
    for (const x of [-7.1, -6.3])
      for (const z of [-3.8, -3.3]) this.box(0.035, 0.8, 0.035, x, 1.64, z, '#d45231');
    const glass = new T.Mesh(
      new T.BoxGeometry(0.79, 0.7, 0.5),
      new T.MeshStandardMaterial({
        color: 0xd2eaff,
        transparent: true,
        opacity: 0.18,
        roughness: 0.1,
        depthWrite: false,
      }),
    );
    glass.position.set(-6.7, 1.65, -3.55);
    this.world.add(glass);
    for (let i = 0; i < 30; i++)
      this.sphere(
        0.075,
        '#ffdb7b',
        -7 + (i % 6) * 0.11,
        1.38 + Math.floor(i / 12) * 0.1,
        -3.72 + (Math.floor(i / 6) % 2) * 0.23,
      );
    this.box(0.85, 0.82, 0.5, -3.8, 1.56, -3.65, '#234364');
    for (let i = 0; i < 3; i++) {
      this.box(
        0.18,
        0.25,
        0.035,
        -4.04 + i * 0.24,
        1.77,
        -3.38,
        ['#f77742', '#4c99dd', '#efc656'][i],
      );
      this.box(0.07, 0.1, 0.12, -4.04 + i * 0.24, 1.48, -3.32, '#dce5ea');
    }
    this.person(this.world, -5.1, 0, -4.3, '#f26b38');
    this.world.add(this.snacks);
    this.world.add(this.drink);
    this.cylinder(0.15, 0.11, 0.3, '#f5793d', -5.55, 1.32, -3.05, this.snacks);
    for (let i = 0; i < 7; i++)
      this.sphere(
        0.065,
        '#ffe0a0',
        -5.55 + Math.sin(i * 2.4) * 0.1,
        1.48 + (i % 2) * 0.04,
        -3.05 + Math.cos(i * 2.4) * 0.1,
        this.snacks,
      );
    this.cylinder(0.09, 0.065, 0.29, '#2062ac', -5.05, 1.31, -3.05, this.drink);
    this.cylinder(0.096, 0.096, 0.025, '#fff1de', -5.05, 1.47, -3.05, this.drink);
    this.cylinder(0.013, 0.013, 0.19, '#f0c798', -5.05, 1.57, -3.05, this.drink);
  }
  private buildLobby() {
    for (const [x, title, color] of [
      [-7.65, 'ORBIT', '#164571'],
      [-6.65, 'SOLAR', '#ce653f'],
    ] as const) {
      this.box(0.8, 1.55, 0.13, x, 0.9, 3.15, '#122e4e');
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 448;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createLinearGradient(0, 0, 256, 448);
      grad.addColorStop(0, color);
      grad.addColorStop(1, '#06182b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 448);
      ctx.strokeStyle = '#f9bb76';
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(128, 185, 34 + i * 13, 60 + i * 15, -0.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff1d8';
      ctx.font = 'bold 34px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(title, 128, 365);
      ctx.font = '14px Georgia';
      ctx.fillText('GALAXY ORIGINAL', 128, 400);
      const tex = new T.CanvasTexture(canvas);
      tex.colorSpace = T.SRGBColorSpace;
      this.textures.add(tex);
      const poster = new T.Mesh(
        new T.PlaneGeometry(0.68, 1.38),
        new T.MeshBasicMaterial({ map: tex }),
      );
      poster.position.set(x, 0.93, 3.23);
      this.world.add(poster);
      this.box(0.86, 0.055, 0.025, x, 1.71, 3.22, '#ffd896', this.world, 0, 2);
    }
    this.box(2.2, 0.35, 0.75, -1.25, 0.35, 4.1, '#d27c50', this.world, 0.14);
    this.box(2.2, 0.65, 0.2, -1.25, 0.65, 4.42, '#e29361', this.world, 0.09);
    for (const x of [-2.26, -0.24])
      this.box(0.18, 0.55, 0.75, x, 0.55, 4.1, '#e29361', this.world, 0.07);
    this.cylinder(0.38, 0.38, 0.07, '#e9d7b8', -1.2, 0.55, 3.2);
    this.cylinder(0.04, 0.15, 0.46, '#6f8190', -1.2, 0.28, 3.2);
    this.person(this.world, -3.1, 0, 3.45, '#69a7c7').rotation.y = 0.5;
    this.person(this.world, -2.6, 0, 2.6, '#eee3cb').rotation.y = -0.4;
    this.sign(
      'Bienvenue · Xin chào',
      'Bienvenue · Welcome',
      3.4,
      0.3,
      -4.5,
      0.22,
      5.7,
      '#a9cce7',
      '#12304f',
    );
  }
  private buildAuditorium() {
    this.box(7.75, 0.14, 5.6, 3.7, 0.12, -2.55, '#14263d');
    this.box(0.16, 2.3, 5.8, 7.75, 1.15, -2.65, '#233854');
    for (let i = 0; i < 11; i++)
      this.box(0.1, 1.9, 0.1, 7.65, 1.15, -5 + i * 0.46, i % 2 ? '#416082' : '#304968');
    this.box(0.04, 0.04, 5.6, 7.55, 0.26, -2.55, '#f4a969', this.world, 0, 2);
    this.box(6.1, 2.54, 0.16, 3.4, 2.05, -5.04, '#091a2d', this.world, 0.07);
    for (const x of [0.18, 6.6])
      for (let i = 0; i < 4; i++)
        this.cylinder(0.095, 0.095, 2.5, '#9a443d', x + i * 0.1, 1.65, -5.05);
    for (let r = 0; r < 4; r++) {
      const z = -3.9 + r * 1.04;
      const rise = 0.18 + r * 0.13;
      this.box(6.3, rise, 0.98, 3.5, rise / 2, z, '#20324a');
      this.box(6.25, 0.025, 0.025, 3.5, rise + 0.02, z + 0.48, '#fab879', this.world, 0, 1.2);
      for (let c = 0; c < 6; c++) {
        const x = 1.02 + c * 0.88 + (c > 2 ? 0.3 : 0);
        const parts: T.Mesh[] = [];
        parts.push(this.box(0.61, 0.24, 0.66, x, rise + 0.28, z, '#2771ab', this.world, 0.1));
        const back = this.box(
          0.62,
          0.67,
          0.19,
          x,
          rise + 0.6,
          z + 0.25,
          '#317db7',
          this.world,
          0.1,
        );
        back.rotation.x = -0.1;
        parts.push(back);
        for (const side of [-1, 1])
          parts.push(
            this.box(0.1, 0.24, 0.57, x + side * 0.33, rise + 0.46, z, '#1b4165', this.world, 0.04),
          );
        this.box(0.36, 0.12, 0.42, x, rise + 0.1, z, '#0c192b');
        this.seatMeshes.set('ABCD'[r] + (c + 1), parts);
      }
    }
    this.box(0.13, 2.2, 0.13, 3.4, 1.2, 0.6, '#566a80');
    this.box(0.68, 0.32, 0.6, 3.4, 2.4, 0.52, '#cad6e0', this.world, 0.06);
    const lens = this.cylinder(0.115, 0.115, 0.1, '#bbdcff', 3.4, 2.4, 0.17);
    lens.rotation.x = Math.PI / 2;
    lens.material = this.mat('#b7dfff', 2);
    this.sign(
      '01  ·  Phòng chiếu',
      '01  ·  Auditorium',
      3.1,
      0.34,
      3.5,
      0.24,
      0.5,
      '#b9dbf6',
      '#20324a',
    );
    for (const x of [-0.7, 0.45]) this.box(0.22, 0.8, 0.3, x, 0.47, 1.4, '#cad8e1');
    this.gate.position.set(-0.7, 0.84, 1.4);
    this.world.add(this.gate);
    this.box(1.15, 0.08, 0.08, 0.57, 0, 0, '#ffad62', this.gate, 0.02, 1);
    this.person(this.world, -1.35, 0, 1.3, '#f26b38').rotation.y = 0.5;
  }
  private buildGuestServices() {
    this.box(2.1, 0.95, 0.75, 5.7, 0.52, 3.45, '#205587', this.world, 0.09);
    this.box(2.3, 0.12, 0.9, 5.7, 1.06, 3.45, '#efdfc4');
    this.sign('Hỗ trợ', 'Guest care', 1.5, 0.35, 5.7, 0.6, 3.84, '#fff', '#205587');
    this.person(this.world, 5.7, 0, 2.7, '#f26b38');
    this.plant(6.9, 2.65, 0.65);
    this.box(0.5, 0.08, 0.4, 1.6, 0.13, 4.3, '#31526e');
    this.box(0.1, 0.75, 0.1, 1.6, 0.52, 4.3, '#d2dde5');
    this.box(0.6, 0.75, 0.12, 1.6, 1.15, 4.3, '#eaf0f5', this.world, 0.05);
    this.sign('★ ★ ★ ★ ★', '★ ★ ★ ★ ★', 0.52, 0.16, 1.6, 1.37, 4.37, '#f26b38', '#eaf0f5');
    this.sign('QR', 'QR', 0.38, 0.32, 1.6, 1.06, 4.37, '#034ea2', '#eaf0f5');
    this.world.add(this.cleaner);
    this.cleaner.position.set(7.15, 0, 1.6);
    this.box(0.45, 0.5, 0.6, 0, 0.4, 0, '#6599b4', this.cleaner, 0.06);
    this.cylinder(0.13, 0.11, 0.24, '#edb369', 0.1, 0.75, 0, this.cleaner);
    this.box(0.035, 0.9, 0.035, -0.25, 0.7, 0.15, '#c6aa76', this.cleaner);
    for (const z of [-0.22, 0.22])
      this.cylinder(0.08, 0.08, 0.05, '#21384a', 0, 0.13, z, this.cleaner).rotation.x = Math.PI / 2;
    this.person(this.world, 6.9, 0, 0.75, '#75b2af');
  }
  private buildMarkers() {
    POINTS.forEach(([x, z]) => {
      const ring = new T.Mesh(new T.TorusGeometry(0.22, 0.035, 8, 32), this.mat('#7ed0ff', 1));
      ring.position.set(x, 0.09, z);
      ring.rotation.x = -Math.PI / 2;
      this.world.add(ring);
    });
  }

  private mergeStaticGeometry() {
    // Batch scenery by material; interactive seats, actors and lights stay independent.
    const dynamic = new Set<T.Object3D>([
      this.guest,
      this.snacks,
      this.drink,
      this.cleaner,
      this.gate,
      this.careLight,
      this.stageRing,
      this.beam,
      ...[...this.seatMeshes.values()].flat(),
    ]);
    const batches = new Map<T.Material, T.Mesh[]>();
    this.world.updateMatrixWorld(true);
    this.world.traverse((object) => {
      if (
        !(object instanceof T.Mesh) ||
        Array.isArray(object.material) ||
        object.material === this.filmMaterial
      )
        return;
      for (let parent: T.Object3D | null = object; parent; parent = parent.parent)
        if (dynamic.has(parent)) return;
      const list = batches.get(object.material) || [];
      list.push(object);
      batches.set(object.material, list);
    });
    batches.forEach((meshes, material) => {
      if (meshes.length < 2) return;
      const parts = meshes.map((mesh) => {
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        return geometry.applyMatrix4(mesh.matrixWorld);
      });
      const geometry = mergeGeometries(parts);
      parts.forEach((part) => part.dispose());
      if (!geometry) return;
      const batch = new T.Mesh(geometry, material);
      batch.castShadow = true;
      batch.receiveShadow = true;
      this.world.add(batch);
      meshes.forEach((mesh) => {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      });
    });
  }

  update(state: SceneState, language: string) {
    this.state = state;
    const [x, z] = POINTS[state.stage];
    this.guestTarget.set(x, 0.02, z);
    if (state.stage === 4) {
      const row = 'ABCD'.indexOf(state.seat[0]);
      const column = Number(state.seat[1]) - 1;
      if (row >= 0 && column >= 0 && column < 6)
        this.guestTarget.set(
          1.02 + column * 0.88 + (column > 2 ? 0.3 : 0),
          0.18 + row * 0.13,
          -3.9 + row * 1.04,
        );
    }
    if (this.motion.matches) this.guest.position.copy(this.guestTarget);
    this.stageRing.position.set(x, 0.11, z);
    this.seatMeshes.forEach((parts, key) =>
      parts.forEach(
        (mesh, i) =>
          (mesh.material = this.mat(
            key === state.seat ? '#ff8b42' : i < 2 ? '#317db7' : '#1b4165',
          )),
      ),
    );
    this.snacks.visible = state.combo !== 2;
    this.drink.visible = state.combo === 1;
    this.gate.rotation.y = state.stage >= 3 ? -Math.PI / 2 : 0;
    this.careLight.material = this.mat(
      state.support !== null && !state.resolved ? '#ff8e43' : '#6ff3c2',
      2,
    );
    this.cleaner.position.z = state.cleaned ? -0.2 : 1.6;
    this.filmMaterial.uniforms['screening'].value = state.stage === 4 ? 1 : 0;
    this.screenLight.intensity = state.stage === 4 ? 22 : 8;
    this.beam.visible = state.stage === 4;
    this.sun.intensity = state.stage === 4 ? 1.6 : 3;
    if (this.language !== language) {
      this.language = language;
      this.labelTextures.forEach((label) =>
        this.drawText(
          label.texture,
          language === 'en' ? label.en : label.vi,
          label.color,
          label.bg,
        ),
      );
    }
  }
  rotate() {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.applyAxisAngle(new T.Vector3(0, 1, 0), 0.3);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }
  zoom(direction: number) {
    this.camera.zoom = T.MathUtils.clamp(this.camera.zoom + direction * 0.15, 0.7, 1.65);
    this.camera.updateProjectionMatrix();
  }
  resetCamera() {
    this.camera.position.set(-14.4, 17, 23);
    this.camera.zoom = 1.18;
    this.controls?.target.set(0, 0.7, 0);
    this.camera.lookAt(0, 0.7, 0);
    this.camera.updateProjectionMatrix();
    this.controls?.update();
  }
  private resize() {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 2), 2.5));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = width < 360 ? 51 : width < 600 ? 47 : 35;
    this.camera.updateProjectionMatrix();
  }
  private positionMarkers() {
    POINTS.forEach(([x, z], index) => {
      this.projected.set(x, 1.7, z).project(this.camera);
      const marker = this.events.markers[index];
      if (!marker) return;
      const left = T.MathUtils.clamp(
        ((this.projected.x + 1) * this.viewportWidth) / 2,
        24,
        this.viewportWidth - 24,
      );
      const top = T.MathUtils.clamp(
        ((1 - this.projected.y) * this.viewportHeight) / 2,
        30,
        this.viewportHeight - 76,
      );
      marker.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px) translate(-50%, -50%)`;
      marker.style.visibility = Math.abs(this.projected.z) <= 1 ? 'visible' : 'hidden';
    });
  }

  private contextLost = (event: Event) => {
    event.preventDefault();
    this.stop();
    this.events.failed();
  };
  private visibilityChanged = () => {
    if (document.hidden) this.stop();
    else if (this.visible) this.start();
  };
  private start() {
    if (!this.frame && !this.disposed && !document.hidden)
      this.frame = requestAnimationFrame(this.render);
  }
  private stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.lastTime = 0;
  }
  private render = (now: number) => {
    if (this.disposed) return;
    const delta = this.lastTime ? Math.min((now - this.lastTime) / 1000, 0.05) : 0;
    this.lastTime = now;
    if (!this.motion.matches) {
      this.filmTime += delta;
      this.filmMaterial.uniforms['time'].value = this.filmTime * 0.4;
      const distance = this.guest.position.distanceTo(this.guestTarget);
      if (distance > 0.02) {
        this.guest.position.lerp(this.guestTarget, Math.min(delta * 2.5, 1));
        this.guest.rotation.y = Math.atan2(
          this.guestTarget.x - this.guest.position.x,
          this.guestTarget.z - this.guest.position.z,
        );
        this.guest.position.y += Math.abs(Math.sin(now * 0.009)) * delta * 0.1;
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.positionMarkers();
    this.frame = requestAnimationFrame(this.render);
  };
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.resizeObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    this.controls.dispose();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    const geometries = new Set<T.BufferGeometry>();
    const materials = new Set<T.Material>();
    this.scene.traverse((object) => {
      if (object instanceof T.Mesh) {
        geometries.add(object.geometry);
        (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) =>
          materials.add(m),
        );
      } else if (object instanceof T.Sprite) materials.add(object.material);
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
