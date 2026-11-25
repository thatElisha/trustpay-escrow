'use client';

import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type * as Three from 'three';

export type GlobeAsset = 'USDC' | 'XLM' | 'completed';

export interface GlobeCoordinate {
  lat: number;
  lon: number;
  label?: string;
}

export interface GlobeEscrow {
  id: string;
  client: GlobeCoordinate;
  contractor: GlobeCoordinate;
  asset: GlobeAsset;
  status?: string;
}

export interface GlobeRenderer {
  domElement: HTMLCanvasElement;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: Three.Scene, camera: Three.Camera): void;
  dispose(): void;
}

export type GlobeRendererFactory = (canvas: HTMLCanvasElement) => GlobeRenderer;

export const GLOBE_ARC_COLORS: Record<GlobeAsset, number> = {
  USDC: 0x3b82f6,
  XLM: 0xa855f7,
  completed: 0x10b981,
};

export const GLOBE_ASSET_LABELS: Record<GlobeAsset, string> = {
  USDC: 'USDC Lock',
  XLM: 'XLM Lock',
  completed: 'Completed Release',
};

export function latLonToVector3(lat: number, lon: number, radius: number, THREE: typeof Three): Three.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export function isWebGLAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    const context =
      probe.getContext('webgl2') ||
      probe.getContext('webgl') ||
      probe.getContext('experimental-webgl' as 'webgl');
    if (!context) return false;
    const loseContext = (context as WebGLRenderingContext).getExtension?.('WEBGL_lose_context');
    loseContext?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function isLowPowerDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const fewCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2;
  const lowMemory = typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === 'number' &&
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory! <= 2;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  return prefersReducedMotion || fewCores || lowMemory || saveData;
}

interface EscrowGlobeVisualizer3DProps {
  escrows?: GlobeEscrow[];
  autoRotate?: boolean;
  forceFallback?: boolean;
  rendererFactory?: GlobeRendererFactory;
  className?: string;
}

function projectLatLon(lat: number, lon: number): { x: number; y: number } {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180;
  return {
    x: 300 + 150 * Math.cos(phi) * Math.sin(lambda),
    y: 210 - 150 * Math.sin(phi),
  };
}

