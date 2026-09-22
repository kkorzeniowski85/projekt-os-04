"use client";

/**
 * Fajerwerki i confetti na ekranie zwycięstwa.
 *
 * Canvas na całym ekranie, przepuszczający dotyk (pointer-events-none), więc
 * przyciski pod spodem działają normalnie. Animacja jest ograniczona w czasie
 * (kilka salw + confetti przez ~2,5 s, wszystko gaśnie samo) — bez wiecznych
 * pętli zjadających baterię tabletu.
 *
 * Przy prefers-reduced-motion nie rysujemy nic — dziecko z nadwrażliwością na
 * ruch dostaje spokojny ekran nagrody, dźwięki zostają.
 */

import { useEffect, useRef } from "react";

const COLORS = ["#ffc93c", "#21d4fd", "#ff5fa2", "#7bed6b", "#a06bff", "#f5f7ff"];

type Particle = {
  kind: "spark" | "confetti";
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  rot: number;
  vr: number;
};

const MAX_PARTICLES = 450;

export function Celebration({ big = false }: { big?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = [];
    const startedAt = performance.now();

    const pick = () => COLORS[Math.floor(Math.random() * COLORS.length)];

    function burst(cx: number, cy: number) {
      const count = 48;
      for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.25;
        const speed = 2 + Math.random() * 3.5;
        particles.push({
          kind: "spark",
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 2,
          color: pick(),
          life: 0,
          maxLife: 55 + Math.random() * 30,
          rot: 0,
          vr: 0,
        });
      }
    }

    function spawnConfetti() {
      if (particles.length >= MAX_PARTICLES) return;
      particles.push({
        kind: "confetti",
        x: Math.random() * width,
        y: -12,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 1 + Math.random() * 1.5,
        size: 4 + Math.random() * 4,
        color: pick(),
        life: 0,
        maxLife: 260,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.2,
      });
    }

    const timers: number[] = [];
    const volleys = big ? 6 : 4;
    for (let i = 0; i < volleys; i++) {
      timers.push(
        window.setTimeout(
          () => burst(width * (0.2 + Math.random() * 0.6), height * (0.15 + Math.random() * 0.3)),
          150 + i * 650,
        ),
      );
    }
    const confettiTimer = window.setInterval(() => {
      for (let i = 0; i < 4; i++) spawnConfetti();
    }, 130);
    timers.push(window.setTimeout(() => clearInterval(confettiTimer), big ? 3400 : 2500));

    let raf = 0;
    function tick() {
      context!.clearRect(0, 0, width, height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        if (p.kind === "spark") {
          p.vy += 0.06;
          p.vx *= 0.985;
          p.vy *= 0.985;
        } else {
          p.vy += 0.015;
          p.x += Math.sin((p.life + p.rot * 40) / 11) * 0.7;
          p.rot += p.vr;
        }
        if (p.life >= p.maxLife || p.y > height + 24) {
          particles.splice(i, 1);
          continue;
        }
        context!.globalAlpha = 1 - p.life / p.maxLife;
        context!.fillStyle = p.color;
        if (p.kind === "spark") {
          context!.beginPath();
          context!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          context!.fill();
        } else {
          context!.save();
          context!.translate(p.x, p.y);
          context!.rotate(p.rot);
          context!.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
          context!.restore();
        }
      }
      context!.globalAlpha = 1;

      if (performance.now() - startedAt < 8000 || particles.length > 0) {
        raf = requestAnimationFrame(tick);
      } else {
        context!.clearRect(0, 0, width, height);
      }
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      clearInterval(confettiTimer);
      window.removeEventListener("resize", resize);
    };
  }, [big]);

  return (
    <canvas
      ref={canvasRef}
      className="celebration-canvas pointer-events-none fixed inset-0 z-50"
      aria-hidden
    />
  );
}
