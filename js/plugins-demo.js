/**
 * Cadente — Plugin graph, staged
 * A small scene engine that acts out ADR 0034: a Rust microkernel,
 * versioned contracts, consumers that wait as pending, providers that
 * dock after their hash is checked, a user plugin that replaces the
 * default (drain → swap → new epoch) and a provider collision the
 * resolver refuses. Nodes ease toward targets; wires are cubic curves
 * redrawn every frame with light travelling along the live ones.
 */

const stageEl = document.getElementById('plugin-stage');
if (stageEl) initPluginStage(stageEl);

function initPluginStage(stage) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const world = stage.querySelector('.pl-world');
  const svg = stage.querySelector('.pl-wires');
  const steps = [...document.querySelectorAll('.pl-step')];
  const caption = document.querySelector('.pl-caption');

  // ---------- Layouts (design units; the world is scaled to fit) ----------
  const LAYOUTS = {
    wide: {
      W: 1600, H: 1150,
      core: { x: 800, y: 505, w: 380, h: 790 },
      duties: { x: 800, y: 262, w: 340 },
      sockets: [370, 490, 610, 730, 850],
      socketW: 340,
      provX: 290, consX: 1310, cardW: 300,
      consumerSpread: 40,
      stage: { x: 290, y: 1040 }, manifest: { x: 640, y: 1045 },
      offLeft: -260, offRight: 1860, exitX: 80,
    },
    tall: {
      W: 440, H: 1060,
      core: { x: 220, y: 500, w: 128, h: 700 },
      duties: { x: 220, y: 70, w: 420 },
      sockets: [255, 385, 515, 640, 765],
      socketW: 120,
      provX: 70, consX: 370, cardW: 132,
      consumerSpread: 34,
      stage: { x: 90, y: 960 }, manifest: { x: 300, y: 960 },
      offLeft: -160, offRight: 600, exitX: -40,
    },
  };

  const CONTRACTS = [
    { id: 'gw', name: 'cadente.model-gateway@1', short: 'gateway@1' },
    { id: 'cmp', name: 'cadente.compaction@1', short: 'compaction@1' },
    { id: 'th', name: 'cadente.terminal.history@1', short: 'history@1' },
    { id: 'tool', name: 'cadente.tool-executor@1', short: 'executor@1' },
    { id: 'mcp', name: 'cadente.mcp-broker@1', short: 'mcp@1' },
  ];
  const PROVIDERS = [
    { id: 'p-gw', c: 'gw', name: 'model-gateway.default', short: 'gateway', sub: 'anthropic · openai · gemini · ollama' },
    { id: 'p-cmp', c: 'cmp', name: 'compaction.default', short: 'compaction' },
    { id: 'p-th', c: 'th', name: 'terminal-history.default', short: 'history' },
    { id: 'p-tool', c: 'tool', name: 'tool-executor.default', short: 'executor' },
    { id: 'p-mcp', c: 'mcp', name: 'mcp-broker.default', short: 'mcp' },
  ];
  const CONSUMERS = [
    { id: 'u-turn', c: 'gw', name: 'turn-engine', short: 'turn-engine' },
    { id: 'u-cman', c: 'cmp', name: 'compaction.manual', short: 'manual', dy: -1 },
    { id: 'u-cauto', c: 'cmp', name: 'compaction.auto-policy', short: 'auto-policy', dy: 1 },
    { id: 'u-term', c: 'th', name: 'terminal', short: 'terminal' },
    { id: 'u-agent', c: 'tool', name: 'agent-loop', short: 'agent-loop' },
    { id: 'u-chat', c: 'mcp', name: 'chat-view', short: 'chat-view' },
  ].map((u) => ({ dy: 0, ...u }));
  const DUTIES = ['trust', 'permissions', 'integrity', 'isolation', 'persistence', 'resolution', 'recovery'];

  const STEP_TEXT = [
    'A small Rust microkernel owns only what must never be swapped: trust, permissions, integrity, isolation, persistence, resolution and recovery.',
    'Every replaceable capability is a versioned contract — a definition with no implementation behind it yet.',
    'Features depend on the contract, never on an implementation. Until something provides it, they wait as pending.',
    'Providers dock in. Each artifact is hash-checked and gets only the permissions it declares. Pending turns ready.',
    'Install acme.compaction and switch the default off. The old provider drains, the new one docks, and only its consumers restart — unchanged.',
    'Two providers for one contract? The resolver refuses with an explicit collision instead of picking one by accident.',
  ];
  const STEP_MS = [3400, 3000, 3600, 4600, 9200, 5200];

  let L = null;
  let layoutName = '';
  const nodes = new Map();
  const wires = new Map();
  let timers = [];
  let current = 0;
  let playing = false;
  let visible = false;
  let stepStart = 0;
  let epoch = 7;
  let started = false;

  // ---------- DOM builders ----------
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function addNode(id, element, extra = {}) {
    world.appendChild(element);
    const n = { id, el: element, x: 0, y: 0, tx: 0, ty: 0, o: 0, to: 0, s: 0.92, ts: 1, shake: 0, ...extra };
    nodes.set(id, n);
    return n;
  }

  function build() {
    world.innerHTML = '';
    svg.innerHTML = '';
    nodes.clear();
    wires.clear();
    const tall = layoutName === 'tall';
    world.style.width = `${L.W}px`;
    world.style.height = `${L.H}px`;
    svg.setAttribute('viewBox', `0 0 ${L.W} ${L.H}`);
    stage.style.aspectRatio = `${L.W} / ${L.H}`;

    const core = el('div', 'pl-core', `<p class="pl-core__title">Cadente microkernel</p><p class="pl-core__sub">Rust</p>`);
    core.style.width = `${L.core.w}px`;
    core.style.height = `${L.core.h}px`;
    addNode('core', core);

    const duties = el('ul', 'pl-duties');
    duties.style.width = `${L.duties.w}px`;
    DUTIES.forEach((d) => duties.appendChild(el('li', '', d)));
    addNode('duties', duties);

    CONTRACTS.forEach((c) => {
      const s = el('div', 'pl-socket', `<i class="pl-dot"></i><span>${tall ? c.short : c.name}</span>${c.id === 'cmp' ? '<em class="pl-epoch">epoch <b>7</b></em>' : ''}`);
      s.style.width = `${L.socketW}px`;
      addNode(`s-${c.id}`, s);
    });

    const card = (kind, name, sub) => {
      const k = el('div', `pl-card pl-card--${kind}`,
        `<span class="pl-card__kind">${kind}</span><b>${name}</b>${sub ? `<small>${sub}</small>` : ''}<i class="pl-card__badge"></i>`);
      k.style.width = `${L.cardW}px`;
      return k;
    };

    PROVIDERS.forEach((p) => addNode(p.id, card('provider', tall ? p.short : p.name, tall ? null : p.sub), { c: p.c }));
    CONSUMERS.forEach((u) => addNode(u.id, card('consumer', tall ? u.short : u.name), { c: u.c, dy: u.dy || 0 }));

    const acme = card('provider', tall ? 'acme' : 'acme.compaction', tall ? null : 'your plugin');
    acme.classList.add('pl-card--yours');
    addNode('p-acme', acme, { c: 'cmp' });

    const rogue = card('provider', tall ? 'other' : 'other.compaction', tall ? null : 'second provider');
    rogue.classList.add('pl-card--rogue');
    addNode('p-rogue', rogue, { c: 'cmp' });

    const manifest = el('pre', 'pl-manifest', '');
    manifest.style.width = tall ? '220px' : '400px';
    addNode('manifest', manifest);

    // Wires: provider → socket, socket → consumer
    const mk = (id, from, to, kind) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('pathLength', '1');
      path.setAttribute('class', `pl-wire pl-wire--${kind}`);
      svg.appendChild(path);
      const dots = [0, 1, 2].map(() => {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('r', tall ? '3' : '4.5');
        c.setAttribute('class', 'pl-pulse');
        svg.appendChild(c);
        return c;
      });
      wires.set(id, { id, from, to, path, dots, p: 0, tp: 0, live: false, state: '', phase: Math.random() });
    };
    PROVIDERS.forEach((p) => mk(`w-${p.id}`, p.id, `s-${p.c}`, 'in'));
    mk('w-p-acme', 'p-acme', 's-cmp', 'in');
    mk('w-p-rogue', 'p-rogue', 's-cmp', 'in');
    CONSUMERS.forEach((u) => mk(`w-${u.id}`, `s-${u.c}`, u.id, 'out'));
  }

  // ---------- Positions ----------
  const socketY = (c) => L.sockets[CONTRACTS.findIndex((k) => k.id === c)];
  const home = {
    core: () => [L.core.x, L.core.y],
    duties: () => [L.duties.x, L.duties.y],
    socket: (c) => [L.core.x, socketY(c)],
    provider: (c) => [L.provX, socketY(c)],
    consumer: (c, dy) => [L.consX, socketY(c) + dy * L.consumerSpread],
  };

  function place(id, x, y, o = 1, s = 1, snap = false) {
    const n = nodes.get(id);
    n.tx = x; n.ty = y; n.to = o; n.ts = s;
    if (snap) { n.x = x; n.y = y; n.o = o; n.s = s; }
  }

  function setClass(id, cls, on = true) { nodes.get(id)?.el.classList.toggle(cls, on); }
  function wire(id, p, live, state = '', snap = false) {
    const w = wires.get(id);
    w.tp = p; w.live = live; w.state = state;
    if (snap) w.p = p;
  }

  // ---------- Scene states ----------
  function hideAll(snap) {
    place('core', ...home.core(), 0, 0.96, snap);
    place('duties', ...home.duties(), 0, 1, snap);
    CONTRACTS.forEach((c) => place(`s-${c.id}`, ...home.socket(c.id), 0, 1, snap));
    PROVIDERS.forEach((p) => place(p.id, L.offLeft, socketY(p.c), 0, 1, snap));
    CONSUMERS.forEach((u) => place(u.id, L.offRight, socketY(u.c) + u.dy * L.consumerSpread, 0, 1, snap));
    place('p-acme', L.stage.x, L.H + 120, 0, 1, snap);
    place('p-rogue', L.stage.x, L.H + 120, 0, 1, snap);
    place('manifest', L.manifest.x, L.manifest.y, 0, 1, snap);
    wires.forEach((w) => wire(w.id, 0, false, '', snap));
    nodes.forEach((n) => n.el.classList.remove('is-pending', 'is-ready', 'is-verifying', 'is-verified', 'is-draining', 'is-off', 'is-restarted', 'is-collide', 'is-lit'));
    world.querySelectorAll('.pl-duties li').forEach((li) => li.classList.remove('is-lit'));
    nodes.get('manifest').el.innerHTML = '';
    stage.classList.remove('is-collision');
    setEpoch(7);
  }

  function setEpoch(n) {
    epoch = n;
    const b = world.querySelector('.pl-epoch b');
    if (b) b.textContent = String(n);
  }

  // Instant end-state of a step, used when jumping or with reduced motion
  function endState(step) {
    hideAll(true);
    if (step >= 0) {
      place('core', ...home.core(), 1, 1, true);
      place('duties', ...home.duties(), 1, 1, true);
      world.querySelectorAll('.pl-duties li').forEach((li) => li.classList.add('is-lit'));
    }
    if (step >= 1) CONTRACTS.forEach((c) => place(`s-${c.id}`, ...home.socket(c.id), 1, 1, true));
    if (step >= 2) {
      CONSUMERS.forEach((u) => {
        place(u.id, ...home.consumer(u.c, u.dy), 1, 1, true);
        setClass(u.id, 'is-pending');
        wire(`w-${u.id}`, 1, false, 'pending', true);
      });
      CONTRACTS.forEach((c) => setClass(`s-${c.id}`, 'is-pending'));
    }
    if (step >= 3) {
      PROVIDERS.forEach((p) => {
        place(p.id, ...home.provider(p.c), 1, 1, true);
        setClass(p.id, 'is-verified');
        wire(`w-${p.id}`, 1, true, '', true);
      });
      CONSUMERS.forEach((u) => { setClass(u.id, 'is-pending', false); setClass(u.id, 'is-ready'); wire(`w-${u.id}`, 1, true, '', true); });
      CONTRACTS.forEach((c) => { setClass(`s-${c.id}`, 'is-pending', false); setClass(`s-${c.id}`, 'is-ready'); });
    }
    if (step >= 4) {
      place('p-cmp', L.exitX, socketY('cmp'), 0, 0.96, true);
      wire('w-p-cmp', 0, false, '', true);
      place('p-acme', ...home.provider('cmp'), 1, 1, true);
      setClass('p-acme', 'is-verified');
      wire('w-p-acme', 1, true, '', true);
      setEpoch(8);
    }
  }

  // ---------- Step scripts (run from the previous step's end state) ----------
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));

  const SCRIPTS = [
    // 1 — kernel
    () => {
      at(100, () => place('core', ...home.core(), 1, 1));
      at(500, () => place('duties', ...home.duties(), 1, 1));
      world.querySelectorAll('.pl-duties li').forEach((li, i) => at(800 + i * 170, () => li.classList.add('is-lit')));
    },
    // 2 — contracts
    () => {
      CONTRACTS.forEach((c, i) => at(150 + i * 260, () => {
        const [x, y] = home.socket(c.id);
        place(`s-${c.id}`, x, y + 18, 0, 1, true);
        place(`s-${c.id}`, x, y, 1, 1);
      }));
    },
    // 3 — consumers connect, pending
    () => {
      CONTRACTS.forEach((c) => setClass(`s-${c.id}`, 'is-pending'));
      CONSUMERS.forEach((u, i) => {
        at(150 + i * 240, () => place(u.id, ...home.consumer(u.c, u.dy), 1, 1));
        at(650 + i * 240, () => { wire(`w-${u.id}`, 1, false, 'pending'); setClass(u.id, 'is-pending'); });
      });
    },
    // 4 — providers dock, hash-check, everything turns ready
    () => {
      PROVIDERS.forEach((p, i) => {
        const t = 150 + i * 520;
        at(t, () => place(p.id, ...home.provider(p.c), 1, 1));
        at(t + 520, () => setClass(p.id, 'is-verifying'));
        at(t + 1020, () => { setClass(p.id, 'is-verifying', false); setClass(p.id, 'is-verified'); wire(`w-${p.id}`, 1, true); });
        at(t + 1380, () => {
          setClass(`s-${p.c}`, 'is-pending', false);
          setClass(`s-${p.c}`, 'is-ready');
          CONSUMERS.filter((u) => u.c === p.c).forEach((u) => {
            setClass(u.id, 'is-pending', false);
            setClass(u.id, 'is-ready');
            wire(`w-${u.id}`, 1, true);
          });
        });
      });
    },
    // 5 — your plugin replaces the default
    () => {
      const lines = layoutName === 'tall'
        ? ['{', '  "pluginId": "acme…",', '  "provides":', '    "compaction@1",', '  "sha256": "68199e…"', '}']
        : ['{', '  "pluginId": "acme.compaction",', '  "provides": "cadente.compaction@1",', '  "permissions": ["conversation.read"],', '  "sha256": "68199e89175a…"', '}'];
      const man = nodes.get('manifest').el;
      at(100, () => place('p-acme', L.stage.x, L.stage.y, 1, 1));
      at(500, () => place('manifest', L.manifest.x, L.manifest.y, 1, 1));
      lines.forEach((line, i) => at(700 + i * 180, () => { man.innerHTML += `${escapeHtml(line)}\n`; }));
      at(2000, () => setClass('p-acme', 'is-verifying'));
      at(2700, () => { setClass('p-acme', 'is-verifying', false); setClass('p-acme', 'is-verified'); man.innerHTML += `<span class="pl-ok">${layoutName === 'tall' ? 'verified · locked' : 'hash verified · grants accepted · locked'}</span>`; });
      // switch the default off: drain first
      at(3600, () => { setClass('p-cmp', 'is-off'); wire('w-p-cmp', 1, false, 'off'); });
      at(3900, () => ['u-cman', 'u-cauto'].forEach((id) => { setClass(id, 'is-ready', false); setClass(id, 'is-draining'); wire(`w-${id}`, 1, false, 'pending'); }));
      at(3900, () => { setClass('s-cmp', 'is-ready', false); setClass('s-cmp', 'is-pending'); });
      at(4800, () => { wire('w-p-cmp', 0, false, 'off'); place('p-cmp', L.exitX, socketY('cmp'), 0, 0.96); place('manifest', L.manifest.x, L.manifest.y + 30, 0, 1); });
      at(5300, () => place('p-acme', ...home.provider('cmp'), 1, 1));
      at(6000, () => { wire('w-p-acme', 1, true); setEpoch(8); setClass('s-cmp', 'is-lit'); });
      at(6400, () => {
        setClass('s-cmp', 'is-pending', false);
        setClass('s-cmp', 'is-ready');
        ['u-cman', 'u-cauto'].forEach((id) => { setClass(id, 'is-draining', false); setClass(id, 'is-ready'); setClass(id, 'is-restarted'); wire(`w-${id}`, 1, true); });
      });
      at(7600, () => { setClass('s-cmp', 'is-lit', false); ['u-cman', 'u-cauto'].forEach((id) => setClass(id, 'is-restarted', false)); });
    },
    // 6 — collision
    () => {
      at(100, () => place('p-rogue', L.stage.x, L.stage.y, 1, 1));
      at(900, () => wire('w-p-rogue', 1, false, 'probe'));
      at(1700, () => { setClass('p-rogue', 'is-collide'); setClass('s-cmp', 'is-collide'); wire('w-p-rogue', 1, false, 'refused'); stage.classList.add('is-collision'); nodes.get('p-rogue').shake = 1; });
      at(3300, () => { wire('w-p-rogue', 0, false, 'refused'); stage.classList.remove('is-collision'); setClass('s-cmp', 'is-collide', false); });
      at(3700, () => { place('p-rogue', L.stage.x, L.H + 120, 0, 1); });
      at(4300, () => setClass('p-rogue', 'is-collide', false));
    },
  ];

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------- Playback ----------
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function go(step, { autoplay = true } = {}) {
    clearTimers();
    current = step;
    endState(step - 1);
    if (step === 0) hideAll(true);
    steps.forEach((b, i) => {
      b.style.setProperty('--p', i < step ? '1' : '0');
      b.classList.toggle('is-active', i === step);
      b.classList.toggle('is-done', i < step);
      b.setAttribute('aria-current', i === step ? 'step' : 'false');
    });
    if (caption) caption.textContent = STEP_TEXT[step];
    stepStart = performance.now();
    if (reduceMotion) { endState(step); return; }
    SCRIPTS[step]();
    playing = autoplay;
  }

  function next() {
    if (current < SCRIPTS.length - 1) go(current + 1);
    else {
      // rebuild from nothing: fade the whole graph out, then start again
      nodes.forEach((n) => { n.to = 0; });
      wires.forEach((w) => { w.tp = 0; w.live = false; });
      clearTimers();
      at(900, () => go(0));
      playing = false;
    }
  }

  steps.forEach((b, i) => b.addEventListener('click', () => go(i)));

  // ---------- Render loop ----------
  function bezier(a, b) {
    const dx = Math.max(layoutName === 'tall' ? 6 : 40, Math.abs(b[0] - a[0]) * 0.5);
    return [a, [a[0] + dx, a[1]], [b[0] - dx, b[1]], b];
  }
  function pointAt([p0, p1, p2, p3], t) {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ];
  }

  function anchor(id, side) {
    const n = nodes.get(id);
    const w = n.el.offsetWidth * n.s;
    return [n.x + (side === 'right' ? w / 2 : -w / 2), n.y];
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const k = reduceMotion ? 1 : 1 - Math.pow(0.0009, dt); // ease-out toward targets

    nodes.forEach((n) => {
      n.x += (n.tx - n.x) * k;
      n.y += (n.ty - n.y) * k;
      n.o += (n.to - n.o) * k;
      n.s += (n.ts - n.s) * k;
      let sx = 0;
      if (n.shake > 0.01) { sx = Math.sin(now / 28) * 10 * n.shake; n.shake *= Math.pow(0.04, dt); }
      n.el.style.transform = `translate(${(n.x + sx).toFixed(1)}px, ${n.y.toFixed(1)}px) translate(-50%, -50%) scale(${n.s.toFixed(3)})`;
      n.el.style.opacity = n.o.toFixed(3);
      n.el.style.visibility = n.o < 0.01 ? 'hidden' : 'visible';
    });

    wires.forEach((w) => {
      w.p += (w.tp - w.p) * (reduceMotion ? 1 : 1 - Math.pow(0.004, dt));
      const fromN = nodes.get(w.from), toN = nodes.get(w.to);
      const a = anchor(w.from, 'right');
      const b = anchor(w.to, 'left');
      const curve = bezier(a, b);
      const [p0, p1, p2, p3] = curve;
      w.path.setAttribute('d', `M${p0[0]},${p0[1]} C${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`);
      w.path.style.strokeDasharray = w.state === 'pending' || w.state === 'probe' ? '0.012 0.012' : `${w.p} 1`;
      w.path.style.opacity = (Math.min(fromN.o, toN.o) * (w.p > 0.001 ? 1 : 0)).toFixed(3);
      if (w.state === 'pending' || w.state === 'probe') w.path.style.strokeDashoffset = String(-((now / 4000) % 1));
      else w.path.style.strokeDashoffset = '0';
      w.path.setAttribute('class', `pl-wire${w.live ? ' is-live' : ''}${w.state ? ` is-${w.state}` : ''}`);

      w.dots.forEach((d, i) => {
        if (!w.live || reduceMotion || w.p < 0.98) { d.style.opacity = '0'; return; }
        const t = ((now / 1600) + w.phase + i / w.dots.length) % 1;
        const [x, y] = pointAt(curve, t);
        d.setAttribute('cx', x.toFixed(1));
        d.setAttribute('cy', y.toFixed(1));
        d.style.opacity = String(Math.sin(Math.PI * t).toFixed(3));
      });
    });

    // step progress + autoplay
    if (playing && visible) {
      const p = Math.min((now - stepStart) / STEP_MS[current], 1);
      steps[current]?.style.setProperty('--p', p.toFixed(3));
      if (p >= 1) next();
    }

    requestAnimationFrame(frame);
  }

  // ---------- Fit the world to the stage ----------
  function fit() {
    const name = stage.clientWidth < 640 ? 'tall' : 'wide';
    if (name !== layoutName) {
      layoutName = name;
      L = LAYOUTS[name];
      build();
      if (reduceMotion) go(4);
      else if (started) go(current);
      else hideAll(true);
    }
    const scale = stage.clientWidth / L.W;
    world.style.transform = `scale(${scale})`;
  }

  new ResizeObserver(fit).observe(stage);
  new IntersectionObserver(([e]) => {
    const was = visible;
    visible = e.isIntersecting;
    if (!visible || was || reduceMotion) return;
    if (!started) { started = true; go(0); return; }
    // resume the step's progress where it paused
    stepStart = performance.now() - (parseFloat(steps[current]?.style.getPropertyValue('--p') || 0) * STEP_MS[current]);
  }, { threshold: 0.3 }).observe(stage);

  fit();
  requestAnimationFrame((t) => { last = t; frame(t); });
}
