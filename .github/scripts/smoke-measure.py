#!/usr/bin/env python3
"""ADR 0081 P1, P2, P4, P5 and P6, and D3: reads `cadente-core --measure`, adds the energy that
powermetrics saw on macOS, writes the job summary and fails the job when a measurement leaves
its limit.

usage: smoke-measure.py <measure output> <final report> <target> [powermetrics plist]

P6 reads two more lists of `--measure` outputs, comma-separated, from the environment: P6_BETA
(the last published beta) and P6_NEW (this version), measured alternately on this runner after
the full run (B A A B A B B A). The first `--measure` on a runner is cold: in an A/A test of the same
code (diag-p5, run 41518156298) it spent 359 ms/s of CPU in the script and the next five 740 to
868. Zed's gpui-bench skill (`.agents/skills/gpui-bench/SKILL.md`): do not compare a cold
baseline with a warm candidate, and alternate baseline and candidate runs when results are noisy.

Each output has one JSON line per finished state and the whole report last; a run that never
finished still shows the states it measured.
"""
import json
import os
import plistlib
import sys

out, final, target = sys.argv[1], sys.argv[2], sys.argv[3]
power = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else None
system = os.environ.get("RUNNER_OS", "?")
summary = open(os.environ.get("GITHUB_STEP_SUMMARY", os.devnull), "a", encoding="utf-8")
# The Windows runner's console is cp1252; the errors below carry Portuguese.
sys.stdout.reconfigure(encoding="utf-8")


def read(path):
    if not path or not os.path.exists(path):
        return None, []
    lines = []
    for line in open(path, encoding="utf-8", errors="replace"):
        if line.strip().startswith("{"):
            try:
                lines.append(json.loads(line))
            except ValueError:
                continue
    report = next((line for line in reversed(lines) if "states" in line), None)
    return report, (report["states"] if report else [line for line in lines if "state" in line])


def paths(var):
    return [p for p in os.environ.get(var, "").split(",") if p]


report, states = read(out)
p6 = {name: [read(p) for p in paths(var)] for name, var in (("beta", "P6_BETA"), ("new", "P6_NEW"))}

# powermetrics: one plist per sample, NUL-separated; each task line has the energy impact per
# second of its interval. A sample counts for a state when it lies inside it.
samples = []
if power and os.path.exists(power):
    at = float(open(power + ".start").read().strip())
    for chunk in open(power, "rb").read().split(b"\0"):
        chunk = chunk.strip()
        if not chunk:
            continue
        try:
            sample = plistlib.loads(chunk)
        except Exception:
            continue
        seconds = sample.get("elapsed_ns", 0) / 1e9
        at += seconds * 1000
        tasks = {task.get("pid"): task for task in sample.get("tasks", [])}
        samples.append((at - seconds * 1000, at, seconds, tasks))


def energy(which, which_states):
    if not samples or not which:
        return
    pid = which.get("pid")
    for state in which_states:
        inside = [s for s in samples if s[0] >= state["startMs"] - 200 and s[1] <= state["endMs"] + 200]
        span = sum(s[2] for s in inside)
        total = 0.0
        for _, _, seconds, tasks in inside:
            task = tasks.get(pid) or {}
            total += task.get("energy_impact_per_s", task.get("energy_impact", 0.0)) * seconds
        state["energyImpact"] = round(total, 2)
        state["energyImpactPerS"] = round(total / span, 3) if span else None
    which["powermetricsSamples"] = len(samples)


energy(report, states)
for runs in p6.values():
    for which, which_states in runs:
        energy(which, which_states)

if report:
    json.dump(report, open(final, "w"))

summary.write(f"### {system} ({target})\n\n")
if not report:
    summary.write("O `--measure` não terminou; estados medidos até parar:\n\n")
summary.write("| estado | s | quadros | CPU % | despertares/s | memória MB | energia/s |\n")
summary.write("|---|---|---|---|---|---|---|\n")
for state in states:
    value = state.get("energyImpactPerS")
    if value is None and state.get("energyNj"):
        value = f"{state['energyNj'] / state['seconds'] / 1e6:.2f} mJ"
    summary.write(
        f"| {state['state']} | {state['seconds']} | {state['frames']} | {state['cpuPercent']} | "
        f"{state.get('wakeupsPerSecond')} | {state.get('footprintKib', state['rssKib']) / 1024:.1f} | "
        f"{value if value is not None else '—'} |\n"
    )

failures = []
if not report:
    failures.append("D3: o `--measure` não terminou com o relatório")
