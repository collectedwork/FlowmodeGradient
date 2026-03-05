import { useControls, Leva } from 'leva';
import ShaderCanvas from './components/ShaderCanvas';
import { PALETTE_OPTIONS } from './palettes';
import './App.css';

function App() {
  const { palette, noiseScaleX, noiseScaleY, scrollSpeed, evolveSpeed, lerpDuration, lerpEasing } =
    useControls({
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
        />
      </div>
    </div>
  );
}

export default App;
