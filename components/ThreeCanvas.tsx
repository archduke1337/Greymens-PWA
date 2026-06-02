"use client";
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export default function ThreeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current as HTMLCanvasElement;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    camera.position.z = 5;

    const resize = () => {
      const width = canvas.clientWidth || 500;
      const height = canvas.clientHeight || 500;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    window.addEventListener('resize', resize);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(5, 5, 7);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xa855f7, 0.3);
    fillLight.position.set(-3, 0, -5);
    scene.add(fillLight);

    let model: THREE.Object3D | null = null;

    const loader = new GLTFLoader();
    loader.load(
      '/model.glb',
      (gltf) => {
        model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model as THREE.Object3D);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = maxDim > 0 ? 3 / maxDim : 1;

        model!.scale.setScalar(scale);
        model!.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

        scene.add(model!);
      },
      undefined,
      (error) => {
        console.error('Error loading model:', error);
      }
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1;

    let reqId = 0;
    const animate = () => {
      reqId = requestAnimationFrame(animate);

      const time = Date.now() * 0.001;

      if (model) {
        model.position.y = Math.sin(time * 0.8) * 0.1;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(reqId);
      controls.dispose();

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => {
              if (typeof m.dispose === 'function') m.dispose();
            });
          } else if (mat && typeof m.dispose === 'function') {
            mat.dispose();
          }
        }
      });

      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full max-w-[500px] h-[500px]"
    />
  );
}
