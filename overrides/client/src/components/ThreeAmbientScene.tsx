import * as THREE from "three";
import { useEffect, useRef } from "react";

type RibbonOptions = {
  color: THREE.ColorRepresentation;
  width: number;
  phase: number;
  opacity?: number;
};

function createRibbonGeometry(curve: THREE.CatmullRomCurve3, width: number, phase: number) {
  const segments = 220;
  const frames = curve.computeFrenetFrames(segments, true);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const center = curve.getPointAt(progress);
    const normal = frames.normals[index];
    const binormal = frames.binormals[index];
    const twist = Math.sin(progress * Math.PI * 4 + phase) * 0.34;
    const direction = normal.clone().multiplyScalar(Math.cos(twist))
      .add(binormal.clone().multiplyScalar(Math.sin(twist)))
      .normalize();
    const taper = 0.72 + 0.28 * Math.pow(Math.sin(progress * Math.PI), 0.45);
    const halfWidth = width * taper * 0.5;

    const left = center.clone().addScaledVector(direction, -halfWidth);
    const right = center.clone().addScaledVector(direction, halfWidth);
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    uvs.push(0, progress, 1, progress);

    if (index < segments) {
      const start = index * 2;
      indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createRibbon(
  curve: THREE.CatmullRomCurve3,
  options: RibbonOptions,
) {
  const geometry = createRibbonGeometry(curve, options.width, options.phase);
  const material = new THREE.MeshPhysicalMaterial({
    color: options.color,
    metalness: 0.52,
    roughness: 0.29,
    clearcoat: 1,
    clearcoatRoughness: 0.2,
    side: THREE.DoubleSide,
    transparent: Boolean(options.opacity && options.opacity < 1),
    opacity: options.opacity ?? 1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/**
 * A lightweight abstract 3D accent built from interwoven metallic ribbons.
 * It remains decorative, has no interaction target, and respects reduced motion.
 */
export default function ThreeAmbientScene() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let disposed = false;

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30);
      camera.position.set(0, 0, 4.7);

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
        precision: "mediump",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.domElement.setAttribute("aria-hidden", "true");
      Object.assign(renderer.domElement.style, {
        display: "block",
        width: "100%",
        height: "100%",
      });
      host.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xe8e1d2, 1.65));
      const keyLight = new THREE.DirectionalLight(0xffe0a3, 2.8);
      keyLight.position.set(2.4, 2.1, 4);
      scene.add(keyLight);
      const pearlLight = new THREE.PointLight(0xd8d0c2, 10, 8);
      pearlLight.position.set(-2.3, 1.4, 2.5);
      scene.add(pearlLight);
      const garnetLight = new THREE.PointLight(0x9d4653, 7, 7);
      garnetLight.position.set(1.7, -1.6, 1.6);
      scene.add(garnetLight);

      const sculpture = new THREE.Group();
      scene.add(sculpture);

      const ribbonCurves = [
        {
          options: { color: 0xc6a66d, width: 0.19, phase: 0.2 },
          points: [
            [-1.35, -0.24, -0.12], [-1.05, 0.55, 0.18], [-0.24, 0.78, 0.34],
            [0.68, 0.43, -0.08], [1.3, -0.12, 0.18], [0.75, -0.78, 0.12],
            [-0.12, -0.83, -0.2], [-0.95, -0.56, -0.16],
          ],
        },
        {
          options: { color: 0x98505a, width: 0.15, phase: 1.8 },
          points: [
            [-1.18, 0.43, 0.2], [-0.7, -0.35, -0.28], [0.08, -0.72, 0.14],
            [0.88, -0.38, 0.32], [1.22, 0.37, -0.12], [0.42, 0.82, -0.24],
            [-0.48, 0.65, 0.24],
          ],
        },
        {
          options: { color: 0xd8d1c5, width: 0.075, phase: 2.7, opacity: 0.84 },
          points: [
            [-1.08, -0.08, 0.38], [-0.62, 0.64, 0.46], [0.27, 0.7, 0.38],
            [1.08, 0.12, 0.42], [0.7, -0.56, 0.48], [-0.2, -0.68, 0.38],
          ],
        },
      ];

      const ribbonMeshes: THREE.Mesh[] = [];
      ribbonCurves.forEach(({ options, points }) => {
        const curve = new THREE.CatmullRomCurve3(
          points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
          true,
          "catmullrom",
          0.48,
        );
        const mesh = createRibbon(curve, options);
        sculpture.add(mesh);
        ribbonMeshes.push(mesh);
      });

      const coreMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xe6dfd2,
        metalness: 0.18,
        roughness: 0.16,
        transmission: 0.42,
        thickness: 0.8,
        ior: 1.28,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      });
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.27, 48, 36), coreMaterial);
      core.scale.set(1, 1.13, 0.82);
      sculpture.add(core);

      const highlight = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 24, 20),
        new THREE.MeshBasicMaterial({ color: 0xf2d8a7, transparent: true, opacity: 0.74 }),
      );
      highlight.position.set(-0.09, 0.15, 0.29);
      sculpture.add(highlight);

      const resize = () => {
        if (!renderer || disposed) return;
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.position.z = width < 180 ? 5.2 : 4.7;
        camera.updateProjectionMatrix();
        const scale = Math.min(0.94, Math.max(0.58, Math.min(width / 230, height / 170)));
        sculpture.scale.setScalar(scale);
      };
      resize();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const renderFrame = () => {
        if (disposed || !renderer) return;
        if (!reduceMotion) {
          const elapsed = performance.now() * 0.001;
          sculpture.rotation.y = Math.sin(elapsed * 0.24) * 0.19;
          sculpture.rotation.x = Math.sin(elapsed * 0.31) * 0.07;
          sculpture.rotation.z = Math.sin(elapsed * 0.18) * 0.035;
          core.scale.y = 1.13 + Math.sin(elapsed * 1.1) * 0.035;
          ribbonMeshes.forEach((mesh, index) => {
            mesh.rotation.z = Math.sin(elapsed * 0.32 + index * 1.8) * 0.018;
          });
        }
        renderer.render(scene, camera);
        if (!reduceMotion) animationFrame = window.requestAnimationFrame(renderFrame);
      };
      renderFrame();

      return () => {
        disposed = true;
        window.cancelAnimationFrame(animationFrame);
        resizeObserver?.disconnect();
        scene.traverse(object => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach(material => material.dispose());
          }
        });
        renderer?.dispose();
        renderer?.domElement.remove();
      };
    } catch {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      renderer?.dispose();
      renderer?.domElement.remove();
      host.replaceChildren();
    }
  }, []);

  return <div ref={hostRef} className="h-full w-full" aria-hidden="true" />;
}
