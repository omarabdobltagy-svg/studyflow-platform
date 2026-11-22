// @ts-nocheck
import * as THREE from "three";
import { useEffect, useRef } from "react";

/**
 * A lightweight decorative 3D scene for the StudyFlow header.
 * It is intentionally non-interactive and degrades gracefully when WebGL is unavailable.
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
      const camera = new THREE.PerspectiveCamera(34, 2.7, 0.1, 40);
      camera.position.set(0, 0, 4.8);

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
        precision: "mediump",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      host.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xffe8aa, 0x181512, 1.35));
      const keyLight = new THREE.PointLight(0xffc84b, 22, 12);
      keyLight.position.set(2.2, 1.7, 3.5);
      scene.add(keyLight);
      const redLight = new THREE.PointLight(0xd7263d, 8, 8);
      redLight.position.set(-2, -1.2, 1.5);
      scene.add(redLight);

      const system = new THREE.Group();
      scene.add(system);

      const coreGeometry = new THREE.IcosahedronGeometry(0.48, 2);
      const coreMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xc99424,
        metalness: 0.76,
        roughness: 0.24,
        clearcoat: 0.9,
        clearcoatRoughness: 0.2,
      });
      const core = new THREE.Mesh(coreGeometry, coreMaterial);
      system.add(core);

      const goldMaterial = new THREE.MeshBasicMaterial({
        color: 0xf4c34f,
        transparent: true,
        opacity: 0.9,
      });
      const redMaterial = new THREE.MeshBasicMaterial({
        color: 0xd82b3f,
        transparent: true,
        opacity: 0.82,
      });
      const ringOne = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.012, 8, 112), goldMaterial);
      ringOne.rotation.set(0.75, 0.18, 0.35);
      system.add(ringOne);

      const ringTwo = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.009, 8, 112), redMaterial);
      ringTwo.rotation.set(1.42, 0.5, -0.4);
      system.add(ringTwo);

      const ringThree = new THREE.Mesh(new THREE.TorusGeometry(0.67, 0.008, 8, 96), goldMaterial.clone());
      ringThree.rotation.set(0.18, 1.18, 0.25);
      system.add(ringThree);

      const starGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(48 * 3);
      for (let i = 0; i < 48; i += 1) {
        const radius = 1.35 + Math.random() * 0.8;
        const angle = Math.random() * Math.PI * 2;
        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 1.8;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
      }
      starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({
        color: 0xf3c65c,
        size: 0.018,
        transparent: true,
        opacity: 0.72,
        sizeAttenuation: true,
      }));
      system.add(stars);

      const satelliteGroup = new THREE.Group();
      system.add(satelliteGroup);
      const satelliteGeometry = new THREE.OctahedronGeometry(0.075, 1);
      const satelliteGoldMaterial = new THREE.MeshStandardMaterial({
        color: 0xf1c452,
        metalness: 0.72,
        roughness: 0.24,
        emissive: 0x6b4a0c,
        emissiveIntensity: 0.35,
      });
      const satelliteRedMaterial = new THREE.MeshStandardMaterial({
        color: 0xd82b3f,
        metalness: 0.58,
        roughness: 0.28,
        emissive: 0x4a1018,
        emissiveIntensity: 0.3,
      });
      const satellites: THREE.Mesh[] = [];
      for (let index = 0; index < 4; index += 1) {
        const angle = (index / 4) * Math.PI * 2;
        const satellite = new THREE.Mesh(
          satelliteGeometry,
          index % 2 === 0 ? satelliteGoldMaterial : satelliteRedMaterial
        );
        satellite.position.set(Math.cos(angle) * 1.18, Math.sin(angle) * 0.56, (index % 2 ? 0.42 : -0.3));
        satelliteGroup.add(satellite);
        satellites.push(satellite);
      }
      const pulseOrbit = new THREE.Mesh(
        new THREE.TorusGeometry(1.25, 0.004, 5, 120),
        new THREE.MeshBasicMaterial({ color: 0xe4b849, transparent: true, opacity: 0.34 })
      );
      pulseOrbit.rotation.set(0.4, 0.8, 0.2);
      system.add(pulseOrbit);


      const resize = () => {
        if (!renderer || disposed) return;
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const renderFrame = () => {
        if (disposed || !renderer) return;
        if (!reduceMotion) {
          const elapsed = performance.now() * 0.001;
          system.rotation.y += 0.003;
          system.rotation.x = Math.sin(performance.now() * 0.00028) * 0.075;
          core.scale.setScalar(1 + Math.sin(elapsed * 1.35) * 0.035);
          satelliteGroup.rotation.y += 0.004;
          satellites.forEach((satellite, index) => {
            satellite.rotation.x += 0.012 + index * 0.001;
            satellite.rotation.y -= 0.009;
            satellite.scale.setScalar(1 + Math.sin(elapsed * 2 + index) * 0.12);
          });
          pulseOrbit.rotation.z += 0.0011;
          ringTwo.rotation.z -= 0.0016;
          stars.rotation.y -= 0.0008;
        }
        renderer.render(scene, camera);
        if (!reduceMotion) animationFrame = window.requestAnimationFrame(renderFrame);
      };
      renderFrame();

      return () => {
        disposed = true;
        window.cancelAnimationFrame(animationFrame);
        resizeObserver?.disconnect();
        coreGeometry.dispose();
        coreMaterial.dispose();
        ringOne.geometry.dispose();
        ringTwo.geometry.dispose();
        ringThree.geometry.dispose();
        goldMaterial.dispose();
        redMaterial.dispose();
        (ringThree.material as THREE.Material).dispose();
        starGeometry.dispose();
        (stars.material as THREE.Material).dispose();
        satelliteGeometry.dispose();
        satelliteGoldMaterial.dispose();
        satelliteRedMaterial.dispose();
        pulseOrbit.geometry.dispose();
        (pulseOrbit.material as THREE.Material).dispose();
        renderer?.dispose();
        renderer?.domElement.remove();
      };
    } catch {
      renderer?.dispose();
      host.replaceChildren();
      return () => {
        disposed = true;
        window.cancelAnimationFrame(animationFrame);
        resizeObserver?.disconnect();
        renderer?.dispose();
        renderer?.domElement.remove();
      };
    }
  }, []);

  return <div ref={hostRef} className="h-full w-full" aria-hidden="true" />;
}
