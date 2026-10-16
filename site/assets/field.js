(() => {
  // Muted scientific ink, readable against the white page.
  const colours = {
    line: "#9baaa9",
    grid: "#d5dcd9",
    blue: "#355287",
    red: "#944a3d",
    green: "#4f756b",
    dots: "#d5dcd9",
  };

  function dot(context, x, y, radius, colour) {
    context.fillStyle = colour;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  // A fixed dot grid in screen pixels, behind every animation.
  function dotGrid(context, width, height) {
    context.fillStyle = colours.dots;
    for (let x = 12; x < width; x += 24)
      for (let y = 12; y < height; y += 24) context.fillRect(x, y, 1.2, 1.2);
  }

  // A shared perspective camera: scenes live in roughly [-1, 1]³ with y up,
  // turn slowly about the vertical axis and are drawn with uniform scale, so
  // nothing is ever stretched to fit the frame.
  function camera(width, height, time, { spin = 1, pitch = 0.45, zoom = 0.36 } = {}) {
    const yaw = time * 0.00011 * spin;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    const scale = Math.min(width, height) * zoom;
    return (x, y, z) => {
      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;
      const y1 = y * cosP - z1 * sinP;
      const z2 = y * sinP + z1 * cosP;
      const depth = 4 / (4 + z2);
      return [width / 2 + x1 * scale * depth, height / 2 - y1 * scale * depth, depth];
    };
  }
  // Nearer geometry is brighter.
  const fade = (depth) => Math.max(0.12, Math.min(1, (depth - 0.72) * 2.2));

  function polyline(context, points, colour, width) {
    context.strokeStyle = colour;
    context.lineWidth = width;
    for (let i = 1; i < points.length; i++) {
      const [x0, y0, d0] = points[i - 1];
      const [x1, y1, d1] = points[i];
      context.globalAlpha = fade((d0 + d1) / 2);
      context.beginPath();
      context.moveTo(x0, y0);
      context.lineTo(x1, y1);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  // Deterministic pseudo-random numbers, so every visit draws the same data.
  const seeded = (index, seed) => {
    const x = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  // Nodes on a breathing sphere, each linked to its nearest neighbours.
  const nodes = Array.from({ length: 26 }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / 26;
    const r = Math.sqrt(1 - y * y);
    const angle = i * 2.39996;
    const jitter = 0.85 + seeded(i, 1) * 0.25;
    return [Math.cos(angle) * r * jitter, y * jitter, Math.sin(angle) * r * jitter];
  });
  const links = [];
  nodes.forEach((a, i) => {
    nodes
      .map((b, j) => [j, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])])
      .filter(([j]) => j > i)
      .sort((p, q) => p[1] - q[1])
      .slice(0, 2)
      .forEach(([j]) => links.push([i, j]));
  });
  function network(context, width, height, time) {
    const project = camera(width, height, time, { spin: 1.4, pitch: 0.35 });
    const breathe = 1 + Math.sin(time * 0.0008) * 0.05;
    const screen = nodes.map(([x, y, z]) => project(x * breathe, y * breathe, z * breathe));
    for (const [a, b] of links) polyline(context, [screen[a], screen[b]], colours.line, 0.8);
    screen.forEach(([x, y, depth], i) => {
      context.globalAlpha = fade(depth);
      dot(context, x, y, 2.4 * depth, i === 13 ? colours.red : colours.blue);
    });
    links.slice(0, 8).forEach(([a, b], i) => {
      const progress = (time * 0.00015 + i / 8) % 1;
      const [x0, y0, d0] = screen[a];
      const [x1, y1] = screen[b];
      context.globalAlpha = fade(d0);
      dot(context, x0 + (x1 - x0) * progress, y0 + (y1 - y0) * progress, 1.7, colours.green);
    });
    context.globalAlpha = 1;
  }

  // A bivariate normal density drawn as a wireframe surface.
  function gaussian(time) {
    const mx = Math.sin(time * 0.0005) * 0.35;
    const mz = Math.cos(time * 0.0004) * 0.35;
    const sigma = 0.42 + Math.sin(time * 0.0007) * 0.06;
    return {
      mx,
      mz,
      sigma,
      height: (x, z) =>
        1.15 * Math.exp(-((x - mx) ** 2 + (z - mz) ** 2) / (2 * sigma * sigma)) - 0.5,
    };
  }
  function distribution(context, width, height, time) {
    const project = camera(width, height, time, { pitch: 0.5, zoom: 0.4 });
    const surface = gaussian(time);
    const steps = 22;
    const at = (i) => -1.2 + (2.4 * i) / steps;
    for (let i = 0; i <= steps; i++) {
      const rows = [], columns = [];
      for (let j = 0; j <= steps; j++) {
        rows.push(project(at(j), surface.height(at(j), at(i)), at(i)));
        columns.push(project(at(i), surface.height(at(i), at(j)), at(j)));
      }
      polyline(context, rows, colours.line, 0.6);
      polyline(context, columns, colours.line, 0.6);
    }
    const [x, y, depth] = project(surface.mx, surface.height(surface.mx, surface.mz), surface.mz);
    dot(context, x, y, 2.6 * depth, colours.red);
  }

  // Level sets of the same density, lifted to their heights.
  function contours(context, width, height, time) {
    const project = camera(width, height, time, { spin: 0.9, pitch: 0.55, zoom: 0.4 });
    const surface = gaussian(time);
    for (let level = 1; level <= 7; level++) {
      const share = level / 8;
      const radius = surface.sigma * Math.sqrt(-2 * Math.log(share));
      const y = 1.15 * share - 0.5;
      const ring = [];
      for (let k = 0; k <= 72; k++) {
        const angle = (k / 72) * Math.PI * 2;
        ring.push(project(surface.mx + Math.cos(angle) * radius, y, surface.mz + Math.sin(angle) * radius));
      }
      polyline(context, ring, level === 7 ? colours.green : colours.line, 0.9);
    }
    const ground = [];
    for (let k = 0; k <= 72; k++) {
      const angle = (k / 72) * Math.PI * 2;
      ground.push(project(Math.cos(angle) * 1.15, -0.5, Math.sin(angle) * 1.15));
    }
    polyline(context, ground, colours.grid, 0.6);
    const angle = time * 0.0003;
    const [x, y, depth] = project(Math.cos(angle) * 1.15, -0.5, Math.sin(angle) * 1.15);
    dot(context, x, y, 2.4 * depth, colours.red);
  }

  // A point cloud scattered about a slowly tilting regression plane.
  const cloud = Array.from({ length: 70 }, (_, i) => [
    seeded(i, 2) * 2 - 1,
    (seeded(i, 3) - 0.5) * 0.5,
    seeded(i, 4) * 2 - 1,
  ]);
  function scatter(context, width, height, time) {
    const project = camera(width, height, time, { spin: 1.1, pitch: 0.3 });
    const a = 0.45 + Math.sin(time * 0.0006) * 0.2;
    const b = -0.25 + Math.cos(time * 0.0005) * 0.2;
    const plane = (x, z) => a * x + b * z;
    for (let i = 0; i <= 6; i++) {
      const t = -1 + i / 3;
      polyline(context, [project(t, plane(t, -1), -1), project(t, plane(t, 1), 1)], colours.red, 0.6);
      polyline(context, [project(-1, plane(-1, t), t), project(1, plane(1, t), t)], colours.red, 0.6);
    }
    const origin = [-1.15, -0.95, -1.15];
    for (const axis of [[1.15, -0.95, -1.15], [-1.15, 0.95, -1.15], [-1.15, -0.95, 1.15]])
      polyline(context, [project(...origin), project(...axis)], colours.line, 0.8);
    cloud.forEach(([x, noise, z], i) => {
      const drift = Math.sin(time * 0.001 + i) * 0.05;
      const [sx, sy, depth] = project(x, plane(x, z) + noise + drift, z);
      context.globalAlpha = fade(depth);
      dot(context, sx, sy, 1.9 * depth, colours.green);
    });
    context.globalAlpha = 1;
  }

  // Ridgeline time series receding into depth.
  function series(context, width, height, time) {
    const project = camera(width, height, time, { spin: 0.5, pitch: 0.42, zoom: 0.4 });
    const phase = time * 0.001;
    const value = (x, row) =>
      Math.sin(x * 4 - phase + row * 0.7) * 0.22 + Math.sin(x * 11 + phase * 1.3 + row) * 0.07;
    for (let row = 0; row < 9; row++) {
      const z = -1 + row / 4;
      const line = [];
      for (let k = 0; k <= 80; k++) {
        const x = -1.3 + (2.6 * k) / 80;
        line.push(project(x, value(x, row) - 0.2, z));
      }
      polyline(context, line, row === 4 ? colours.green : colours.line, row === 4 ? 1.1 : 0.7);
    }
    const x = Math.sin(time * 0.0003) * 1.2;
    const [sx, sy, depth] = project(x, value(x, 4) - 0.2, 0);
    dot(context, sx, sy, 2.4 * depth, colours.red);
  }

  function heatmap(context, width, height, time) {
    const cellWidth = (width - 12) / 5;
    const cellHeight = (height - 12) / 5;
    for (let row = 0; row < 5; row++) {
      for (let column = 0; column < 5; column++) {
        const value =
          row === column
            ? 1
            : Math.cos(
                (row - column) * (1.15 + Math.sin(time * 0.0006) * 0.65),
              );
        context.fillStyle = value >= 0 ? colours.line : colours.red;
        context.globalAlpha = 0.08 + Math.abs(value) * 0.42;
        context.fillRect(
          6 + column * cellWidth,
          6 + row * cellHeight,
          cellWidth - 1.5,
          cellHeight - 1.5,
        );
      }
    }
    context.globalAlpha = 1;
  }

  const renderers = {
    network,
    distribution,
    scatter,
    heatmap,
    series,
    contours,
  };
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  for (const group of document.querySelectorAll("[data-animation-group]")) {
    const button = group.querySelector(".motion-toggle");
    if (!button) continue;
    const names = Object.keys(renderers);
    for (const canvas of group.querySelectorAll('canvas[data-plot="random"]'))
      canvas.dataset.plot = names[Math.floor(Math.random() * names.length)];
    const plots = [...group.querySelectorAll("canvas[data-plot]")]
      .map((canvas) => ({
        canvas,
        context: canvas.getContext("2d"),
        render: renderers[canvas.dataset.plot],
        width: 0,
        height: 0,
        visible: false,
      }))
      .filter((plot) => plot.context && plot.render);
    if (!plots.length) {
      button.hidden = true;
      continue;
    }
    let paused = reducedMotion.matches;
    let revealComplete = reducedMotion.matches;
    let frame = 0;
    let time = 0;
    let last = 0;

    const draw = (plot) => {
      const { context, width, height } = plot;
      if (!width || !height) return;
      context.clearRect(0, 0, width, height);
      if (plot.canvas.hasAttribute("data-reveal-delay")) {
        // Explicitly pausing completes the reveal, so the mathematical
        // scene remains visible as a static illustration.
        const delay = Number(plot.canvas.dataset.revealDelay) || 0;
        const progress = revealComplete ? 1 : Math.max(0, Math.min(1, (time - delay) / 3200));
        const opacity = progress * progress * (3 - 2 * progress);
        plot.canvas.style.setProperty("--sketch-opacity", opacity.toFixed(4));
      }
      dotGrid(context, width, height);
      // Draw each sketch on a fixed 4:3 logical canvas, scaled up past the
      // banner's edges so it is cropped rather than stretched.
      const right = plot.canvas.dataset.fit === "right";
      const size = right
        ? Math.max((height / 0.75) * 1.3, width * 0.62)
        : Math.max(width, height / 0.75) * 1.1;
      const centreX = right ? width * 0.74 : width / 2;
      context.save();
      context.translate(centreX - size / 2, height / 2 - (size * 0.75) / 2);
      context.scale(size / 420, size / 420);
      const speed = Number(plot.canvas.dataset.speed) || 1;
      plot.render(context, 420, 315, time * speed);
      context.restore();
    };
    const tick = (now) => {
      if (last) time += Math.min(now - last, 50);
      last = now;
      for (const plot of plots) if (plot.visible) draw(plot);
      frame = requestAnimationFrame(tick);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (!paused && !document.hidden && plots.some((plot) => plot.visible))
        frame = requestAnimationFrame(tick);
      const label = (paused ? "Play " : "Pause ") + group.dataset.animationName;
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      button.querySelector("[data-play]").hidden = !paused;
      button.querySelector("[data-pause]").hidden = paused;
    };

    const byCanvas = new Map(plots.map((plot) => [plot.canvas, plot]));
    const resize = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const plot = byCanvas.get(entry.target);
        plot.width = entry.contentRect.width;
        plot.height = entry.contentRect.height;
        const scale = Math.min(devicePixelRatio || 1, 2);
        plot.canvas.width = Math.round(plot.width * scale);
        plot.canvas.height = Math.round(plot.height * scale);
        plot.context.setTransform(scale, 0, 0, scale, 0, 0);
        draw(plot);
      }
    });
    const visibility = new IntersectionObserver((entries) => {
      for (const entry of entries)
        byCanvas.get(entry.target).visible = entry.isIntersecting;
      update();
    });
    for (const { canvas } of plots) {
      resize.observe(canvas);
      visibility.observe(canvas);
    }
    document.addEventListener("visibilitychange", update);
    button.addEventListener("click", () => {
      paused = !paused;
      if (paused) {
        revealComplete = true;
        for (const plot of plots) draw(plot);
      }
      update();
    });
    reducedMotion.addEventListener("change", () => {
      paused = reducedMotion.matches;
      if (paused) revealComplete = true;
      for (const plot of plots) draw(plot);
      update();
    });
    update();
  }
})();
