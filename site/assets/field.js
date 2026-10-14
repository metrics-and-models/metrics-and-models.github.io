(() => {
  // Publication palette, tuned to read on the navy banner.
  const colours = {
    ink: "#75BBD4",
    line: "#74ADD1",
    grid: "#5d84ad",
    blue: "#FEE7BA",
    red: "#E66859",
    green: "#74D1AF",
    fill: "#74ADD133",
  };

  function dot(context, x, y, radius, colour) {
    context.fillStyle = colour;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function axes(context, width, height) {
    context.strokeStyle = colours.line;
    context.lineWidth = 0.8;
    context.beginPath();
    context.moveTo(5, 5);
    context.lineTo(5, height - 5);
    context.lineTo(width - 4, height - 5);
    context.stroke();
  }

  function flow(context, width, height, time) {
    // A family of trajectories projected onto a scientific grid.
    const point = (u, v) => {
      const phase = time * 0.00055;
      const angle = u * Math.PI * 1.7 - 1.1 + Math.sin(time * 0.00022) * 0.28;
      const radius = (0.25 + v * 0.11) * (1 + Math.sin(phase + v) * 0.04);
      const bend = Math.sin(u * Math.PI * 2 + phase) * 0.045;
      return [
        width * (0.51 + Math.cos(angle) * radius + u * 0.14 + v * 0.035),
        height * (0.47 + Math.sin(angle) * radius * 0.9 + v * 0.12 + bend),
      ];
    };
    context.fillStyle = colours.grid;
    for (let x = 18; x < width - 5; x += 18)
      for (let y = 18; y < height - 5; y += 18) context.fillRect(x, y, 1, 1);

    for (let line = 0; line < 27; line++) {
      const v = (line - 13) / 13;
      context.beginPath();
      for (let step = 0; step <= 130; step++) {
        const [x, y] = point(step / 130, v);
        if (step === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = line % 6 === 0 ? colours.ink : colours.line;
      context.lineWidth = line % 6 === 0 ? 0.77 : 0.455;
      context.stroke();
    }
    for (let index = 0; index < 5; index++) {
      const u = (index * 0.207 + time * 0.00007) % 1;
      const [x, y] = point(u, (index - 2) / 3);
      dot(context, x, y, 1.96, index === 2 ? colours.red : colours.blue);
    }
  }

  function network(context, width, height, time) {
    const points = [
      [0.16, 0.3],
      [0.2, 0.76],
      [0.41, 0.15],
      [0.47, 0.52],
      [0.62, 0.83],
      [0.77, 0.23],
      [0.86, 0.62],
    ].map(([x, y], index) => {
      const angle = time * 0.00035 + Math.sin(time * 0.00065 + index) * 0.1;
      const radius = 0.84 * (1 + Math.sin(time * 0.0009 + index) * 0.07);
      const dx = (x - 0.5) * radius;
      const dy = (y - 0.5) * radius;
      return [
        width * (0.5 + dx * Math.cos(angle) - dy * Math.sin(angle)),
        height * (0.5 + dx * Math.sin(angle) + dy * Math.cos(angle)),
      ];
    });
    const edges = [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 3],
      [1, 4],
      [2, 3],
      [2, 5],
      [3, 4],
      [3, 5],
      [3, 6],
      [4, 6],
      [5, 6],
    ];
    context.strokeStyle = colours.line;
    context.lineWidth = 0.8;
    for (const [a, b] of edges) {
      context.beginPath();
      context.moveTo(...points[a]);
      context.lineTo(...points[b]);
      context.stroke();
    }
    points.forEach(([x, y], index) =>
      dot(
        context,
        x,
        y,
        width < 70 ? 1.7 : 2.4,
        index === 3 ? colours.red : colours.blue,
      ),
    );
    for (const [index, edge] of [edges[5], edges[8], edges[10]].entries()) {
      const progress = (time * 0.00028 + index / 3) % 1;
      const [a, b] = edge.map((node) => points[node]);
      dot(
        context,
        a[0] + (b[0] - a[0]) * progress,
        a[1] + (b[1] - a[1]) * progress,
        1.6,
        colours.green,
      );
    }
  }

  function distribution(context, width, height, time) {
    axes(context, width, height);
    const mean = 0.49 + Math.sin(time * 0.00085) * 0.14;
    const sigma = 0.155 + Math.cos(time * 0.00065) * 0.03;
    const density = (x) => Math.exp(-0.5 * ((x - mean) / sigma) ** 2);
    const xPixel = (x) => 7 + x * (width - 13);
    const yPixel = (x) => height - 6 - density(x) * (height - 13);
    const barWidth = (width - 13) / 12;
    context.fillStyle = colours.fill;
    for (let bin = 0; bin < 12; bin++) {
      const x = (bin + 0.5) / 12;
      const y = yPixel(x);
      context.fillRect(
        xPixel(bin / 12),
        y,
        Math.max(1, barWidth - 1),
        height - 6 - y,
      );
    }
    context.strokeStyle = colours.blue;
    context.lineWidth = 1.1;
    context.beginPath();
    for (let step = 0; step <= 60; step++) {
      const x = step / 60;
      if (step === 0) context.moveTo(xPixel(x), yPixel(x));
      else context.lineTo(xPixel(x), yPixel(x));
    }
    context.stroke();
    dot(context, xPixel(mean), yPixel(mean), 1.8, colours.red);
  }

  function scatter(context, width, height, time) {
    axes(context, width, height);
    const slope = 0.44 + Math.sin(time * 0.0008) * 0.15;
    const xPixel = (x) => 7 + x * (width - 13);
    const yPixel = (y) => height - 7 - y * (height - 13);
    context.strokeStyle = colours.red;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(xPixel(0), yPixel(0.2));
    context.lineTo(xPixel(1), yPixel(0.2 + slope));
    context.stroke();
    for (let index = 0; index < 15; index++) {
      const x = (index + 0.5) / 15 + Math.sin(time * 0.00055 + index) * 0.012;
      const noise = Math.sin(index * 5.7) * 0.14;
      const drift = Math.sin(time * 0.001 + index) * 0.065;
      dot(
        context,
        xPixel(x),
        yPixel(0.2 + slope * x + noise + drift),
        width < 70 ? 1.3 : 1.8,
        colours.green,
      );
    }
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
        context.globalAlpha = 0.15 + Math.abs(value) * 0.7;
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

  function series(context, width, height, time) {
    axes(context, width, height);
    const phase = time * 0.001;
    const value = (x) =>
      0.5 + Math.sin(x * 7 - phase) * 0.23 + Math.sin(x * 19 + phase) * 0.09;
    const xPixel = (x) => 7 + x * (width - 13);
    const yPixel = (x) => height - 7 - value(x) * (height - 13);
    context.strokeStyle = colours.green;
    context.lineWidth = 1.1;
    context.beginPath();
    for (let step = 0; step <= 60; step++) {
      const x = step / 60;
      if (step === 0) context.moveTo(xPixel(x), yPixel(x));
      else context.lineTo(xPixel(x), yPixel(x));
    }
    context.stroke();
    const position = 0.5 + Math.sin(time * 0.0007) * 0.42;
    dot(context, xPixel(position), yPixel(position), 1.8, colours.red);
  }

  function contours(context, width, height, time) {
    const radiusX = (width - 14) / 2;
    const radiusY = (height - 14) / 2;
    const angle = time * 0.0009;
    const distance = 0.5 + Math.sin(time * 0.00065) * 0.28;
    context.lineWidth = 0.8;
    for (let ring = 1; ring <= 4; ring++) {
      context.strokeStyle = ring === 1 ? colours.green : colours.line;
      context.beginPath();
      context.ellipse(
        width / 2,
        height / 2,
        (radiusX * ring) / 4,
        (radiusY * ring) / 4,
        0,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    dot(context, width / 2, height / 2, 1.4, colours.green);
    dot(
      context,
      width / 2 + Math.cos(angle) * radiusX * distance,
      height / 2 + Math.sin(angle) * radiusY * distance,
      2,
      colours.red,
    );
  }

  // A slowly turning knot of short strands: many noisy trajectories that
  // together trace one shape. Drawn at native size for the homepage banner.
  const tints = ["#E66859", "#FEE7BA", "#75BBD4", "#74ADD1", "#74D1AF"];
  const strands = Array.from({ length: 1100 }, (_, index) => {
    const random = (seed) => {
      const x = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    return {
      u: (index / 1100) * Math.PI * 2,
      spread: [random(1) - 0.5, random(2) - 0.5, random(3) - 0.5],
      speed: 0.6 + random(4) * 0.8,
      length: 0.03 + random(5) * 0.07,
      tint: random(6) < 0.09 ? tints[Math.floor(random(7) * tints.length)] : "",
      alpha: 0.18 + random(8) * 0.5,
    };
  });
  function ribbon(context, width, height, time) {
    const size = Math.min(width, height * 1.2) * 0.135;
    const turn = time * 0.00011;
    const tilt = 0.55 + Math.sin(time * 0.00007) * 0.15;
    const project = (u, spread, wobble) => {
      // A trefoil knot with a breathing cross-section.
      let x = Math.sin(u) + 2 * Math.sin(2 * u);
      let y = Math.cos(u) - 2 * Math.cos(2 * u);
      let z = -Math.sin(3 * u);
      const width = 0.55 + Math.sin(u * 3 + wobble) * 0.2;
      x += spread[0] * width;
      y += spread[1] * width;
      z += spread[2] * width;
      const cosT = Math.cos(turn), sinT = Math.sin(turn);
      [x, z] = [x * cosT - z * sinT, x * sinT + z * cosT];
      const cosL = Math.cos(tilt), sinL = Math.sin(tilt);
      [y, z] = [y * cosL - z * sinL, y * sinL + z * cosL];
      const depth = 4.2 / (4.2 + z * 0.35);
      return [x * size * depth, y * size * depth, depth];
    };
    context.save();
    context.translate(width / 2, height / 2);
    context.globalCompositeOperation = "lighter";
    context.lineWidth = 0.7;
    const wobble = time * 0.0006;
    for (const strand of strands) {
      const head = strand.u + time * 0.000045 * strand.speed;
      const [x1, y1, depth] = project(head, strand.spread, wobble);
      const [x0, y0] = project(head - strand.length, strand.spread, wobble);
      const colour = strand.tint || "#ffffff";
      context.globalAlpha = strand.alpha * (depth - 0.55);
      context.strokeStyle = colour;
      context.beginPath();
      context.moveTo(x0, y0);
      context.lineTo(x1, y1);
      context.stroke();
      context.globalAlpha = Math.min(1, strand.alpha * 1.6 * depth);
      context.fillStyle = colour;
      context.fillRect(x1 - 0.8, y1 - 0.8, 1.6 * depth, 1.6 * depth);
    }
    context.restore();
  }

  const renderers = {
    flow,
    network,
    distribution,
    scatter,
    heatmap,
    series,
    contours,
    ribbon,
  };
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  for (const group of document.querySelectorAll("[data-animation-group]")) {
    const button = group.querySelector(".motion-toggle");
    if (!button) continue;
    const names = Object.keys(renderers).filter((name) => name !== "ribbon");
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
    let frame = 0;
    let time = 0;
    let last = 0;

    const draw = (plot) => {
      if (!plot.width || !plot.height) return;
      plot.context.clearRect(0, 0, plot.width, plot.height);
      // Draw on a small logical canvas and scale it up, so the sketches keep
      // their proportions and line weights when they fill a whole banner.
      const zoom =
        plot.canvas.dataset.plot === "ribbon" ? 1 : Math.max(1, plot.width / 420);
      plot.context.save();
      plot.context.scale(zoom, zoom);
      plot.render(plot.context, plot.width / zoom, plot.height / zoom, time);
      plot.context.restore();
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
      update();
    });
    reducedMotion.addEventListener("change", () => {
      paused = reducedMotion.matches;
      update();
    });
    update();
  }
})();
