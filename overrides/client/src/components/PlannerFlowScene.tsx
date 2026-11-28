/// <reference path="../types/three.d.ts" />
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";

export default function PlannerFlowScene() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      host.dataset.sceneFallback = "true";
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
    camera.position.set(0, 0.25, 6.5);
    scene.add(new THREE.AmbientLight(0xeaf2d6, 1.2));
    const keyLight = new THREE.PointLight(0xc9ed62, 15, 16);
    keyLight.position.set(-2.6, 2.8, 4);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xd1b77b, 8, 12);
    rimLight.position.set(3, -1.8, 2);
    scene.add(rimLight);

    const pathway = new THREE.Group();
    scene.add(pathway);
    const points = [
      new THREE.Vector3(-1.78, -0.12, 0),
      new THREE.Vector3(0, 0.74, -0.36),
      new THREE.Vector3(1.78, -0.12, 0),
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const pathGeometry = new THREE.TubeGeometry(curve, 90, 0.012, 8, false);
    const pathMaterial = new THREE.MeshBasicMaterial({ color: 0xc9ed62, transparent: true, opacity: 0.58 });
    pathway.add(new THREE.Mesh(pathGeometry, pathMaterial));

    const nodeMaterials = [
      new THREE.MeshPhysicalMaterial({ color: 0xc9ed62, metalness: 0.64, roughness: 0.22, clearcoat: 0.8 }),
      new THREE.MeshPhysicalMaterial({ color: 0xd1b77b, metalness: 0.58, roughness: 0.25, clearcoat: 0.75 }),
      new THREE.MeshPhysicalMaterial({ color: 0xd8e6b4, metalness: 0.55, roughness: 0.28, clearcoat: 0.7 }),
    ];
    const nodeGroups: THREE.Group[] = [];
    points.forEach((point, index) => {
      const node = new THREE.Group();
      node.position.copy(point);
      pathway.add(node);
      const geometry = new THREE.IcosahedronGeometry(index === 1 ? 0.36 : 0.29, 2);
      const core = new THREE.Mesh(geometry, nodeMaterials[index]);
      node.add(core);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: index === 1 ? 0xd1b77b : 0xc9ed62,
        transparent: true,
        opacity: 0.52,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(index === 1 ? 0.55 : 0.45, 0.012, 8, 80), ringMaterial);
      ring.rotation.set(0.7 + index * 0.2, 0.2, 0.55);
      node.add(ring);
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(index === 1 ? 0.68 : 0.58, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xc9ed62, transparent: true, opacity: 0.035, wireframe: true }),
      );
      node.add(halo);
      nodeGroups.push(node);
    });

    const particlePositions = new Float32Array(72 * 3);
    for (let index = 0; index < 72; index += 1) {
      const point = curve.getPoint(index / 71);
      const spread = 0.45 + Math.random() * 0.65;
      particlePositions[index * 3] = point.x + (Math.random() - 0.5) * spread;
      particlePositions[index * 3 + 1] = point.y + (Math.random() - 0.5) * spread;
      particlePositions[index * 3 + 2] = (Math.random() - 0.5) * 1.6;
    }
    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particlesMaterial = new THREE.PointsMaterial({ color: 0xd8e6b4, size: 0.018, transparent: true, opacity: 0.5 });
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
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
    const rotations = reducedMotion ? [] : nodeGroups.map((node, index) => gsap.to(node.rotation, {
      y: Math.PI * 2,
      x: index === 1 ? 0.3 : -0.2,
      duration: 28 + index * 7,
      repeat: -1,
      ease: "none",
    }));
    const drift = reducedMotion ? null : gsap.to(pathway.rotation, {
      y: 0.045,
      duration: 6,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
    const particlesDrift = reducedMotion ? null : gsap.to(particles.rotation, {
      z: 0.08,
      duration: 9,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
    gsap.ticker.add(render);

    return () => {
      observer.disconnect();
      gsap.ticker.remove(render);
      rotations.forEach(animation => animation.kill());
      drift?.kill();
      particlesDrift?.kill();
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        materials.forEach(material => material.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="sf-planner-flow-scene" aria-hidden="true" />;
}
