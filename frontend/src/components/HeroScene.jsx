import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles, MeshDistortMaterial, Torus } from '@react-three/drei';

// Tracks pointer position independently of the canvas element's own pointer
// events, so the canvas can stay `pointer-events: none` (letting clicks pass
// through to the hero buttons/nav underneath) while still reacting to mouse
// movement anywhere on the page for the parallax tilt effect.
const usePointer = () => {
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (event) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', handleMove);
    return () => window.removeEventListener('pointermove', handleMove);
  }, []);

  return pointer;
};

const RotatingCore = () => {
  const meshRef = useRef();

  useFrame((_, delta) => {
    meshRef.current.rotation.x += delta * 0.1;
    meshRef.current.rotation.y += delta * 0.16;
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1.35, 1]} />
      <MeshDistortMaterial
        color="#60a5fa"
        emissive="#1d4ed8"
        emissiveIntensity={0.5}
        roughness={0.2}
        metalness={0.55}
        distort={0.32}
        speed={1.6}
        wireframe
      />
    </mesh>
  );
};

const OrbitNode = ({ radius, speed, offset, color, size }) => {
  const ref = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + offset;
    ref.current.position.set(
      Math.cos(t) * radius,
      Math.sin(t * 0.6) * (radius * 0.35),
      Math.sin(t) * radius
    );
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[size, 20, 20]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
    </mesh>
  );
};

const ParallaxRig = ({ pointer }) => {
  useFrame(({ camera }) => {
    camera.position.x += (pointer.current.x * 1.1 - camera.position.x) * 0.03;
    camera.position.y += (-pointer.current.y * 0.7 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);
  });
  return null;
};

const HeroScene = () => {
  const pointer = usePointer();

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 6], fov: 45 }}
    >
      <ambientLight intensity={0.55} />
      <pointLight position={[5, 5, 5]} intensity={1.3} color="#60a5fa" />
      <pointLight position={[-5, -3, -4]} intensity={0.9} color="#a78bfa" />

      <Suspense fallback={null}>
        <Float speed={1.3} rotationIntensity={0.55} floatIntensity={1.1}>
          <RotatingCore />
        </Float>

        <OrbitNode radius={2.6} speed={0.5} offset={0} color="#60a5fa" size={0.15} />
        <OrbitNode radius={3.05} speed={-0.35} offset={2.1} color="#a78bfa" size={0.12} />
        <OrbitNode radius={2.2} speed={0.62} offset={4.2} color="#22c55e" size={0.1} />
        <OrbitNode radius={3.35} speed={-0.24} offset={1.4} color="#f472b6" size={0.13} />

        <Torus args={[2.05, 0.008, 16, 100]} rotation={[Math.PI / 2.4, 0, 0]}>
          <meshBasicMaterial color="#818cf8" transparent opacity={0.32} />
        </Torus>

        <Sparkles count={80} scale={[8, 5, 8]} size={2.2} speed={0.3} color="#93c5fd" opacity={0.55} />
      </Suspense>

      <ParallaxRig pointer={pointer} />
    </Canvas>
  );
};

export default HeroScene;