else:
    frames, cpu = report.get("drawnFrames", 0), report["frameCpuMs"]
    churn, memory = report.get("churn") or {}, report.get("memoryKib") or {}
    limit = report["budget"]["cpuP99MaxMs"]
    summary.write(
        f"\nQuadro p50 {cpu.get('p50')} ms, p95 {cpu.get('p95')} ms, p99 {cpu.get('p99')} ms "
        f"(limite {limit} ms, {cpu.get('n')} quadros do roteiro); memória aberta "
        f"{memory.get('windowOpen')} KiB, antes de fechar {memory.get('beforeClose')} KiB, destruída "
        f"{memory.get('windowClosed')} KiB; {churn.get('chats')} Chats e {churn.get('terminals')} "
        f"terminais, {churn.get('cycles')} vezes: o primeiro ciclo (aquecimento) "
        f"{churn.get('firstCycleGrowthPercent')}%, os outros de {churn.get('baseKib')} a "
        f"{churn.get('afterKib')} KiB (tolerância {churn.get('tolerancePercent')}% por ciclo).\n"
    )
    if "tray" in report:
        summary.write(f"\nBandeja: `{json.dumps(report['tray'], ensure_ascii=False)}`\n")
    slowest = report.get("slowestFrames") or []
    if slowest:
        summary.write(
            "\nQuadros mais caros do roteiro (ms, depois de qual passo e quantos ms depois dele): "
            + "; ".join(f"{f['ms']} ({f.get('after')}, +{f.get('sinceStepMs')})" for f in slowest)
            + "\n"
        )
        # P2: the part of each that instantiated repeaters, and the Rust step before it.
        summary.write(
            f"\nInstanciar repeaters por quadro: `{json.dumps(report.get('instantiateMs'))}`; passo do "
            f"roteiro em Rust: `{json.dumps(report.get('stepMs'))}`; dos mais caros (instanciar/passo): "
            + "; ".join(f"{f['ms']} ({f.get('instantiateMs')}/{f.get('stepMs')})" for f in slowest)
            + "\n"
        )
    if system == "macOS":
        # D1: the installed app opens with its icon in the menu bar and the base entries.
        tray = report.get("tray") or {}
        base = [line.get("id") for line in tray.get("menu", []) if isinstance(line, dict)]
        wanted = ["cadente.tray.open", "cadente.tray.launcher", "cadente.tray.quit"]
        if not tray.get("created") or not tray.get("placed") or any(w not in base for w in wanted):
            failures.append(f"D1: a bandeja não está na barra com a base: {tray}")
    if frames <= 0:
        failures.append("D3: nenhum quadro desenhado")
    if report.get("closedQuiet") is not True:
        failures.append("P4: a janela destruída passou de 1% de CPU ou abriu processo filho")
    if report.get("closedBelowOpen") is not True:
        failures.append("P5: a memória com a janela destruída não ficou abaixo da aberta")
    summary.write(
        f"\nP5 por ciclo depois do aquecimento: {churn.get('cycleGrowthPercent')}% (média "
        f"{churn.get('growthPercent')}%, ponta de baixo do intervalo de 95% "
        f"{churn.get('growthLowPercent')}%); memória ao fim de cada um: {churn.get('endsKib')} KiB.\n"
    )
    if churn.get("pass") is not True:
        failures.append(
            f"P5: cada ciclo de sessões cresceu {churn.get('cycleGrowthPercent')}%, e o intervalo de "
            f"95% da média começa em {churn.get('growthLowPercent')}% (> 5%)"
        )

# P6: energy (CPU time where the runner has no energy counter) of each state, per second: the
# mean of this version's runs against the mean of the last beta's, measured alternately here.
# Two runs of each were noise: the code of beta 9 measured against beta 9 itself spent +15.6% of
# CPU in the script on Windows (run 41576090561). As Criterion decides a change
# (`report.rs`, `compare_to_threshold`), a state regresses only when the whole 95% interval of
# the change lies above the 10% limit, from four runs of each (Zed's gpui-bench skill: more
# alternated runs when results are noisy).
# A difference below the noise of an idle state is not a regression either: 5 ms of CPU per second
# (0.5% of one core), or the energy of that CPU, 0.5 energy impact per second (on the macOS
# runner one energy impact per second went with 10 ms/s of CPU in the script: 17.6 with 174.2,
# 24.1 with 236.8, 14.4 with 143.7, run 41524827131). The 0.05 used before was below what the
# same code varies in a 10 s idle state there (closed: 0.017 and 0.176 in the same run).
# The noise floor of a state measured by A/A runs (the same code as beta and as this version),
# where it is above the floors above. On the macOS runner the open idle window is at 0.02 to
# 0.3 or at 1.0 to 2.3 energy/s for the same code, the second while the 60 ms pulse is woken again
# (`pulseTicks`), and four runs of each side differed by up to 0.635 (A/A, run 41583510591) and
# 0.762 (beta 10 against the next commit, run 41589279580). The closed window stays below 0.3, so
# a version that spends 8 ms/s more still fails there (+0.82, run 41584087538).
AA_FLOOR = {("macOS", "idleOpen", "energia/s"): 1.0}

beta_runs = [states for which, states in p6["beta"] if which]
new_runs = [states for which, states in p6["new"] if which]