function FallbackGlobe({ escrows }: { escrows: GlobeEscrow[] }) {
  return (
    <div
      data-testid="globe-fallback"
      className="relative w-full h-full min-h-[320px] flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(30,64,175,0.18),transparent_65%)]"
    >
      <svg viewBox="0 0 600 420" className="w-full h-full max-h-[420px]" role="img" aria-label="2D map of active cross-border escrow flows">
        <defs>
          <radialGradient id="globe-fill" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#172554" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0.95" />
          </radialGradient>
          <filter id="globe-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx="300" cy="210" r="150" fill="url(#globe-fill)" stroke="#3b82f6" strokeOpacity="0.5" strokeWidth="1.5" />
        {[-60, -30, 0, 30, 60].map((lat) => {
          const y = 210 - 150 * Math.sin((lat * Math.PI) / 180);
          const rx = 150 * Math.cos((lat * Math.PI) / 180);
          return <ellipse key={lat} cx="300" cy={y} rx={rx} ry={rx * 0.16} fill="none" stroke="#1e40af" strokeOpacity="0.35" strokeWidth="1" />;
        })}
        {[-120, -60, 0, 60, 120].map((lon) => (
          <ellipse key={lon} cx="300" cy="210" rx={Math.abs(150 * Math.cos((lon * Math.PI) / 180))} ry="150" fill="none" stroke="#1e40af" strokeOpacity="0.28" strokeWidth="1" />
        ))}

        {escrows.map((escrow) => {
          const from = projectLatLon(escrow.client.lat, escrow.client.lon);
          const to = projectLatLon(escrow.contractor.lat, escrow.contractor.lon);
          const color = `#${GLOBE_ARC_COLORS[escrow.asset].toString(16).padStart(6, '0')}`;
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2 - Math.min(Math.hypot(to.x - from.x, to.y - from.y) * 0.32, 90);
          return (
            <g key={escrow.id} filter="url(#globe-glow)">
              <path
                d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
                fill="none"
                stroke={color}
                strokeOpacity="0.35"
                strokeWidth="2"
              />
              <path
                d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeDasharray="6 14"
                strokeLinecap="round"
              >
                <animate attributeName="stroke-dashoffset" from="40" to="0" dur="1.6s" repeatCount="indefinite" />
              </path>
              <circle cx={from.x} cy={from.y} r="3.5" fill={color} />
              <circle cx={to.x} cy={to.y} r="3.5" fill={color} />
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-[#71717a] font-medium">
        2D fallback mode &middot; WebGL unavailable or low-power device
      </div>
    </div>
  );
}

const noopSubscribe = () => () => {};

export function EscrowGlobeVisualizer3D({
  escrows = [],
  autoRotate = true,
  forceFallback = false,
  rendererFactory,
  className = '',
}: EscrowGlobeVisualizer3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderMode = useSyncExternalStore(
    noopSubscribe,
    () => (!forceFallback && isWebGLAvailable() && !isLowPowerDevice() ? 'webgl' : 'fallback'),
    () => 'fallback' as const
  );

  const escrowSignature = useMemo(() => escrows.map((e) => `${e.id}:${e.asset}:${e.client.lat},${e.client.lon}:${e.contractor.lat},${e.contractor.lon}`).join('|'), [escrows]);
  const escrowsRef = useRef(escrows);

  useEffect(() => {
    escrowsRef.current = escrows;
  }, [escrows, escrowSignature]);

  useEffect(() => {
    if (renderMode !== 'webgl') return;

    let disposed = false;
    let removeScene: (() => void) | undefined;

    const start = async () => {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (disposed || !canvas || !container) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0.55, 3.15);

      const getSize = () => {
        const rect = container.getBoundingClientRect();
        return {
          width: Math.max(rect.width || container.clientWidth || 640, 1),
          height: Math.max(rect.height || container.clientHeight || 420, 1),
        };
      };

      const renderer: GlobeRenderer = rendererFactory
        ? rendererFactory(canvas)
        : new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.75));
      const initialSize = getSize();
      renderer.setSize(initialSize.width, initialSize.height, false);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.enablePan = false;
      controls.minDistance = 1.8;
      controls.maxDistance = 5.5;
      controls.rotateSpeed = 0.55;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = 0.5;

      const globe = new THREE.Group();
      scene.add(globe);

      const globeCore = new THREE.Mesh(
        new THREE.SphereGeometry(0.985, 48, 32),
        new THREE.MeshBasicMaterial({ color: 0x071127, transparent: true, opacity: 0.86 })
      );
      globe.add(globeCore);

      const gridPoints: number[] = [];
      for (let lat = -60; lat <= 60; lat += 30) {
        const radius = 0.998 * Math.cos((lat * Math.PI) / 180);
        const y = 0.998 * Math.sin((lat * Math.PI) / 180);
        for (let step = 0; step < 128; step++) {
          const a = (step / 128) * Math.PI * 2;
          const b = ((step + 1) / 128) * Math.PI * 2;
          gridPoints.push(radius * Math.cos(a), y, radius * Math.sin(a), radius * Math.cos(b), y, radius * Math.sin(b));
        }
      }
      for (let lon = 0; lon < 180; lon += 30) {
        const angle = (lon * Math.PI) / 180;
        for (let step = 0; step < 64; step++) {
          const a = -Math.PI / 2 + (step / 64) * Math.PI;
          const b = -Math.PI / 2 + ((step + 1) / 64) * Math.PI;
          gridPoints.push(
            Math.cos(a) * Math.cos(angle), Math.sin(a), Math.cos(a) * Math.sin(angle),
            Math.cos(b) * Math.cos(angle), Math.sin(b), Math.cos(b) * Math.sin(angle)
          );
        }
      }
      const gridGeometry = new THREE.BufferGeometry();
      gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPoints, 3));
      globe.add(new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: 0x1d4ed8, transparent: true, opacity: 0.28 })));

      const globePointPositions: number[] = [];
      const pointCount = 1800;
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < pointCount; i++) {
        const y = 1 - (i / (pointCount - 1)) * 2;
        const radius = Math.sqrt(1 - y * y);
        const theta = goldenAngle * i;
        globePointPositions.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
      }
      const globePointGeometry = new THREE.BufferGeometry();
      globePointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(globePointPositions, 3));
      globe.add(new THREE.Points(globePointGeometry, new THREE.PointsMaterial({
        color: 0x60a5fa,
        size: 0.013,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })));

      const starPositions: number[] = [];
      for (let i = 0; i < 500; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 3.5 + Math.random() * 2.5;
        starPositions.push(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
      }
      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
      scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({
        color: 0xc7d2fe,
        size: 0.02,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      })));

      const safeEscrows = Array.isArray(escrowsRef.current) ? escrowsRef.current : [];
      const particlesPerArc = 7;
      const particleTotal = safeEscrows.length * particlesPerArc;
      const particlePositions = new Float32Array(Math.max(particleTotal, 1) * 3);
      const particleColors = new Float32Array(Math.max(particleTotal, 1) * 3);
      const curves: Three.QuadraticBezierCurve3[] = [];
      const endpointPositions: number[] = [];
      const endpointColors: number[] = [];

      safeEscrows.forEach((escrow, index) => {
        const color = new THREE.Color(GLOBE_ARC_COLORS[escrow.asset] ?? GLOBE_ARC_COLORS.USDC);
        const startPoint = latLonToVector3(escrow.client.lat, escrow.client.lon, 1.012, THREE);
        const endPoint = latLonToVector3(escrow.contractor.lat, escrow.contractor.lon, 1.012, THREE);
        const separation = startPoint.angleTo(endPoint);
        const controlPoint = startPoint.clone().add(endPoint).normalize().multiplyScalar(1 + Math.min(separation * 0.33, 0.65));
        const curve = new THREE.QuadraticBezierCurve3(startPoint, controlPoint, endPoint);
        curves.push(curve);

        const arcGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
        globe.add(new THREE.Line(arcGeometry, new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.42,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })));

        for (let p = 0; p < particlesPerArc; p++) {
          const offset = index * particlesPerArc + p;
          particleColors[offset * 3] = color.r;
          particleColors[offset * 3 + 1] = color.g;
          particleColors[offset * 3 + 2] = color.b;
        }
        [startPoint, endPoint].forEach((point) => {
          endpointPositions.push(point.x, point.y, point.z);
          endpointColors.push(color.r, color.g, color.b);
        });
      });

      const particleGeometry = new THREE.BufferGeometry();
      const positionAttribute = new THREE.BufferAttribute(particlePositions, 3);
      positionAttribute.setUsage(THREE.DynamicDrawUsage);
      particleGeometry.setAttribute('position', positionAttribute);
      particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
      if (particleTotal > 0) {
        globe.add(new THREE.Points(particleGeometry, new THREE.PointsMaterial({
          size: 0.042,
          vertexColors: true,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })));
      }

      if (endpointPositions.length > 0) {
        const endpointGeometry = new THREE.BufferGeometry();
        endpointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(endpointPositions, 3));
        endpointGeometry.setAttribute('color', new THREE.Float32BufferAttribute(endpointColors, 3));
        globe.add(new THREE.Points(endpointGeometry, new THREE.PointsMaterial({
          size: 0.035,
          vertexColors: true,
          sizeAttenuation: true,
          transparent: true,
          opacity: 1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })));
      }

      const resize = () => {
        const { width, height } = getSize();
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
      resizeObserver?.observe(container);
      window.addEventListener('resize', resize);
      resize();

      const scratchPoint = new THREE.Vector3();
      let frameId = 0;
      let previousTime = 0;
      const animate = (now: number) => {
        frameId = requestAnimationFrame(animate);
        const delta = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 0;
        previousTime = now;
        controls.update(delta);

        const elapsed = now / 1000;
        curves.forEach((curve, arcIndex) => {
          for (let p = 0; p < particlesPerArc; p++) {
            const t = (elapsed * 0.22 + p / particlesPerArc + arcIndex * 0.07) % 1;
            curve.getPoint(t, scratchPoint);
            const offset = (arcIndex * particlesPerArc + p) * 3;
            particlePositions[offset] = scratchPoint.x;
            particlePositions[offset + 1] = scratchPoint.y;
            particlePositions[offset + 2] = scratchPoint.z;
          }
        });
        if (particleTotal > 0) positionAttribute.needsUpdate = true;
        renderer.render(scene, camera);
      };
      frameId = requestAnimationFrame(animate);

      removeScene = () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', resize);
        resizeObserver?.disconnect();
        controls.dispose();
        scene.traverse((object) => {
          const renderable = object as Three.Mesh;
          renderable.geometry?.dispose();
          const material = renderable.material as Three.Material | Three.Material[] | undefined;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material?.dispose();
        });
        renderer.dispose();
      };
    };

    void start();

    return () => {
      disposed = true;
      removeScene?.();
    };
  }, [renderMode, escrowSignature, autoRotate, rendererFactory]);

  return (
    <div
      ref={containerRef}
      data-testid="escrow-globe"
      className={`relative w-full h-[320px] sm:h-[420px] rounded-3xl border border-[#27272a] bg-[#0b0b10]/70 overflow-hidden ${className}`}
    >
      {renderMode === 'webgl' ? (
        <canvas
          ref={canvasRef}
          data-testid="globe-canvas"
          aria-label="Interactive 3D globe showing live cross-border escrow flows"
          className="w-full h-full cursor-grab active:cursor-grabbing outline-none"
        />
      ) : (
        <FallbackGlobe escrows={escrows} />
      )}

      <div className="pointer-events-none absolute top-4 left-4 flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa]">
          {renderMode === 'webgl' ? 'Live Settlement Globe' : 'Settlement Map'}
        </span>
        <span className="text-xs font-semibold text-white">
          {escrows.length} active cross-border flow{escrows.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[10px] text-[#a1a1aa]">
        {(Object.keys(GLOBE_ARC_COLORS) as GlobeAsset[]).map((asset) => (
          <span key={asset} className="inline-flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: `#${GLOBE_ARC_COLORS[asset].toString(16).padStart(6, '0')}` }}
            />
            {GLOBE_ASSET_LABELS[asset]}
          </span>
        ))}
      </div>
    </div>
  );
}

export default EscrowGlobeVisualizer3D;
