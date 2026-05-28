import React, { useEffect, useRef } from 'react';

const ParticlesBackground = ({ effectType }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (effectType === 'aurora' || effectType === 'none') return; // Do not draw particles

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationFrameId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const getCount = () => {
      return Math.min(Math.floor(window.innerWidth * window.innerHeight / 14000), 55);
    };

    const makeParticle = () => {
      const isFireflies = effectType === 'fireflies';
      const isSnow = effectType === 'snow';
      
      let p = {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        life: Math.random() * 0.6,
        maxLife: 0.55 + Math.random() * 0.35,
      };

      if (isFireflies) {
        p.vx = (Math.random() - 0.5) * 0.5;
        p.vy = (Math.random() - 0.5) * 0.5;
        p.size = 2 + Math.random() * 2;
        p.glow = Math.random() * Math.PI * 2;
        p.glowSpeed = 0.018 + Math.random() * 0.025;
        p.hue = 130 + Math.random() * 30;
      } else if (isSnow) {
        p.vx = (Math.random() - 0.5) * 0.5;
        p.vy = 0.5 + Math.random() * 1.5;
        p.size = 1.5 + Math.random() * 2.5;
        p.swing = Math.random() * Math.PI * 2;
        p.swingSpeed = 0.01 + Math.random() * 0.02;
      } else {
        // Leaves
        p.vx = (Math.random() - 0.5) * 0.3;
        p.vy = (Math.random() - 0.5) * 0.2 + 0.1;
        p.size = 7 + Math.random() * 5;
        p.angle = Math.random() * Math.PI * 2;
        p.angleSpeed = (Math.random() - 0.5) * 0.0125;
        p.hue = 90 + Math.random() * 50;
      }
      return p;
    };

    const initParticles = () => {
      resize();
      particles = Array.from({ length: getCount() }, makeParticle);
    };

    const drawFirefly = (p) => {
      const alpha = (0.45 + 0.55 * Math.sin(p.glow)) * p.life;
      const r = p.size * 4.5;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grad.addColorStop(0,    `hsla(${p.hue}, 100%, 80%, ${alpha * 0.9})`);
      grad.addColorStop(0.35, `hsla(${p.hue},  90%, 60%, ${alpha * 0.45})`);
      grad.addColorStop(1,    `hsla(${p.hue},  80%, 40%, 0)`);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 100%, 92%, ${alpha})`; ctx.fill();
    };

    const drawLeaf = (p) => {
      const alpha = p.life * 0.72;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.globalAlpha = alpha;
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo( s * 0.75, -s * 0.55,  s * 0.75,  s * 0.55, 0,  s);
      ctx.bezierCurveTo(-s * 0.75,  s * 0.55, -s * 0.75, -s * 0.55, 0, -s);
      ctx.fillStyle = `hsl(${p.hue}, 55%, 44%)`; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -s * 0.8); ctx.lineTo(0, s * 0.8);
      ctx.strokeStyle = `hsla(${p.hue}, 55%, 30%, 0.5)`;
      ctx.lineWidth = 0.6; ctx.stroke();
      ctx.restore();
    };

    const drawSnow = (p) => {
      const alpha = p.life * 0.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    };

    const update = (p) => {
      const isFireflies = effectType === 'fireflies';
      const isSnow = effectType === 'snow';

      if (isFireflies) {
        p.glow += p.glowSpeed;
      } else if (isSnow) {
        p.swing += p.swingSpeed;
        p.vx = Math.sin(p.swing) * 0.5; // Sway left to right gently
      } else {
        p.vy += 0.006; 
        p.angle += p.angleSpeed;
      }
      
      p.x += p.vx; 
      p.y += p.vy;
      
      const M = 25, W = canvas.width, H = canvas.height;
      if (p.x < -M) p.x = W + M; 
      if (p.x > W + M) p.x = -M;
      if (p.y < -M) p.y = H + M; 
      if (p.y > H + M) {
          p.y = -M;
          if (isSnow) {
             p.x = Math.random() * W; // Randomize X when snow falls off bottom
          }
      }
      if (p.life < p.maxLife) p.life = Math.min(p.life + 0.008, p.maxLife);
    };

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        update(p);
        if (effectType === 'fireflies') drawFirefly(p);
        else if (effectType === 'snow') drawSnow(p);
        else drawLeaf(p);
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    initParticles();
    loop();

    window.addEventListener('resize', initParticles);

    return () => {
      window.removeEventListener('resize', initParticles);
      cancelAnimationFrame(animationFrameId);
    };
  }, [effectType]);

  if (effectType === 'aurora' || effectType === 'none') {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: 0.8 }}
    />
  );
};

export default ParticlesBackground;