def resample_means(values):
    """The mean of every resample (with replacement) of `values`: n**n of them, exact."""
    means = [0.0]
    for _ in values:
        means = [m + v for m in means for v in values]
    return [m / len(values) for m in means]


def change_interval(old, new):
    """The 95% interval of new's mean over old's, in percent, by Criterion's percentile bootstrap
    of a change (`analysis/compare.rs`, `stats`: a.mean() / b.mean() - 1), every resample
    enumerated so the same runs give the same verdict."""
    olds, news = resample_means(old), resample_means(new)
    changes = sorted(
        (n / o - 1) * 100 if o else (0.0 if n == 0 else float("inf")) for o in olds for n in news
    )
    at = lambda q: changes[int((len(changes) - 1) * q)]
    return at(0.025), at(0.975)


if beta_runs and new_runs:
    version = next((which.get("version") for which, _ in p6["beta"] if which and which.get("version")), "publicada")
    summary.write(
        f"\nÚltima beta ({version}) contra esta versão no mesmo runner, depois de uma rodada de "
        f"aquecimento, alternadas ({len(beta_runs)} e {len(new_runs)} rodadas; média por estado):\n\n"
    )
    summary.write(
        "| estado | métrica | última beta | esta versão | diferença | intervalo de 95% |\n|---|---|---|---|---|---|\n"
    )

    def per_second(runs, name):
        found = [s for run in runs for s in run if s["state"] == name]
        if not found:
            return None, None
        energies = [s.get("energyImpactPerS") for s in found]
        cpu = sum(s["cpuMs"] / s["seconds"] for s in found) / len(found)
        if all(e is not None for e in energies):
            return sum(energies) / len(energies), cpu
        return None, cpu

    def runs_of(runs, name):
        return [
            (round(s["cpuMs"] / s["seconds"], 1), s.get("energyImpactPerS"))
            for run in runs for s in run if s["state"] == name
        ]

    for name in ("script", "idleOpen", "closed"):
        old_energy, old_cpu = per_second(beta_runs, name)
        new_energy, new_cpu = per_second(new_runs, name)
        if old_cpu is None or new_cpu is None:
            failures.append(f"P6: o estado {name} faltou numa das medições")
            continue
        if old_energy is not None and new_energy is not None:
            metric, prev, new, floor = "energia/s", old_energy, new_energy, 0.5
        else:
            metric, prev, new, floor = "CPU ms/s", old_cpu, new_cpu, 5.0
        floor = max(floor, AA_FLOOR.get((system, name, metric), 0.0))
        change = (new / prev - 1) * 100 if prev else 0.0
        index = 1 if metric == "energia/s" else 0
        low, high = change_interval(
            [run[index] for run in runs_of(beta_runs, name)], [run[index] for run in runs_of(new_runs, name)]
        )
        row = f"| {name} | {metric} | {prev:.3f} | {new:.3f} | {change:+.1f}% | {low:+.1f}% a {high:+.1f}% |"
        summary.write(row + "\n")
        print(f"P6 {row} beta {runs_of(beta_runs, name)} esta {runs_of(new_runs, name)}")
        if low > 10.0 and new - prev > floor:
            failures.append(
                f"P6: {name} gasta {change:+.1f}% de {metric} acima da última beta, e o intervalo de 95% "
                f"começa em {low:+.1f}%"
            )
elif report:
    summary.write("\nSem medição da última beta neste runner: o P6 não comparou.\n")

# P2 diagnosis (not a gate): the other renderers on this runner, same script.
diag = [item.split("=", 1) for item in os.environ.get("P2_DIAG", "").split(",") if "=" in item]
if diag and report:
    summary.write("\nDiagnóstico do P2, mesmo roteiro com outro renderizador (`SLINT_BACKEND`):\n\n")
    summary.write("| renderizador | quadros | p50 ms | p95 ms | p99 ms | memória no roteiro MB |\n|---|---|---|---|---|---|\n")
    rows = [("produção", report, states)] + [(name, *read(path)) for name, path in diag]
    for name, which, which_states in rows:
        if not which:
            summary.write(f"| {name} | não terminou | | | | |\n")
            continue
        cpu = which.get("frameCpuMs") or {}
        script = next((s for s in which_states if s["state"] == "script"), {})
        memory = script.get("footprintKib", script.get("rssKib", 0)) / 1024
        row = f"| {name} | {cpu.get('n')} | {cpu.get('p50')} | {cpu.get('p95')} | {cpu.get('p99')} | {memory:.1f} |"
        summary.write(row + "\n")
        print(f"P2 {row} mais caros {[(f['ms'], f.get('after')) for f in (which.get('slowestFrames') or [])[:6]]}")

for failure in failures:
    print(f"::error::{failure}")
    summary.write(f"\n**Reprovado:** {failure}\n")
sys.exit(1 if failures else 0)
