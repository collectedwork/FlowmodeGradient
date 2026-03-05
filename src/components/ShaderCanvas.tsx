import { useRef, useEffect, useCallback } from 'react';
import { createProgram, createFullscreenTriangleVAO } from '../gl/setup';
import { vertexShaderSource, fragmentShaderSource } from '../gl/shaders';
import { getUniformLocations, setUniforms } from '../gl/uniforms';
import {
  createLerpState,
  startTransition,
  updateLerp,
  easeInOut,
  type LerpState,
} from '../palettes';

export interface ShaderCanvasProps {
  paletteKey: string;
  noiseScaleX: number;
  noiseScaleY: number;
  scrollSpeed: number;
  evolveSpeed: number;
  lerpDuration: number;
  lerpEasing: number;
}

export default function ShaderCanvas({
  paletteKey,
  noiseScaleX,
  noiseScaleY,
  scrollSpeed,
  evolveSpeed,
  lerpDuration,
  lerpEasing,
}: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mutable refs so the rAF loop always reads the latest props without re-init
  const propsRef = useRef({ noiseScaleX, noiseScaleY, scrollSpeed, evolveSpeed, lerpDuration, lerpEasing });
  propsRef.current = { noiseScaleX, noiseScaleY, scrollSpeed, evolveSpeed, lerpDuration, lerpEasing };

  // Lerp state lives outside React state to avoid re-renders each frame
  const lerpRef = useRef<LerpState | null>(null);

  // Track the previous palette key to detect changes
  const prevKeyRef = useRef(paletteKey);

  // Handle palette change
  useEffect(() => {
    if (!lerpRef.current) return;
    if (paletteKey !== prevKeyRef.current) {
      startTransition(lerpRef.current, paletteKey);
      prevKeyRef.current = paletteKey;
    }
  }, [paletteKey]);

  // ---- WebGL lifecycle ----
  const initAndRun = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      console.error('WebGL 2 not supported');
      return;
    }

    // Compile & link
    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    const vao = createFullscreenTriangleVAO(gl);
    const locs = getUniformLocations(gl, program);

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    // Init lerp state
    lerpRef.current = createLerpState(prevKeyRef.current);

    // ---- Render state ----
    let prevTime = performance.now() / 1000;
    let elapsed = 0;
    let rafId = 0;

    // ---- Shared render function ----
    function render() {
      const props = propsRef.current;
      const lerp = lerpRef.current!;

      gl!.viewport(0, 0, canvas!.width, canvas!.height);

      const aspect = canvas!.width / canvas!.height;

      const easedBlend = lerp.transitioning
        ? easeInOut(lerp.blend, props.lerpEasing)
        : lerp.blend;

      setUniforms(gl!, locs, {
        time: elapsed,
        aspect,
        noiseScaleX: props.noiseScaleX,
        noiseScaleY: props.noiseScaleY,
        scrollSpeed: props.scrollSpeed,
        evolveSpeed: props.evolveSpeed,
        paletteA: lerp.from.colors,
        positionsA: lerp.from.positions,
        stopCountA: lerp.from.stopCount,
        paletteB: lerp.to.colors,
        positionsB: lerp.to.positions,
        stopCountB: lerp.to.stopCount,
        blend: easedBlend,
      });

      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }

    // ---- Resize handling ----
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const displayW = canvas!.clientWidth;
      const displayH = canvas!.clientHeight;
      const w = Math.round(displayW * dpr);
      const h = Math.round(displayH * dpr);
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
      }
      // Re-draw immediately so the buffer is never shown cleared/black
      if (lerpRef.current) render();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    // ---- Render loop ----
    function frame(nowMs: number) {
      rafId = requestAnimationFrame(frame);

      const now = nowMs / 1000;
      const dt = Math.min(now - prevTime, 0.1); // clamp large jumps
      prevTime = now;
      elapsed += dt;

      // Advance palette lerp
      updateLerp(lerpRef.current!, dt, propsRef.current.lerpDuration);

      render();
    }

    rafId = requestAnimationFrame(frame);

    // ---- Cleanup ----
    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      gl.deleteProgram(program);
      gl.deleteVertexArray(vao);
    };
  }, []); // Run once on mount

  useEffect(() => {
    const cleanup = initAndRun();
    return cleanup;
  }, [initAndRun]);

  return <canvas ref={canvasRef} />;
}
