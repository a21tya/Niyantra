"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * ScrollCreature — an abstract, glowing AI entity that reacts to page scroll.
 * Inspired by the Kaviyan Framer website's scroll-driven 3D creature.
 * It floats in a fixed position and transforms (rotate, scale, morph) as the user scrolls.
 */
export function ScrollCreature() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const handleScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      setScroll(progress);
    };
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Derive transformations from scroll progress
  const rotateX = -15 + scroll * 40 + (mousePos.y - 0.5) * 10;
  const rotateY = (mousePos.x - 0.5) * 25 + scroll * 20;
  const rotateZ = scroll * 45;
  const scale = 0.7 + Math.sin(scroll * Math.PI) * 0.35;
  const translateY = -20 + scroll * 60;
  const hue = Math.round(scroll * 120 + 160); // shifts from cyan → purple → magenta
  const glowIntensity = 0.3 + Math.sin(scroll * Math.PI * 2) * 0.25;

  // Morph the creature's shape
  const blobRadius1 = 42 + Math.sin(scroll * Math.PI * 3) * 12;
  const blobRadius2 = 55 - Math.sin(scroll * Math.PI * 2) * 15;
  const blobRadius3 = 48 + Math.cos(scroll * Math.PI * 4) * 10;
  const blobRadius4 = 50 - Math.cos(scroll * Math.PI * 3) * 14;

  const eyeOpen = Math.max(0, 1 - Math.abs(scroll - 0.3) * 3);
  const pupilX = 50 + (mousePos.x - 0.5) * 12;
  const pupilY = 50 + (mousePos.y - 0.5) * 12;

  // Tentacle / appendage paths that morph with scroll
  const t1 = scroll * Math.PI * 2;
  const tentacles = [
    `M 50 75 Q ${30 + Math.sin(t1) * 15} ${90 + Math.cos(t1) * 10} ${15 + Math.sin(t1 + 1) * 10} ${105 + Math.cos(t1) * 8}`,
    `M 50 75 Q ${70 - Math.sin(t1 + 0.5) * 15} ${92 + Math.cos(t1 + 0.5) * 10} ${85 - Math.sin(t1 + 1.5) * 10} ${108 + Math.cos(t1 + 0.5) * 8}`,
    `M 50 78 Q ${45 + Math.sin(t1 + 1) * 10} ${95 + Math.cos(t1 + 1) * 8} ${38 + Math.sin(t1 + 2) * 8} ${112 + Math.cos(t1 + 1) * 6}`,
    `M 50 78 Q ${55 - Math.sin(t1 + 1.5) * 10} ${96 + Math.cos(t1 + 1.5) * 8} ${62 - Math.sin(t1 + 2.5) * 8} ${114 + Math.cos(t1 + 1.5) * 6}`,
  ];

  // Particle positions (small floating orbs around the creature)
  const particles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 + scroll * Math.PI * 3;
    const radius = 34 + Math.sin(scroll * Math.PI * 2 + i) * 8;
    return {
      cx: 50 + Math.cos(angle) * radius,
      cy: 55 + Math.sin(angle) * radius * 0.7,
      r: 1.2 + Math.sin(scroll * Math.PI * 4 + i * 0.8) * 0.8,
      opacity: 0.3 + Math.sin(scroll * Math.PI * 3 + i) * 0.3,
    };
  });

  return (
    <div
      ref={containerRef}
      className="scroll-creature-container"
      style={{
        position: "fixed",
        right: "clamp(20px, 4vw, 80px)",
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 40,
        pointerEvents: "none",
        width: "clamp(100px, 14vw, 180px)",
        height: "clamp(120px, 17vw, 220px)",
      }}
    >
      <div
        style={{
          transform: `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) scale(${scale}) translateY(${translateY}px)`,
          transition: "transform 0.15s ease-out",
          filter: `drop-shadow(0 0 ${20 + glowIntensity * 30}px hsla(${hue}, 85%, 60%, ${glowIntensity}))`,
          willChange: "transform, filter",
        }}
      >
        <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="creature-body-grad" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor={`hsla(${hue}, 90%, 72%, 1)`} />
              <stop offset="50%" stopColor={`hsla(${hue + 30}, 80%, 55%, 0.9)`} />
              <stop offset="100%" stopColor={`hsla(${hue + 60}, 70%, 35%, 0.7)`} />
            </radialGradient>
            <radialGradient id="creature-glow" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor={`hsla(${hue}, 100%, 80%, 0.4)`} />
              <stop offset="100%" stopColor={`hsla(${hue}, 100%, 80%, 0)`} />
            </radialGradient>
            <filter id="creature-blur">
              <feGaussianBlur stdDeviation="1.5" />
            </filter>
          </defs>

          {/* Outer glow */}
          <ellipse cx="50" cy="55" rx="38" ry="32" fill="url(#creature-glow)" />

          {/* Tentacles */}
          {tentacles.map((d, i) => (
            <path
              key={i}
              d={d}
              stroke={`hsla(${hue + i * 20}, 80%, 65%, ${0.35 + Math.sin(scroll * Math.PI * 2 + i) * 0.15})`}
              strokeWidth={2.2 - i * 0.2}
              strokeLinecap="round"
              fill="none"
              style={{ transition: "d 0.2s ease-out" }}
            />
          ))}

          {/* Main body blob */}
          <ellipse
            cx="50"
            cy="52"
            rx={blobRadius1}
            ry={blobRadius2 * 0.65}
            fill="url(#creature-body-grad)"
            style={{
              transition: "rx 0.2s ease-out, ry 0.2s ease-out",
            }}
          />

          {/* Inner body highlight */}
          <ellipse
            cx="50"
            cy="48"
            rx={blobRadius3 * 0.6}
            ry={blobRadius4 * 0.4}
            fill={`hsla(${hue - 10}, 95%, 82%, 0.35)`}
            style={{ transition: "rx 0.2s ease-out, ry 0.2s ease-out" }}
          />

          {/* Eye */}
          <g style={{ opacity: 0.4 + eyeOpen * 0.6, transition: "opacity 0.3s ease" }}>
            <ellipse
              cx="50"
              cy="50"
              rx={7 + eyeOpen * 3}
              ry={2 + eyeOpen * 6}
              fill="white"
              opacity="0.95"
            />
            <circle
              cx={pupilX}
              cy={50}
              r={2 + eyeOpen * 1.5}
              fill={`hsla(${hue + 120}, 90%, 20%, 1)`}
            />
            <circle cx={pupilX - 1} cy={49} r={0.8} fill="white" opacity="0.9" />
          </g>

          {/* Floating particles */}
          {particles.map((p, i) => (
            <circle
              key={i}
              cx={p.cx}
              cy={p.cy}
              r={p.r}
              fill={`hsla(${hue + i * 15}, 90%, 75%, ${p.opacity})`}
              style={{ transition: "cx 0.2s, cy 0.2s, r 0.15s" }}
            />
          ))}

          {/* Crown / antennae that grow with scroll */}
          <path
            d={`M 42 ${38 - scroll * 10} Q 46 ${28 - scroll * 14} 50 ${32 - scroll * 16} Q 54 ${28 - scroll * 14} 58 ${38 - scroll * 10}`}
            stroke={`hsla(${hue + 40}, 90%, 70%, ${0.4 + scroll * 0.3})`}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="50" cy={30 - scroll * 16} r={1.5 + scroll * 1.5} fill={`hsla(${hue + 40}, 95%, 80%, ${0.5 + scroll * 0.3})`} />
        </svg>
      </div>

      {/* Scroll indicator at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: "-30px",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "8px",
          fontWeight: 600,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: `hsla(${hue}, 60%, 50%, ${0.4 + Math.sin(Date.now() / 1000) * 0.15})`,
          whiteSpace: "nowrap",
          opacity: scroll < 0.05 ? 1 : 0,
          transition: "opacity 0.5s ease",
        }}
      >
        ↓ Scroll
      </div>
    </div>
  );
}
