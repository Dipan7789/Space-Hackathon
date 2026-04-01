import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface SpaceObject {
  id: string;
  type: "satellite" | "debris";
  pos: { x: number; y: number; z: number };
}

interface Props {
  objects: SpaceObject[];
}

export const OrbitalView: React.FC<Props> = ({ objects }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    satGroup: THREE.Group;
    debGroup: THREE.Group;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 100000000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    camera.position.z = 20000000;

    // Earth
    const earthGeo = new THREE.SphereGeometry(6378137, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      color: 0x2233ff,
      emissive: 0x112244,
      shininess: 5,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    const satGroup = new THREE.Group();
    const debGroup = new THREE.Group();
    scene.add(satGroup);
    scene.add(debGroup);

    sceneRef.current = { scene, camera, renderer, controls, satGroup, debGroup };

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !sceneRef.current) return;
      const { camera, renderer } = sceneRef.current;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    const { satGroup, debGroup } = sceneRef.current;

    // Clear groups
    while(satGroup.children.length > 0) satGroup.remove(satGroup.children[0]);
    while(debGroup.children.length > 0) debGroup.remove(debGroup.children[0]);

    const satGeo = new THREE.BoxGeometry(100000, 100000, 100000);
    const satMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    
    const debGeo = new THREE.SphereGeometry(50000, 8, 8);
    const debMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });

    objects.forEach(obj => {
      if (!obj.pos) return;
      const mesh = new THREE.Mesh(obj.type === 'satellite' ? satGeo : debGeo, obj.type === 'satellite' ? satMat : debMat);
      mesh.position.set(obj.pos.x, obj.pos.y, obj.pos.z);
      if (obj.type === 'satellite') satGroup.add(mesh);
      else debGroup.add(mesh);
    });
  }, [objects]);

  return <div ref={containerRef} className="w-full h-full bg-slate-950 rounded-xl overflow-hidden shadow-2xl border border-slate-800" />;
};
