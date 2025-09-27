"use client";

import React, { useEffect, useRef } from 'react';

interface SiriWaveProps {
  width?: number;
  height?: number;
  amplitude?: number;
  speed?: number;
  frequency?: number;
  color?: string;
  cover?: boolean;
  autostart?: boolean;
}

const SiriWave: React.FC<SiriWaveProps> = ({
  width = 320,
  height = 100,
  amplitude = 1,
  speed = 0.2,
  frequency = 6,
  color = '#fff',
  cover = false,
  autostart = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const phaseRef = useRef(0);
  const runningRef = useRef(false);

  const ratio = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  const canvasWidth = ratio * width;
  const canvasHeight = ratio * height;
  const width_2 = canvasWidth / 2;
  const width_4 = canvasWidth / 4;
  const height_2 = canvasHeight / 2;
  const MAX = height_2 - 4;

  // Convert hex to rgb
  const hex2rgb = (hex: string): string => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? parseInt(result[1], 16) + ',' + parseInt(result[2], 16) + ',' + parseInt(result[3], 16)
      : '255,255,255';
  };

  const rgbColor = hex2rgb(color);

  const _GATF_cache: { [key: string]: number } = {};
  const _globAttFunc = (x: number): number => {
    const key = x.toString();
    if (_GATF_cache[key] == null) {
      _GATF_cache[key] = Math.pow(4 / (4 + Math.pow(x, 4)), 4);
    }
    return _GATF_cache[key];
  };

  const _xpos = (i: number): number => {
    return width_2 + i * width_4;
  };

  const _ypos = (i: number, attenuation: number): number => {
    const att = (MAX * amplitude) / attenuation;
    return height_2 + _globAttFunc(i) * att * Math.sin(frequency * i - phaseRef.current);
  };

  const _drawLine = (ctx: CanvasRenderingContext2D, attenuation: number, color: string, lineWidth: number = 1) => {
    ctx.moveTo(0, 0);
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    let i = -2;
    while ((i += 0.01) <= 2) {
      let y = _ypos(i, attenuation);
      if (Math.abs(i) >= 1.90) y = height_2;
      ctx.lineTo(_xpos(i), y);
    }

    ctx.stroke();
  };

  const _clear = (ctx: CanvasRenderingContext2D) => {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.globalCompositeOperation = 'source-over';
  };

  const _draw = () => {
    if (!runningRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    phaseRef.current = (phaseRef.current + Math.PI * speed) % (2 * Math.PI);

    _clear(ctx);
    _drawLine(ctx, -2, `rgba(${rgbColor},0.1)`);
    _drawLine(ctx, -6, `rgba(${rgbColor},0.2)`);
    _drawLine(ctx, 4, `rgba(${rgbColor},0.4)`);
    _drawLine(ctx, 2, `rgba(${rgbColor},0.6)`);
    _drawLine(ctx, 1, `rgba(${rgbColor},1)`, 1.5);

    animationRef.current = requestAnimationFrame(_draw);
  };

  const start = () => {
    phaseRef.current = 0;
    runningRef.current = true;
    _draw();
  };

  const stop = () => {
    phaseRef.current = 0;
    runningRef.current = false;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    if (autostart) {
      start();
    }

    return () => {
      stop();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: cover ? '100%' : `${width}px`,
        height: cover ? '100%' : `${height}px`,
      }}
    />
  );
};

export default SiriWave;