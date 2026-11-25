import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  EscrowGlobeVisualizer3D,
  isWebGLAvailable,
  type GlobeEscrow,
  type GlobeRenderer,
} from './EscrowGlobeVisualizer3D';

const escrows: GlobeEscrow[] = [
  {
    id: 'escrow-usdc',
    client: { lat: 37.77, lon: -122.42, label: 'San Francisco' },
    contractor: { lat: 51.5, lon: -0.12, label: 'London' },
    asset: 'USDC',
  },
  {
    id: 'escrow-xlm',
    client: { lat: 35.68, lon: 139.69, label: 'Tokyo' },
    contractor: { lat: -23.55, lon: -46.63, label: 'Sao Paulo' },
    asset: 'XLM',
  },
  {
    id: 'escrow-completed',
    client: { lat: 40.71, lon: -74.0, label: 'New York' },
    contractor: { lat: 28.61, lon: 77.21, label: 'Delhi' },
    asset: 'completed',
  },
];

const fakeWebGLContext = { getExtension: () => null } as unknown as WebGLRenderingContext;

function stubWebGL(available: boolean) {
  return vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((type) =>
    available && type === 'webgl2' ? fakeWebGLContext : null
  ) as ReturnType<typeof vi.spyOn>;
}

function stubAnimationFrames() {
  let scheduled = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    scheduled += 1;
    if (scheduled === 1) queueMicrotask(() => callback(16));
    return scheduled;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
}

describe('EscrowGlobeVisualizer3D', () => {
  beforeEach(() => {
    stubAnimationFrames();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders a 2D fallback when WebGL is unsupported', () => {
    const getContext = stubWebGL(false);

    render(<EscrowGlobeVisualizer3D escrows={escrows} />);

    expect(screen.getByTestId('globe-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('globe-canvas')).not.toBeInTheDocument();
    expect(isWebGLAvailable()).toBe(false);
    expect(getContext).toHaveBeenCalledWith('webgl2');
  });

  it('color-codes fallback arcs by asset', () => {
    stubWebGL(false);
    const { container } = render(<EscrowGlobeVisualizer3D escrows={escrows} forceFallback />);

    expect(container.querySelector('path[stroke="#3b82f6"]')).not.toBeNull();
    expect(container.querySelector('path[stroke="#a855f7"]')).not.toBeNull();
    expect(container.querySelector('path[stroke="#10b981"]')).not.toBeNull();
  });

  it('honors forceFallback even when WebGL is available', () => {
    stubWebGL(true);

    render(<EscrowGlobeVisualizer3D escrows={escrows} forceFallback />);

    expect(screen.getByTestId('globe-fallback')).toBeInTheDocument();
  });

  it('creates a WebGL canvas and renders the scene when supported', async () => {
    const getContext = stubWebGL(true);
    const renderScene = vi.fn();
    const rendererFactory = (canvas: HTMLCanvasElement): GlobeRenderer => ({
      domElement: canvas,
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: renderScene,
      dispose: vi.fn(),
    });

    render(
      <EscrowGlobeVisualizer3D escrows={escrows} rendererFactory={rendererFactory} />
    );

    expect(await screen.findByTestId('globe-canvas')).toBeInTheDocument();
    expect(getContext).toHaveBeenCalledWith('webgl2');
    await waitFor(() => expect(renderScene).toHaveBeenCalled());
  });

  it('falls back on low-power devices even with WebGL support', async () => {
    stubWebGL(true);
    const originalCores = Object.getOwnPropertyDescriptor(navigator, 'hardwareConcurrency');
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 2 });

    try {
      render(<EscrowGlobeVisualizer3D escrows={escrows} />);
      expect(await screen.findByTestId('globe-fallback')).toBeInTheDocument();
    } finally {
      if (originalCores) Object.defineProperty(navigator, 'hardwareConcurrency', originalCores);
      else Reflect.deleteProperty(navigator, 'hardwareConcurrency');
    }
  });
});
