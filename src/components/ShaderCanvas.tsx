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
  cursorMode: number;
  cursorRadius: number;
  cursorStrength: number;
  cursorFalloffWidth: number;
  cursorNoiseScale: number;
  cursorNoiseSpeed: number;
  cursorOctaves: number;
  cursorLacunarity: number;
  cursorDrag: number;
  cursorTrailDecay: number;
}

export default function ShaderCanvas({
  paletteKey,
  noiseScaleX,
  noiseScaleY,
  scrollSpeed,
  evolveSpeed,
  lerpDuration,
  lerpEasing,
  cursorMode,
  cursorRadius,
  cursorStrength,
  cursorFalloffWidth,
  cursorNoiseScale,
  cursorNoiseSpeed,
  cursorOctaves,
  cursorLacunarity,
  cursorDrag,
  cursorTrailDecay,
}: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mutable refs so the rAF loop always reads the latest props without re-init
  const propsRef = useRef({ noiseScaleX, noiseScaleY, scrollSpeed, evolveSpeed, lerpDuration, lerpEasing, cursorMode, cursorRadius, cursorStrength, cursorFalloffWidth, cursorNoiseScale, cursorNoiseSpeed, cursorOctaves, cursorLacunarity, cursorDrag, cursorTrailDecay });
  propsRef.current = { noiseScaleX, noiseScaleY, scrollSpeed, evolveSpeed, lerpDuration, lerpEasing, cursorMode, cursorRadius, cursorStrength, cursorFalloffWidth, cursorNoiseScale, cursorNoiseSpeed, cursorOctaves, cursorLacunarity, cursorDrag, cursorTrailDecay };

  // Cursor position in normalized UV space [0,1] — updated by mousemove
  const cursorRef = useRef<[number, number]>([0.5, 0.5]);
  // Raw (instant) mouse position, smoothed cursor lerps toward this
  const cursorTargetRef = useRef<[number, number]>([0.5, 0.5]);
  // Whether the cursor is currently over the canvas
  const cursorActiveRef = useRef(false);
  // Smoothed cursor strength multiplier (0 when off-canvas, 1 when on)
  const cursorFadeRef = useRef(0);
  // Smoothed cursor velocity in UV space (for velocity-offset mode)
  const cursorVelocityRef = useRef<[number, number]>([0, 0]);
  // Previous smoothed cursor position (for computing velocity)
  const cursorPrevRef = useRef<[number, number]>([0.5, 0.5]);

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

    // ---- Ghost trail buffer ----
    const GHOST_COUNT = 10;
    const ghostPos = new Float32Array(GHOST_COUNT * 2);
    const ghostStrength = new Float32Array(GHOST_COUNT);
    for (let i = 0; i < GHOST_COUNT; i++) {
      ghostPos[i * 2] = 0.5;
      ghostPos[i * 2 + 1] = 0.5;
    }

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
        cursor: cursorRef.current,
        cursorMode: props.cursorMode,
        cursorRadius: props.cursorRadius,
        cursorStrength: props.cursorStrength * cursorFadeRef.current,
        cursorFalloffWidth: props.cursorFalloffWidth,
        cursorVelocity: cursorVelocityRef.current,
        cursorNoiseScale: props.cursorNoiseScale,
        cursorNoiseSpeed: props.cursorNoiseSpeed,
        cursorOctaves: props.cursorOctaves,
        cursorLacunarity: props.cursorLacunarity,
        ghostPositions: ghostPos,
        ghostStrengths: ghostStrength,
        ghostCount: GHOST_COUNT,
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

    // ---- Mouse tracking ----
    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height; // flip Y to match UV
      cursorTargetRef.current = [x, y];
    }
    function onMouseEnter(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;
      // Snap both smoothed and target position so there's no lerp from center
      cursorRef.current = [x, y];
      cursorTargetRef.current = [x, y];
      cursorActiveRef.current = true;
    }
    function onMouseLeave() {
      cursorActiveRef.current = false;
    }
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseenter', onMouseEnter);
    canvas.addEventListener('mouseleave', onMouseLeave);

    // ---- Render loop ----
    function frame(nowMs: number) {
      rafId = requestAnimationFrame(frame);

      const now = nowMs / 1000;
      const dt = Math.min(now - prevTime, 0.1); // clamp large jumps
      prevTime = now;
      elapsed += dt;

      // Advance palette lerp
      updateLerp(lerpRef.current!, dt, propsRef.current.lerpDuration);

      // Smooth cursor toward target (drag)
      const drag = propsRef.current.cursorDrag;
      const smoothing = 1.0 - Math.pow(drag, dt * 60.0); // frame-rate independent
      const [tx, ty] = cursorTargetRef.current;
      const [cx, cy] = cursorRef.current;
      cursorRef.current = [
        cx + (tx - cx) * smoothing,
        cy + (ty - cy) * smoothing,
      ];

      // Smooth fade cursor strength in/out
      const fadeTarget = cursorActiveRef.current ? 1.0 : 0.0;
      const fadeSmooting = 1.0 - Math.pow(0.05, dt); // ~fast fade
      cursorFadeRef.current += (fadeTarget - cursorFadeRef.current) * fadeSmooting;

      // Compute cursor velocity from smoothed position delta
      const [pcx, pcy] = cursorPrevRef.current;
      const [scx, scy] = cursorRef.current;
      if (dt > 0.0001) {
        const rawVx = (scx - pcx) / dt;
        const rawVy = (scy - pcy) / dt;
        // Smooth velocity (exponential)
        const velSmooth = 1.0 - Math.pow(0.001, dt);
        const [vx, vy] = cursorVelocityRef.current;
        cursorVelocityRef.current = [
          vx + (rawVx - vx) * velSmooth,
          vy + (rawVy - vy) * velSmooth,
        ];
      }
      cursorPrevRef.current = [scx, scy];

      // ---- Update ghost trail buffer ----
      {
        const trailDecay = propsRef.current.cursorTrailDecay;

        // Decay all ghost strengths
        for (let i = 0; i < GHOST_COUNT; i++) {
          ghostStrength[i] *= Math.pow(trailDecay, dt * 60.0);
          if (ghostStrength[i] < 0.001) ghostStrength[i] = 0;
        }

        // Push new ghost only if cursor moved enough (avoid bunching)
        const [sx, sy] = cursorRef.current;
        const gdx = sx - ghostPos[0];
        const gdy = sy - ghostPos[1];
        if (gdx * gdx + gdy * gdy > 0.000009) { // > 0.003 distance
          for (let i = GHOST_COUNT - 1; i > 0; i--) {
            ghostPos[i * 2] = ghostPos[(i - 1) * 2];
            ghostPos[i * 2 + 1] = ghostPos[(i - 1) * 2 + 1];
            ghostStrength[i] = ghostStrength[i - 1];
          }
          ghostPos[0] = sx;
          ghostPos[1] = sy;
          ghostStrength[0] = 1.0;
        }
      }

      render();
    }

    rafId = requestAnimationFrame(frame);

    // ---- Cleanup ----
    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseenter', onMouseEnter);
      canvas.removeEventListener('mouseleave', onMouseLeave);
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
