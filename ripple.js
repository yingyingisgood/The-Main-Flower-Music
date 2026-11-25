class WaterRipple {
  constructor(canvas, video) {
    this.canvas = canvas;
    this.video = video;
    this.context = canvas.getContext('2d', { alpha: false });
    this.waves = [];
  }

  add(x, y, strength, now) {
    if (!this.context || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.waves.push({ x, y, strength, start: now });
    if (this.waves.length > 12) this.waves.shift();
  }

  clear() {
    this.waves.length = 0;
    this.canvas.hidden = true;
  }

  render(now, width, height) {
    this.waves = this.waves.filter(wave => now - wave.start < 1550);
    const video = this.video;
    const canvas = this.canvas;
    if (!this.waves.length || video.readyState < 2 || !width || !height) {
      canvas.hidden = true;
      return;
    }

    // Draw the same centered cover crop as the underlying video.
    const scale = Math.min(1, 1500 / width, 950 / height);
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const sourceScale = Math.max(w / video.videoWidth, h / video.videoHeight);
    const sourceWidth = w / sourceScale;
    const sourceHeight = h / sourceScale;
    const sourceX = (video.videoWidth - sourceWidth) / 2;
    const sourceY = (video.videoHeight - sourceHeight) / 2;
    const ctx = this.context;
    ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, w, h);

    // Ripples refract the video in small tiles, with a soft decay across the wave front.
    const tile = Math.max(16, Math.round(w / 46));
    const waves = this.waves.map(wave => {
      const age = (now - wave.start) / 1000;
      return { x: wave.x * w, y: wave.y * h, radius: age * Math.min(w, h) * .68,
        amplitude: wave.strength * scale * (1 - age / 1.55) ** 2 };
    });
    for (let y = 0; y < h; y += tile) {
      for (let x = 0; x < w; x += tile) {
        const tileW = Math.min(tile, w - x);
        const tileH = Math.min(tile, h - y);
        let dx = 0;
        let dy = 0;
        let blur = 0;
        for (const wave of waves) {
          const vx = x + tileW / 2 - wave.x;
          const vy = y + tileH / 2 - wave.y;
          const distance = Math.hypot(vx, vy);
          const phase = distance - wave.radius;
          const spread = Math.exp(-((phase / (tile * 3)) ** 2));
          const displacement = Math.sin(phase / (tile * .37)) * spread * wave.amplitude;
          dx += displacement * vx / Math.max(1, distance);
          dy += displacement * vy / Math.max(1, distance);
          blur += spread * wave.amplitude * .045;
        }
        if (Math.abs(dx) + Math.abs(dy) + blur < .65) continue;
        const sx = Math.max(0, Math.min(w - tileW, x + dx));
        const sy = Math.max(0, Math.min(h - tileH, y + dy));
        const sw = tileW / sourceScale;
        const sh = tileH / sourceScale;
        const left = sourceX + sx / sourceScale;
        const top = sourceY + sy / sourceScale;
        ctx.drawImage(video, left, top, sw, sh, x, y, tileW, tileH);
        if (blur > .8) {
          // Two nearby samples soften stronger ripples without gaps between tiles.
          const offset = Math.min(5, blur) / sourceScale;
          ctx.globalAlpha = .22;
          for (const sign of [-1, 1]) {
            const softenedX = Math.max(0, Math.min(video.videoWidth - sw, left + sign * offset));
            ctx.drawImage(video, softenedX, top, sw, sh, x, y, tileW, tileH);
          }
          ctx.globalAlpha = 1;
        }
      }
    }
    canvas.hidden = false;
  }
}
