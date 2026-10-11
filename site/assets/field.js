(() => {
  const canvas = document.getElementById("flow-field");
  const context = canvas?.getContext("2d");
  if (!context) return;
  const button = document.querySelector(".motion-toggle");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let paused = reducedMotion.matches;
  let visible = true;
  let width = 0,
    height = 0,
    frame = 0,
    time = 0,
    last = 0;

  // A smoothly varying family of trajectories, projected onto a scientific grid.
  function point(u, v, phase) {
    const angle = u * Math.PI * 1.7 - 1.1;
    const radius = 0.25 + v * 0.11;
    const bend = Math.sin(u * Math.PI * 2 + phase) * 0.025;
    return [
      width * (0.51 + Math.cos(angle) * radius + u * 0.14 + v * 0.035),
      height * (0.52 + Math.sin(angle) * radius * 0.95 + v * 0.18 + bend),
    ];
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    const spacing = width < 300 ? 18 : 26;
    context.fillStyle = "#cbd5cd";
    for (let x = spacing; x < width - 5; x += spacing) {
      for (let y = spacing; y < height - 5; y += spacing) {
        context.fillRect(x, y, 1, 1);
      }
    }
    const size = width < 300 ? 0.7 : 1;
    for (let line = 0; line < 27; line++) {
      const v = (line - 13) / 13;
      context.beginPath();
      for (let step = 0; step <= 130; step++) {
        const [x, y] = point(step / 130, v, time * 0.00028);
        if (step === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = line % 6 === 0 ? "#568a77" : "#a8bdb0";
      context.lineWidth = line % 6 === 0 ? 1.1 * size : 0.65 * size;
      context.stroke();
    }
    for (let index = 0; index < 5; index++) {
      const u = (index * 0.207 + time * 0.000025) % 1;
      const [x, y] = point(u, (index - 2) / 3, time * 0.00028);
      context.fillStyle = index === 2 ? "#ad5944" : "#006d5e";
      context.beginPath();
      context.arc(x, y, 2.8 * size, 0, Math.PI * 2);
      context.fill();
    }
    if (width > 300) {
      context.fillStyle = "#647369";
      context.font = '10px "Courier New", monospace';
      context.fillText("x", width - 23, height / 2 + 4);
      context.fillText("y", width / 2, 20);
      context.strokeStyle = "#a9b6ac";
      context.lineWidth = 0.75;
      for (const [x, y] of [
        [width / 2, height / 2],
        [width - 33, height / 2],
        [width / 2, 32],
      ]) {
        context.beginPath();
        context.moveTo(x - 3, y);
        context.lineTo(x + 3, y);
        context.moveTo(x, y - 3);
        context.lineTo(x, y + 3);
        context.stroke();
      }
    }
  }

  function tick(now) {
    if (last) time += Math.min(now - last, 50);
    last = now;
    draw();
    frame = requestAnimationFrame(tick);
  }
  function update() {
    cancelAnimationFrame(frame);
    last = 0;
    if (!paused && visible && !document.hidden)
      frame = requestAnimationFrame(tick);
    const label = paused ? "Play animation" : "Pause animation";
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.querySelector("[data-play]").hidden = !paused;
    button.querySelector("[data-pause]").hidden = paused;
  }
  new ResizeObserver(() => {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    draw();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }).observe(canvas);
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
})();
