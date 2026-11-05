import React, { useEffect, useRef } from 'react';
import { VisualizerPreset, ThemePreset, getAppearanceConfig } from '../services/appearanceService';

interface VisualizerProps {
  stream: MediaStream | null;
  isRecording: boolean;
  visualizerStyle?: VisualizerPreset;
  themePreset?: ThemePreset;
}

interface ThemePalette {
  c1: string; // rgb components 'r, g, b'
  c2: string;
  c3: string;
  glow: string;
}

const THEME_PALETTES: Record<ThemePreset, ThemePalette> = {
  dark: {
    c1: '168, 85, 247', // purple
    c2: '126, 34, 206', // deep purple
    c3: '217, 70, 239', // fuchsia
    glow: 'rgba(168, 85, 247, 0.6)',
  },
  midnight: {
    c1: '59, 130, 246', // blue
    c2: '14, 165, 233', // sky
    c3: '99, 102, 241', // indigo
    glow: 'rgba(59, 130, 246, 0.6)',
  },
  cyberpunk: {
    c1: '236, 72, 153', // pink
    c2: '217, 70, 239', // fuchsia
    c3: '6, 182, 212',  // cyan
    glow: 'rgba(236, 72, 153, 0.7)',
  },
};

const Visualizer: React.FC<VisualizerProps> = ({
  stream,
  isRecording,
  visualizerStyle,
  themePreset,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const phaseRef = useRef<number>(0);

  const activeStyle: VisualizerPreset = visualizerStyle || getAppearanceConfig().visualizer;
  const activeTheme: ThemePreset = themePreset || getAppearanceConfig().theme;

  useEffect(() => {
    if (!stream || !isRecording || !canvasRef.current) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);

    analyserRef.current = analyser;
    const bufferLength = analyser.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      if (!isRecording) return;

      const width = rect.width;
      const height = rect.height;
      const analyserNode = analyserRef.current;
      const dataArray = dataArrayRef.current;

      if (analyserNode && dataArray) {
        analyserNode.getByteFrequencyData(dataArray);
      }

      ctx.clearRect(0, 0, width, height);

      // Semi-transparent background for subtle trail
      ctx.fillStyle = 'rgba(10, 10, 15, 0.35)';
      ctx.fillRect(0, 0, width, height);

      if (dataArray) {
        phaseRef.current += 0.05;
        const palette = THEME_PALETTES[activeTheme] || THEME_PALETTES.dark;

        if (activeStyle === 'waves') {
          drawWaves(ctx, width, height, dataArray, palette, phaseRef.current);
        } else if (activeStyle === 'minimal') {
          drawMinimal(ctx, width, height, dataArray, palette, phaseRef.current);
        } else {
          drawBars(ctx, width, height, dataArray, palette);
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      try {
        audioContext.close();
      } catch {}
    };
  }, [stream, isRecording, activeStyle, activeTheme]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-xl"
      style={{
        width: '100%',
        height: '100%',
        imageRendering: 'crisp-edges',
      }}
    />
  );
};

function drawBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dataArray: Uint8Array,
  palette: ThemePalette
) {
  const barCount = 48;
  const barWidth = (width / barCount) * 0.75;
  const barGap = (width / barCount) * 0.25;

  for (let i = 0; i < barCount; i++) {
    const dataIndex = Math.floor(Math.pow(i / barCount, 1.4) * (dataArray.length * 0.6));
    const value = dataArray[dataIndex] || 0;
    const intensity = value / 255;
    const barHeight = Math.max(3, intensity * height * 0.88);
    const x = i * (barWidth + barGap);
    const y = height - barHeight;

    const gradient = ctx.createLinearGradient(x, y, x, height);
    gradient.addColorStop(0, `rgba(${palette.c3}, ${Math.max(0.4, intensity)})`);
    gradient.addColorStop(0.5, `rgba(${palette.c1}, ${Math.max(0.3, intensity)})`);
    gradient.addColorStop(1, `rgba(${palette.c2}, 0.2)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, [barWidth / 2, barWidth / 2, 0, 0]);
    ctx.fill();

    if (intensity > 0.65) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = palette.glow;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

function drawWaves(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dataArray: Uint8Array,
  palette: ThemePalette,
  phase: number
) {
  let sum = 0;
  const sampleCount = Math.min(64, dataArray.length);
  for (let i = 0; i < sampleCount; i++) {
    sum += dataArray[i];
  }
  const energy = Math.min(1, sum / sampleCount / 130);
  const midY = height / 2;

  // Background wave (softer)
  drawSingleWave(
    ctx,
    width,
    midY,
    18 + energy * (height * 0.35),
    phase * 0.9,
    `rgba(${palette.c2}, 0.25)`,
    `rgba(${palette.c2}, 0.05)`,
    2
  );

  // Middle wave
  drawSingleWave(
    ctx,
    width,
    midY,
    14 + energy * (height * 0.4),
    phase * 1.3 + Math.PI / 3,
    `rgba(${palette.c3}, 0.45)`,
    `rgba(${palette.c3}, 0.08)`,
    2
  );

  // Foreground wave (brightest)
  ctx.shadowBlur = 10;
  ctx.shadowColor = palette.glow;
  drawSingleWave(
    ctx,
    width,
    midY,
    8 + energy * (height * 0.45),
    phase * 1.6 + Math.PI,
    `rgba(${palette.c1}, 0.9)`,
    `rgba(${palette.c1}, 0.15)`,
    2.5
  );
  ctx.shadowBlur = 0;
}

function drawSingleWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  midY: number,
  amplitude: number,
  phase: number,
  strokeColor: string,
  fillColor: string,
  lineWidth: number
) {
  ctx.beginPath();
  const step = 8;
  const points: { x: number; y: number }[] = [];

  for (let x = 0; x <= width + step; x += step) {
    // Window function to keep edges anchored at center
    const edgeFade = Math.sin((x / width) * Math.PI);
    const y = midY + Math.sin(x * 0.035 + phase) * amplitude * edgeFade;
    points.push({ x, y });
  }

  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const xc = (points[i - 1].x + points[i].x) / 2;
    const yc = (points[i - 1].y + points[i].y) / 2;
    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
  }

  // Stroke
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  // Fill below wave
  ctx.lineTo(width, midY + amplitude + 10);
  ctx.lineTo(0, midY + amplitude + 10);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
}

function drawMinimal(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dataArray: Uint8Array,
  palette: ThemePalette,
  phase: number
) {
  let sum = 0;
  const sampleCount = Math.min(48, dataArray.length);
  for (let i = 0; i < sampleCount; i++) {
    sum += dataArray[i];
  }
  const energy = Math.min(1, sum / sampleCount / 120);
  const midX = width / 2;
  const midY = height / 2;

  // Horizontal guide line
  ctx.beginPath();
  ctx.moveTo(16, midY);
  ctx.lineTo(width - 16, midY);
  ctx.strokeStyle = `rgba(255, 255, 255, 0.1)`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Center pulsing rings
  const baseRadius = 8;
  const pulseRadius = baseRadius + energy * 20;

  // Expanding ripple 1
  const ripple1 = (pulseRadius + ((phase * 15) % 35)) % 45;
  const alpha1 = Math.max(0, 1 - ripple1 / 45) * 0.4;
  ctx.beginPath();
  ctx.arc(midX, midY, ripple1, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${palette.c1}, ${alpha1})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Expanding ripple 2
  const ripple2 = (pulseRadius + (((phase + 1) * 15) % 35)) % 45;
  const alpha2 = Math.max(0, 1 - ripple2 / 45) * 0.25;
  ctx.beginPath();
  ctx.arc(midX, midY, ripple2, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${palette.c3}, ${alpha2})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Core orb
  ctx.shadowBlur = 16;
  ctx.shadowColor = palette.glow;
  ctx.beginPath();
  ctx.arc(midX, midY, pulseRadius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${palette.c1}, ${0.7 + energy * 0.3})`;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Inner bright pip
  ctx.beginPath();
  ctx.arc(midX, midY, Math.max(3, pulseRadius * 0.4), 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

export default Visualizer;
