// @ts-nocheck
import * as THREE from "three";
import { useEffect, useRef, useState } from "react";

export default function HeroLearningScene() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer | null = null;
    let frame = 0;
    let disposed = false;
    let visible = true;
    let pageVisible = !document.hidden;
    const pointerTarget = new THREE.Vector2(0, 0);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
    camera.position.set(0, 0, 5.8);
    const stage = new THREE.Group();
    const core = new THREE.Group();
    stage.add(core);
    scene.add(stage);

    try {
      renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true, powerPreference:"low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.style.cssText = "display:block;width:100%;height:100%;pointer-events:auto;touch-action:pan-y;cursor:crosshair";
      renderer.domElement.setAttribute("aria-hidden","true");
      host.replaceChildren(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xf7eee5,1.45));
      const keyLight=new THREE.DirectionalLight(0xfff5eb,2.6);
      keyLight.position.set(-3.5,4.5,5); scene.add(keyLight);
      const rimLight=new THREE.PointLight(0xb99272,24,12);
      rimLight.position.set(3,-1.8,2.5); scene.add(rimLight);
      const lowLight=new THREE.PointLight(0xe5d6c8,10,10);
      lowLight.position.set(-2.5,-2.5,-2); scene.add(lowLight);

      const crystal=new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.02,5),
        new THREE.MeshPhysicalMaterial({
          color:0xb9a18b,metalness:.36,roughness:.24,clearcoat:.9,clearcoatRoughness:.16,opacity:.97
        })
      );
      core.add(crystal);
      core.add(new THREE.Mesh(
        new THREE.SphereGeometry(.73,48,36),
        new THREE.MeshPhysicalMaterial({
          color:0x4a382b,metalness:.48,roughness:.2,clearcoat:1,clearcoatRoughness:.12,
          emissive:0x21160f,emissiveIntensity:.25
        })
      ));
      const crystalWire = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.16, 2),
        new THREE.MeshBasicMaterial({ color:0xe7d9ca, wireframe:true, transparent:true, opacity:.16 })
      );
      core.add(crystalWire);
      const dustPositions = new Float32Array(72 * 3);
      for (let i = 0; i < 72; i++) {
        const angle = i * 2.399963;
        const radius = 1.9 + (i % 7) * .085;
        dustPositions[i * 3] = Math.cos(angle) * radius;
        dustPositions[i * 3 + 1] = Math.sin(angle * 1.31) * 1.35;
        dustPositions[i * 3 + 2] = Math.sin(angle) * .75;
      }
      const dustGeometry = new THREE.BufferGeometry();
      dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
      const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color:0xe8d9ca, size:.022, transparent:true, opacity:.56, sizeAttenuation:true }));
      stage.add(dust);

      const ringMaterials=[
        new THREE.MeshStandardMaterial({color:0xe1d2c4,metalness:.75,roughness:.24,transparent:true,opacity:.82}),
        new THREE.MeshStandardMaterial({color:0xa98769,metalness:.72,roughness:.2,transparent:true,opacity:.9}),
        new THREE.MeshStandardMaterial({color:0x807062,metalness:.58,roughness:.28,transparent:true,opacity:.62})
      ];
      const ringConfigs=[
        {radius:1.48,tube:.012,rotation:[.42,.12,-.54],speed:.13},
        {radius:1.66,tube:.008,rotation:[1.12,-.58,.28],speed:-.095},
        {radius:1.28,tube:.01,rotation:[1.48,.4,.92],speed:.075}
      ];
      const rings=ringConfigs.map((cfg,i)=>{
        const mesh=new THREE.Mesh(new THREE.TorusGeometry(cfg.radius,cfg.tube,12,180),ringMaterials[i]);
        mesh.rotation.set(...cfg.rotation); mesh.userData.speed=cfg.speed; stage.add(mesh); return mesh;
      });

      const satellites=new THREE.Group(); stage.add(satellites);
      const nodeGeometry=new THREE.SphereGeometry(.055,20,16);
      const nodeMaterial=new THREE.MeshStandardMaterial({color:0xe5d5c5,emissive:0x674b34,emissiveIntensity:.42,metalness:.55,roughness:.23});
      for(let i=0;i<12;i++){
        const angle=i/12*Math.PI*2, radius=i%2===0?1.51:1.72;
        const node=new THREE.Mesh(nodeGeometry,nodeMaterial);
        node.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius*.58,Math.sin(angle*1.7)*.38);
        satellites.add(node);
      }
      const halo=new THREE.Mesh(
        new THREE.TorusGeometry(2.03,.0035,6,180),
        new THREE.MeshBasicMaterial({color:0xe4d7ca,transparent:true,opacity:.24})
      );
      halo.rotation.set(1.1,.2,-.2); stage.add(halo);

      const resize=()=>{
        if(!renderer||disposed)return;
        const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
        renderer.setSize(width,height,false);
        camera.aspect=width/height;
        camera.position.z=width<420?6.6:5.8;
        camera.updateProjectionMatrix();
      };
      resize();
      const resizeObserver=new ResizeObserver(resize); resizeObserver.observe(host);
      const canvas = renderer.domElement;
      const onPointerMove = (event: PointerEvent) => {
        if (reducedMotion || event.pointerType === "touch") return;
        const rect = canvas.getBoundingClientRect();
        pointerTarget.set(
          ((event.clientX - rect.left) / Math.max(1, rect.width) - .5) * 2,
          -((event.clientY - rect.top) / Math.max(1, rect.height) - .5) * 2
        );
      };
      const onPointerLeave = () => pointerTarget.set(0, 0);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerleave", onPointerLeave);
      const render=(time:number)=>{
        frame=0;
        if(disposed||!renderer||!visible||!pageVisible)return;
        if(!reducedMotion){
          const seconds=time*.001;
          core.rotation.y += (Math.sin(seconds*.26)*.24 + pointerTarget.x*.19 - core.rotation.y)*.055;
          core.rotation.x += (Math.cos(seconds*.2)*.13 + pointerTarget.y*.16 - core.rotation.x)*.055;
          crystalWire.rotation.y += .0011;
          crystalWire.rotation.x -= .0007;
          dust.rotation.y += .00022;
          dust.rotation.x = Math.sin(seconds*.13)*.08;
          core.rotation.z=Math.sin(seconds*.16)*.06;
          core.position.y=Math.sin(seconds*.48)*.055;
          rings.forEach(ring=>{
            ring.rotation.z+=ring.userData.speed*.002;
            ring.rotation.x+=ring.userData.speed*.0007;
          });
          satellites.rotation.y-=.00065;
          satellites.rotation.z+=.0003;
          stage.rotation.y += (Math.sin(seconds*.12)*.1 + pointerTarget.x*.055 - stage.rotation.y)*.04;
        }
        renderer.render(scene,camera);
        if(!reducedMotion && visible && pageVisible && !disposed) frame=window.requestAnimationFrame(render);
      };
      const stopRender=()=>{
        if(frame){window.cancelAnimationFrame(frame);frame=0;}
      };
      const startRender=()=>{
        if(!disposed && visible && pageVisible && frame===0) frame=window.requestAnimationFrame(render);
      };
      const visibilityObserver=new IntersectionObserver(entries=>{
        visible=entries.some(e=>e.isIntersecting);
        if(visible) startRender(); else stopRender();
      },{threshold:.04});
      visibilityObserver.observe(host);
      const onVisibility=()=>{
        pageVisible=!document.hidden;
        if(pageVisible) startRender(); else stopRender();
      };
      document.addEventListener("visibilitychange",onVisibility);
      if(reducedMotion) renderer.render(scene,camera);
      else startRender();
      return ()=>{
        disposed=true; window.cancelAnimationFrame(frame);
        resizeObserver.disconnect(); visibilityObserver.disconnect();
        document.removeEventListener("visibilitychange",onVisibility);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        scene.traverse(object=>{
          if(object.geometry)object.geometry.dispose();
          if(object.material){
            const materials=Array.isArray(object.material)?object.material:[object.material];
            materials.forEach(material=>material.dispose());
          }
        });
        renderer?.dispose(); renderer?.forceContextLoss();
        if(renderer?.domElement.parentElement===host)host.removeChild(renderer.domElement);
      };
    }catch(error){
      console.warn("[StudyFlow] Hero WebGL scene unavailable; using CSS fallback.",error);
      renderer?.dispose(); setUnsupported(true);
      return ()=>{disposed=true;window.cancelAnimationFrame(frame);};
    }
  },[]);

  return (
    <div className="sf-hero-three-scene" ref={hostRef} aria-hidden="true">
      {unsupported&&<div className="sf-hero-three-fallback">
        <span className="sf-hero-fallback-ring sf-hero-fallback-ring-a"/>
        <span className="sf-hero-fallback-ring sf-hero-fallback-ring-b"/>
        <span className="sf-hero-fallback-core">S</span>
      </div>}
    </div>
  );
}
