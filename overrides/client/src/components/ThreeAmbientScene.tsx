// @ts-nocheck -- this repository does not install the three.js declaration package.
import * as THREE from "three";
import { useEffect, useRef } from "react";

/**
 * Motion-first StudyFlow sculpture.
 * A saturated violet glass-core with orbital geometry, soft particles and pointer parallax.
 * The scene stays decorative and automatically becomes static for reduced-motion users.
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
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let targetX = 0;
    let targetY = 0;

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
      camera.position.set(0, 0, 5.2);

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
        precision: "mediump",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;
      Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });
      renderer.domElement.setAttribute("aria-hidden", "true");
      host.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xded3ff, 1.55));
      const key = new THREE.DirectionalLight(0xffffff, 3.2);
      key.position.set(2.6, 3.1, 4);
      scene.add(key);
      const violetLight = new THREE.PointLight(0x8c424c, 24, 12);
      violetLight.position.set(-2.1, 0.8, 2.2);
      scene.add(violetLight);
      const cyanLight = new THREE.PointLight(0xd1b77b, 13, 10);
      cyanLight.position.set(2.4, -1.5, 2);
      scene.add(cyanLight);
      const pinkLight = new THREE.PointLight(0xb18a5f, 16, 10);
      pinkLight.position.set(0.1, 2.1, -1);
      scene.add(pinkLight);

      const sculpture = new THREE.Group();
      scene.add(sculpture);

      const coreMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x8c424c,
        emissive: 0x351064,
        emissiveIntensity: 0.7,
        metalness: 0.38,
        roughness: 0.16,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        iridescence: 0.78,
        iridescenceIOR: 1.35,
        iridescenceThicknessRange: [180, 520],
      });
      const core = new THREE.Mesh(new THREE.TorusKnotGeometry(0.92, 0.28, 220, 28, 2, 3), coreMaterial);
      core.scale.set(1.13, 0.92, 0.78);
      sculpture.add(core);

      const inner = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.42, 2),
        new THREE.MeshPhysicalMaterial({
          color: 0xe0cdad,
          emissive: 0x155a9b,
          emissiveIntensity: 0.32,
          metalness: 0.25,
          roughness: 0.09,
          transmission: 0.22,
          thickness: 0.7,
          clearcoat: 1,
        }),
      );
      inner.rotation.set(0.25, 0.6, 0.1);
      sculpture.add(inner);

      const ringMaterials = [
        new THREE.MeshBasicMaterial({ color: 0xd1b77b, transparent: true, opacity: 0.72 }),
        new THREE.MeshBasicMaterial({ color: 0x8c424c, transparent: true, opacity: 0.64 }),
        new THREE.MeshBasicMaterial({ color: 0xb18a5f, transparent: true, opacity: 0.52 }),
      ];
      const rings: THREE.Mesh[] = [];
      const ringConfigs = [
        { radius: 1.52, tube: 0.012, rotation: [0.95, 0.1, 0.28] as const },
        { radius: 1.78, tube: 0.008, rotation: [0.25, 1.05, -0.48] as const },
        { radius: 1.28, tube: 0.009, rotation: [1.3, 0.4, 0.86] as const },
      ];
      ringConfigs.forEach((config, index) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(config.radius, config.tube, 8, 160),
          ringMaterials[index],
        );
        ring.rotation.set(...config.rotation);
        sculpture.add(ring);
        rings.push(ring);
      });

      const satellites: THREE.Mesh[] = [];
      const satelliteGeometry = new THREE.OctahedronGeometry(0.13, 1);
      const satelliteMaterials = [
        new THREE.MeshPhysicalMaterial({ color: 0x8c424c, metalness: 0.52, roughness: 0.18, clearcoat: 1 }),
        new THREE.MeshPhysicalMaterial({ color: 0xd1b77b, metalness: 0.36, roughness: 0.15, clearcoat: 1 }),
        new THREE.MeshPhysicalMaterial({ color: 0xb18a5f, metalness: 0.34, roughness: 0.18, clearcoat: 1 }),
        new THREE.MeshPhysicalMaterial({ color: 0xd1b77b, metalness: 0.22, roughness: 0.2, clearcoat: 1 }),
      ];
      for (let index = 0; index < 4; index += 1) {
        const satellite = new THREE.Mesh(satelliteGeometry, satelliteMaterials[index]);
        const angle = (index / 4) * Math.PI * 2 + 0.4;
        satellite.position.set(Math.cos(angle) * 1.63, Math.sin(angle) * 0.86, index % 2 ? 0.58 : -0.48);
        satellite.scale.setScalar(index === 3 ? 0.78 : 1);
        sculpture.add(satellite);
        satellites.push(satellite);
      }

      const particleCount = 180;
      const particlePositions = new Float32Array(particleCount * 3);
      for (let index = 0; index < particleCount; index += 1) {
        const angle = (index / particleCount) * Math.PI * 2;
        const radius = 1.95 + ((index * 37) % 100) / 100 * 0.82;
        particlePositions[index * 3] = Math.cos(angle) * radius;
        particlePositions[index * 3 + 1] = Math.sin(angle) * radius * 0.58;
        particlePositions[index * 3 + 2] = ((index * 19) % 100) / 100 * 1.5 - 0.75;
      }
      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
      const particles = new THREE.Points(
        particleGeometry,
        new THREE.PointsMaterial({ color: 0xd1b77b, size: 0.018, transparent: true, opacity: 0.72, sizeAttenuation: true }),
      );
      sculpture.add(particles);

      const resize = () => {
        if (!renderer || disposed) return;
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.position.z = width < 420 ? 6.1 : 5.2;
        camera.updateProjectionMatrix();
        const scale = Math.min(1.05, Math.max(0.46, Math.min(width / 390, height / 300)));
        sculpture.scale.setScalar(scale);
      };
      resize();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);

      const onPointerMove = (event: PointerEvent) => {
        const bounds = host.getBoundingClientRect();
        targetX = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 0.24;
        targetY = ((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 0.18;
      };
      const onPointerLeave = () => { targetX = 0; targetY = 0; };
      host.addEventListener("pointermove", onPointerMove, { passive: true });
      host.addEventListener("pointerleave", onPointerLeave);

      const renderFrame = () => {
        if (disposed || !renderer) return;
        if (!reduceMotion) {
          const elapsed = performance.now() * 0.001;
          sculpture.rotation.y += ((Math.sin(elapsed * 0.22) * 0.24 + targetX) - sculpture.rotation.y) * 0.025;
          sculpture.rotation.x += ((Math.sin(elapsed * 0.29) * 0.08 + targetY) - sculpture.rotation.x) * 0.025;
          sculpture.rotation.z = Math.sin(elapsed * 0.16) * 0.035;
          core.rotation.x = elapsed * 0.09;
          core.rotation.y = elapsed * 0.17;
          inner.rotation.x = elapsed * 0.12;
          inner.rotation.y = -elapsed * 0.2;
          rings.forEach((ring, index) => {
            ring.rotation.z += (index % 2 ? 1 : -1) * 0.0009 * (index + 1);
          });
          satellites.forEach((satellite, index) => {
            satellite.position.y += Math.sin(elapsed * 1.1 + index * 2) * 0.0015;
            satellite.rotation.x += 0.004 + index * 0.0006;
            satellite.rotation.y += 0.006 + index * 0.0008;
          });
          particles.rotation.z = elapsed * 0.018;
        }
        renderer.render(scene, camera);
        if (!reduceMotion) animationFrame = window.requestAnimationFrame(renderFrame);
      };
      renderFrame();

      return () => {
        disposed = true;
        window.cancelAnimationFrame(animationFrame);
        resizeObserver?.disconnect();
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerleave", onPointerLeave);
        scene.traverse(object => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach(material => material.dispose());
          }
        });
        renderer?.dispose();
        renderer?.domElement.remove();
      };
    } catch (error) {
      console.error("StudyFlow 3D scene unavailable:", error);
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
