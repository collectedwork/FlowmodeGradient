import { useControls, Leva } from 'leva';
import ShaderCanvas from './components/ShaderCanvas';
import { PALETTE_OPTIONS } from './palettes';
import './App.css';

function App() {
  const { palette, noiseScaleX, noiseScaleY, scrollSpeed, evolveSpeed, lerpDuration, lerpEasing } =
    useControls('Noise', {
      palette: {
        label: 'Palette',
        options: PALETTE_OPTIONS,
        value: 'A',
      },
      noiseScaleX: { label: 'Noise Scale X', value: 0.2, min: 0.0, max: 10.0, step: 0.1 },
      noiseScaleY: { label: 'Noise Scale Y', value: 0.8, min: 0.0, max: 10.0, step: 0.1 },
      scrollSpeed: { label: 'Scroll Speed', value: 0.15, min: 0.0, max: 1.0, step: 0.01 },
      evolveSpeed: { label: 'Evolution Speed', value: 0.1, min: 0.0, max: 0.5, step: 0.01 },
      lerpDuration: { label: 'Lerp Duration (s)', value: 3.0, min: 0.2, max: 3.0, step: 0.1 },
      lerpEasing: { label: 'Lerp Easing (power)', value: 3.0, min: 1, max: 10, step: 0.5 },
    });

  const { cursorMode, cursorRadius, cursorStrength, cursorFalloffWidth, cursorNoiseScale, cursorNoiseSpeed, cursorOctaves, cursorLacunarity, cursorDrag, cursorTrailDecay } =
    useControls('Cursor Distortion', {
      cursorMode: { label: 'Mode', options: { 'Noise Warp': 0, 'Velocity Offset': 1 }, value: 1 },
      cursorRadius: { label: 'Radius', value: 0.15, min: 0.01, max: 1.0, step: 0.01 },
      cursorStrength: { label: 'Strength', value: 1.5, min: -1.0, max: 2.0, step: 0.01 },
      cursorFalloffWidth: { label: 'Falloff Width', value: 0.12, min: 0.0, max: 0.5, step: 0.01 },
      cursorNoiseScale: { label: 'Noise Scale', value: 1.0, min: 0.5, max: 20.0, step: 0.5, render: (get) => get('Cursor Distortion.cursorMode') === 0 },
      cursorNoiseSpeed: { label: 'Noise Speed', value: 0.15, min: 0.0, max: 2.0, step: 0.05, render: (get) => get('Cursor Distortion.cursorMode') === 0 },
      cursorOctaves: { label: 'Octaves', value: 1, min: 1, max: 6, step: 1, render: (get) => get('Cursor Distortion.cursorMode') === 0 },
      cursorLacunarity: { label: 'Lacunarity', value: 2.0, min: 1.0, max: 4.0, step: 0.1, render: (get) => get('Cursor Distortion.cursorMode') === 0 },
      cursorDrag: { label: 'Drag', value: 0.7, min: 0.0, max: 0.99, step: 0.01 },
      cursorTrailDecay: { label: 'Trail Decay', value: 0.75, min: 0.0, max: 0.99, step: 0.01 },
    });

  return (
    <div className="app">
      <Leva collapsed={false} />
      <div className="canvas-container">
        <ShaderCanvas
          paletteKey={palette}
          noiseScaleX={noiseScaleX}
          noiseScaleY={noiseScaleY}
          scrollSpeed={scrollSpeed}
          evolveSpeed={evolveSpeed}
          lerpDuration={lerpDuration}
          lerpEasing={lerpEasing}
          cursorMode={cursorMode}
          cursorRadius={cursorRadius}
          cursorStrength={cursorStrength}
          cursorFalloffWidth={cursorFalloffWidth}
          cursorNoiseScale={cursorNoiseScale}
          cursorNoiseSpeed={cursorNoiseSpeed}
          cursorOctaves={cursorOctaves}
          cursorLacunarity={cursorLacunarity}
          cursorDrag={cursorDrag}
          cursorTrailDecay={cursorTrailDecay}
        />
      </div>
    </div>
  );
}

export default App;
