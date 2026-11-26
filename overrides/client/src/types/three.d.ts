declare module "three" {
  export class Euler {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
  }

  export class Vector3 {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    copy(value: Vector3): this;
    constructor(x?: number, y?: number, z?: number);
  }

  export class Object3D {
    position: Vector3;
    rotation: Euler;
    scale: Vector3;
    add(...objects: Object3D[]): this;
  }

  export class Material {
    dispose(): void;
  }

  export class BufferGeometry {
    setAttribute(name: string, attribute: BufferAttribute): this;
    dispose(): void;
  }

  export class Scene extends Object3D {
    traverse(callback: (object: Object3D) => void): void;
  }

  export class PerspectiveCamera extends Object3D {
    aspect: number;
    updateProjectionMatrix(): void;
    constructor(fov: number, aspect: number, near: number, far: number);
  }

  export class WebGLRenderer {
    domElement: HTMLCanvasElement;
    constructor(parameters?: {
      alpha?: boolean;
      antialias?: boolean;
      powerPreference?: "default" | "high-performance" | "low-power";
    });
    setPixelRatio(value: number): void;
    setClearColor(color: number, alpha?: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    render(scene: Scene, camera: PerspectiveCamera): void;
    dispose(): void;
  }

  export class AmbientLight extends Object3D {
    constructor(color?: number, intensity?: number);
  }

  export class PointLight extends Object3D {
    constructor(color?: number, intensity?: number, distance?: number);
  }

  export class Group extends Object3D {}

  export class IcosahedronGeometry extends BufferGeometry {
    constructor(radius?: number, detail?: number);
  }

  export class SphereGeometry extends BufferGeometry {
    constructor(radius?: number, widthSegments?: number, heightSegments?: number);
  }

  export class CatmullRomCurve3 {
    constructor(points?: Vector3[]);
    getPoint(t: number): Vector3;
  }

  export class TubeGeometry extends BufferGeometry {
    constructor(path: CatmullRomCurve3, tubularSegments?: number, radius?: number, radialSegments?: number, closed?: boolean);
  }

  export class TorusGeometry extends BufferGeometry {
    constructor(radius?: number, tube?: number, radialSegments?: number, tubularSegments?: number);
  }

  export class EdgesGeometry extends BufferGeometry {
    constructor(geometry: BufferGeometry);
  }

  export class BufferAttribute {
    constructor(array: Float32Array, itemSize: number);
  }

  export class MeshPhysicalMaterial extends Material {
    constructor(parameters?: Record<string, string | number | boolean>);
  }

  export class MeshBasicMaterial extends Material {
    constructor(parameters?: Record<string, string | number | boolean>);
  }

  export class LineBasicMaterial extends Material {
    constructor(parameters?: Record<string, string | number | boolean>);
  }

  export class PointsMaterial extends Material {
    constructor(parameters?: Record<string, string | number | boolean>);
  }

  export class Mesh extends Object3D {
    geometry: BufferGeometry;
    material: Material;
    constructor(geometry: BufferGeometry, material: Material);
  }

  export class LineSegments extends Object3D {
    geometry: BufferGeometry;
    material: Material;
    constructor(geometry: BufferGeometry, material: Material);
  }

  export class Points extends Object3D {
    geometry: BufferGeometry;
    material: Material;
    constructor(geometry: BufferGeometry, material: Material);
  }
}
