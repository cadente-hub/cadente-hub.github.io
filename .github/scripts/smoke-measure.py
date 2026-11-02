#!/usr/bin/env python3
"""ADR 0081 P1, P4, P5 and P6: reads `cadente-core --measure`, adds the energy that powermetrics
saw on macOS, writes the job summary and fails the job when a measurement leaves its limit.

usage: smoke-measure.py <measure output> <final report> <target> [powermetrics plist] [beta dir]

The measure output has one JSON line per finished state and the whole report last; a run that
never finished (the Windows runner that does not draw, D3) still shows the states it measured.
"""
import json
import os
import plistlib
import sys

out, final, target = sys.argv[1], sys.argv[2], sys.argv[3]
power = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else None
beta_dir = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] else None
system = os.environ.get("RUNNER_OS", "?")
summary = open(os.environ.get("GITHUB_STEP_SUMMARY", os.devnull), "a")

lines = [json.loads(line) for line in open(out) if line.strip().startswith("{")]
report = next((line for line in reversed(lines) if "states" in line), None)
states = report["states"] if report else [line for line in lines if "state" in line]

# powermetrics: one plist per sample, NUL-separated; each task line has the energy impact per
# second of its interval. A sample counts for the state its end falls in.
if power and report and os.path.exists(power):
    raw = open(power, "rb").read()
    start_ms = float(open(power + ".start").read().strip())
    pid = report.get("pid")
    at = start_ms
    samples = []
    for chunk in raw.split(b"\0"):
        chunk = chunk.strip()
        if not chunk:
            continue
        try:
            sample = plistlib.loads(chunk)
        except Exception:
            continue
        seconds = sample.get("elapsed_ns", 0) / 1e9
        at += seconds * 1000
        impact = 0.0
        for task in sample.get("tasks", []):
            if task.get("pid") == pid or task.get("name") == "cadente-core":
                impact += task.get("energy_impact_per_s", task.get("energy_impact", 0.0)) * seconds
        samples.append((at, seconds, impact))
    for state in states:
        inside = [s for s in samples if state["startMs"] < s[0] <= state["endMs"] + 500]
        span = sum(s[1] for s in inside)
        state["energyImpact"] = round(sum(s[2] for s in inside), 2)
        state["energyImpactPerS"] = round(state["energyImpact"] / span, 3) if span else None
    report["powermetricsSamples"] = len(samples)

if report:
    json.dump(report, open(final, "w"))

summary.write(f"### {system} ({target})\n\n")
if not report:
    summary.write("O `--measure` não terminou; estados medidos até parar:\n\n")
summary.write("| estado | s | quadros | CPU % | despertares/s | memória MB | energia/s |\n")
summary.write("|---|---|---|---|---|---|---|\n")
for state in states:
    energy = state.get("energyImpactPerS")
    if energy is None and state.get("energyNj"):
        energy = f"{state['energyNj'] / state['seconds'] / 1e6:.2f} mJ"
    summary.write(
        f"| {state['state']} | {state['seconds']} | {state['frames']} | {state['cpuPercent']} | "
        f"{state.get('wakeupsPerSecond')} | {state.get('footprintKib', state['rssKib']) / 1024:.1f} | "
        f"{energy if energy is not None else '—'} |\n"
    )

failures = []
if report:
    frames, cpu = report.get("drawnFrames", 0), report["frameCpuMs"]
    churn, memory = report.get("churn") or {}, report.get("memoryKib") or {}
    summary.write(
        f"\nQuadro p99 {cpu.get('p99')} ms (limite {report['budget']['cpuP99MaxMs']} ms, "
        f"pass={report['pass']}); memória aberta {memory.get('windowOpen')} KiB, antes de fechar "
        f"{memory.get('beforeClose')} KiB, destruída {memory.get('windowClosed')} KiB; "
        f"{churn.get('chats')} Chats e {churn.get('terminals')} terminais: "
        f"{churn.get('baseKib')} → {churn.get('afterKib')} KiB ({churn.get('growthPercent')}%, "
        f"tolerância {churn.get('tolerancePercent')}%).\n"
    )
    if "tray" in report:
        summary.write(f"\nBandeja: `{json.dumps(report['tray'], ensure_ascii=False)}`\n")
    if system == "macOS":
        # D1: the installed app opens with its icon in the menu bar and the base entries.
        tray = report.get("tray") or {}
        base = [line.get("id") for line in tray.get("menu", []) if isinstance(line, dict)]
        wanted = ["cadente.tray.open", "cadente.tray.launcher", "cadente.tray.quit"]
        if not tray.get("created") or not tray.get("placed") or any(w not in base for w in wanted):
            failures.append(f"D1: a bandeja não está na barra com a base: {tray}")
    if frames <= 0:
        failures.append(f"nenhum quadro desenhado: {report}")
    if report.get("closedQuiet") is not True:
        failures.append("P4: a janela destruída passou de 1% de CPU ou abriu processo filho")
    if report.get("closedBelowOpen") is not True:
        failures.append("P5: a memória com a janela destruída não ficou abaixo da aberta")
    if churn.get("pass") is not True:
        failures.append(f"P5: abrir e fechar sessões cresceu {churn.get('growthPercent')}% (> 5%)")

# P6: energy (CPU time where the runner has no energy counter) of each state, per second,
# against the last published beta. A difference below the noise of an idle state is not a
# regression: 0.05 energy impact per second, or 5 ms of CPU per second (0.5% of one core).
beta = None
if beta_dir:
    path = os.path.join(beta_dir, f"measure-{target}.json")
    if os.path.exists(path):
        beta = json.load(open(path))
if report and beta:
    old = {s["state"]: s for s in beta.get("states", [])}
    summary.write("\n| estado | métrica | última beta | esta versão | diferença |\n|---|---|---|---|---|\n")
    for state in states:
        before = old.get(state["state"])
        if not before:
            continue
        if state.get("energyImpactPerS") is not None and before.get("energyImpactPerS") is not None:
            name, new, prev, floor = "energia/s", state["energyImpactPerS"], before["energyImpactPerS"], 0.05
        else:
            name = "CPU ms/s"
            new = state["cpuMs"] / state["seconds"]
            prev = before["cpuMs"] / before["seconds"]
            floor = 5.0
        change = (new / prev - 1) * 100 if prev else 0.0
        summary.write(f"| {state['state']} | {name} | {prev:.3f} | {new:.3f} | {change:+.1f}% |\n")
        if new > prev * 1.10 and new - prev > floor:
            failures.append(f"P6: {state['state']} gasta {change:+.1f}% de {name} acima da última beta")
elif report:
    summary.write("\nSem medição da última beta: esta fica como base do P6.\n")

for failure in failures:
    print(f"::error::{failure}")
    summary.write(f"\n**Reprovado:** {failure}\n")
sys.exit(1 if failures else 0)
