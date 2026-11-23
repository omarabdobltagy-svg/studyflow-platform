// @ts-nocheck
import * as THREE from "three";
import { useEffect, useRef, useState } from "react";

export type SceneNode = {
  nodeId: string;
  title: string;
  state: "completed" | "gap" | "next" | "future" | "unmapped";
};

export type SceneBranch = {
  branchId: string;
  title: string;
  nodes: SceneNode[];
};

type Props = {
  branches: SceneBranch[];
  onSelectBranch: (branchId: string) => void;
};

const COLORS = {
  completed: 0x6f4e37,
  gap: 0xb99272,
  next: 0x2b211c,
  future: 0xd0cac3,
  unmapped: 0xa89c91,
};

export default function CurriculumProgressScene({ branches, onSelectBranch }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [hovered, setHovered] = useState<SceneNode | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !branches.length) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let raf = 0;
    let disposed = false;
    let visible = true;
    let dragging = false;
    let dragged = false;
    let lastX = 0;
    let lastY = 0;
    let rotationY = 0.12;
    let rotationX = -0.08;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
    camera.position.set(0, 0, 9.5);
    const root = new THREE.Group();
    scene.add(root);

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab";
      renderer.domElement.setAttribute("aria-hidden", "true");
      host.replaceChildren(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 1.45));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(-2.5, 4, 5);
      scene.add(key);
      const fill = new THREE.PointLight(0xb99272, 18, 16);
      fill.position.set(3, -1.5, 4);
      scene.add(fill);

      const nodeGeometry = new THREE.SphereGeometry(0.085, 20, 16);
      const nodeMaterials = Object.fromEntries(Object.entries(COLORS).map(([state, color]) => [
        state,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.33,
          metalness: state === "next" ? 0.22 : 0.08,
          emissive: state === "next" ? color : 0x000000,
          emissiveIntensity: state === "next" ? 0.08 : 0,
        }),
      ]));
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xbaa99a, transparent: true, opacity: 0.58 });
      const branchMeshes = [];
      const allNodeMeshes = [];
      const maxNodes = Math.max(1, ...branches.map(branch => branch.nodes.length));
      const xSpacing = Math.min(0.46, 5.6 / Math.max(12, maxNodes));
      const trackWidth = (maxNodes - 1) * xSpacing;
      const ySpacing = branches.length > 4 ? 0.56 : 0.78;

      branches.forEach((branch, branchIndex) => {
        const y = (branchIndex - (branches.length - 1) / 2) * ySpacing;
        const points = branch.nodes.map((node, index) => new THREE.Vector3(
          index * xSpacing - trackWidth / 2,
          y + Math.sin(index * 0.42 + branchIndex) * 0.06,
          Math.cos(index * 0.36 + branchIndex) * 0.13
        ));
        if (points.length > 1) {
          const curve = new THREE.CatmullRomCurve3(points);
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(Math.max(16, points.length * 3))), lineMaterial);
          root.add(line);
        }
        const branchMesh = { branchId: branch.branchId, nodes: [] };
        branch.nodes.forEach((node, nodeIndex) => {
          const mesh = new THREE.Mesh(nodeGeometry, nodeMaterials[node.state] || nodeMaterials.future);
          mesh.position.copy(points[nodeIndex] || new THREE.Vector3(0, y, 0));
          const scale = node.state === "next" ? 1.55 : node.state === "gap" ? 1.18 : 1;
          mesh.scale.setScalar(scale);
          mesh.userData.node = node;
          mesh.userData.branchId = branch.branchId;
          root.add(mesh);
          branchMesh.nodes.push(mesh);
          allNodeMeshes.push(mesh);

          if (node.state === "next") {
            const halo = new THREE.Mesh(
              new THREE.TorusGeometry(0.15, 0.009, 8, 40),
              new THREE.MeshBasicMaterial({ color: 0x75533c, transparent: true, opacity: 0.64 })
            );
            halo.position.copy(mesh.position);
            root.add(halo);
          }
        });
        branchMeshes.push(branchMesh);
      });

      const resize = () => {
        if (!renderer || disposed) return;
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        const depth = Math.max(8.5, maxNodes * xSpacing * 1.25);
        camera.position.z = width < 500 ? depth + 1 : depth;
        camera.updateProjectionMatrix();
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const pickNode = (event: PointerEvent) => {
        if (!renderer) return null;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(allNodeMeshes, false)[0];
        return hit?.object?.userData?.node ? hit.object : null;
      };

      const onPointerDown = (event: PointerEvent) => {
        dragging = true;
        dragged = false;
        lastX = event.clientX;
        lastY = event.clientY;
        renderer?.domElement.setPointerCapture?.(event.pointerId);
        if (renderer) renderer.domElement.style.cursor = "grabbing";
      };
      const onPointerMove = (event: PointerEvent) => {
        if (dragging) {
          const dx = event.clientX - lastX;
          const dy = event.clientY - lastY;
          if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
          rotationY += dx * 0.004;
          rotationX = Math.max(-0.42, Math.min(0.42, rotationX + dy * 0.003));
          lastX = event.clientX;
          lastY = event.clientY;
        }
        const hit = pickNode(event);
        const node = hit?.userData?.node ?? null;
        setHovered(node);
        if (renderer) renderer.domElement.style.cursor = dragging ? "grabbing" : hit ? "pointer" : "grab";
      };
      const onPointerUp = (event: PointerEvent) => {
        if (!dragged) {
          const hit = pickNode(event);
          if (hit?.userData?.branchId) onSelectBranch(hit.userData.branchId);
        }
        dragging = false;
        renderer?.domElement.releasePointerCapture?.(event.pointerId);
        if (renderer) renderer.domElement.style.cursor = "grab";
      };
      const onPointerLeave = () => {
        dragging = false;
        setHovered(null);
      };
      const canvas = renderer.domElement;
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointerleave", onPointerLeave);

      const observer = new IntersectionObserver(entries => {
        visible = entries.some(entry => entry.isIntersecting);
      }, { threshold: 0.05 });
      observer.observe(host);

      const render = (time: number) => {
        if (disposed || !renderer) return;
        if (visible && !document.hidden) {
          if (!reduceMotion) {
            root.rotation.y += ((rotationY + Math.sin(time * 0.00018) * 0.025) - root.rotation.y) * 0.04;
            root.rotation.x += (rotationX - root.rotation.x) * 0.04;
            branchMeshes.forEach((branch, branchIndex) => {
              branch.nodes.forEach(mesh => {
                const node = mesh.userData.node as SceneNode;
                if (node.state === "next") {
                  const pulse = 1.5 + Math.sin(time * 0.003 + branchIndex) * 0.08;
                  mesh.scale.setScalar(pulse);
                }
              });
            });
          }
          renderer.render(scene, camera);
        }
        if (!reduceMotion) raf = window.requestAnimationFrame(render);
      };
      render(0);

      const onVisibility = () => { visible = !document.hidden; };
      document.addEventListener("visibilitychange", onVisibility);

      return () => {
        disposed = true;
        window.cancelAnimationFrame(raf);
        resizeObserver.disconnect();
        observer.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        scene.traverse(object => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
            object.geometry?.dispose?.();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach(material => material?.dispose?.());
          }
        });
        Object.values(nodeMaterials).forEach(material => material.dispose());
        lineMaterial.dispose();
        nodeGeometry.dispose();
        renderer?.dispose();
        canvas.remove();
      };
    } catch (error) {
      console.error("[Curriculum map 3D] WebGL unavailable; using the accessible branch list.", error);
      setUnsupported(true);
      renderer?.dispose();
      host.replaceChildren();
    }
  }, [branches, onSelectBranch]);

  return (
    <div className="sf-curriculum-scene-wrap">
      <div ref={hostRef} className="sf-curriculum-scene" aria-label="مجسم ثلاثي الأبعاد لمسارات المنهج، يمكن سحبه واختيار عقدة منه." />
      <div className="sf-curriculum-scene-focus" aria-live="polite">
        {hovered ? <><b>{hovered.title}</b><span>{hovered.state === "completed" ? "تم تسجيل إتمامها" : hovered.state === "gap" ? "ضمن الفجوة المرجعية" : hovered.state === "next" ? "الخطوة التالية حسب تقدمك" : hovered.state === "unmapped" ? "موضع الطالب غير محدد" : "نقطة لاحقة في المنهج"}</span></>
          : <span>{unsupported ? "عرض المسارات متاح في القائمة أسفل الصفحة." : "اسحب المجسم لتدويره، أو انقر على نقطة لاختيار فرعها."}</span>}
      </div>
    </div>
  );
}
