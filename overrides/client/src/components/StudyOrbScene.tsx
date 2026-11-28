/// <reference path="../types/three.d.ts" />
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";

type StudyOrbSceneProps = { className?: string };

/**
 * Small procedural scene for visual depth, not a game environment.
 * Rendering pauses when the user prefers reduced motion or the page is hidden.
 */
export default function StudyOrbScene({ className = "" }: StudyOrbSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
    camera.position.set(0, 0, 5.4);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      host.dataset.sceneFallback = "true";
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.display = "block";

    scene.add(new THREE.AmbientLight(0xeaf2d6, 1.4));
    const keyLight = new THREE.PointLight(0xd1b77b, 19, 18);
    keyLight.position.set(3.1, 2.4, 4.2);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xd1b77b, 10, 14);
    rimLight.position.set(-3, -1.4, 2);
    scene.add(rimLight);

    const core = new THREE.Group();
    scene.add(core);
    const geometry = new THREE.IcosahedronGeometry(1.08, 4);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xd1b77b,
      metalness: 0.56,
      roughness: 0.24,
      clearcoat: 0.72,
      clearcoatRoughness: 0.18,
      transparent: true,
      opacity: 0.88,
    });
    const orb = new THREE.Mesh(geometry, material);
    core.add(orb);

    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.19, 1)),
      new THREE.LineBasicMaterial({ color: 0xe0cdaf, transparent: true, opacity: 0.24 }),
    );
    core.add(wire);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xd1b77b,
      transparent: true,
      opacity: 0.64,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.56, 0.009, 8, 160), ringMaterial);
    ring.rotation.set(0.84, 0.12, 0.42);
    core.add(ring);

    const particlesGeometry = new THREE.BufferGeometry();
    const particleCount = 90;
    const positions = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      const radius = 1.9 + Math.random() * 1.8;
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 3.6;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = height;
      positions[index * 3 + 2] = Math.sin(angle) * radius * 0.55;
    }
    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particlesGeometry,
      new THREE.PointsMaterial({ color: 0xe0cdaf, size: 0.014, transparent: true, opacity: 0.58 }),
    );
    scene.add(particles);

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const render = () => {
      if (document.visibilityState !== "hidden") renderer.render(scene, camera);
    };
    const rotate = reducedMotion ? null : gsap.to(core.rotation, {
      y: Math.PI * 2,
      x: Math.PI * 0.16,
      duration: 38,
      ease: "none",
      repeat: -1,
    });
    const orbit = reducedMotion ? null : gsap.to(ring.rotation, {
      z: Math.PI * 2,
      duration: 26,
      ease: "none",
      repeat: -1,
    });
    const breathe = reducedMotion ? null : gsap.to(orb.scale, {
      x: 1.035,
      y: 1.035,
      z: 1.035,
      duration: 4.6,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });
    const particleDrift = reducedMotion ? null : gsap.to(particles.rotation, {
      y: -Math.PI * 2,
      duration: 78,
      ease: "none",
      repeat: -1,
    });
    gsap.ticker.add(render);

    return () => {
      observer.disconnect();
      gsap.ticker.remove(render);
      rotate?.kill();
      orbit?.kill();
      breathe?.kill();
      particleDrift?.kill();
      geometry.dispose();
      material.dispose();
      wire.geometry.dispose();
      (wire.material as THREE.Material).dispose();
      ring.geometry.dispose();
      ringMaterial.dispose();
      particlesGeometry.dispose();
      (particles.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className={"sf-3d-scene " + className} aria-hidden="true" />;
}
