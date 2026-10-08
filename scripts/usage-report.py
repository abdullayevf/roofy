#!/usr/bin/env python3
"""Where the Claude Code usage went, from local session logs (main + subagents).

  python3 scripts/usage-report.py [--since 2026-10-01]

Dollar figures are list prices used as a stand-in for the plan quota (Anthropic does not publish the
exact quota formula): compare shares and before/after, not absolute numbers. Update PRICES from
https://platform.claude.com/docs/en/about-claude/pricing when models change.
"""
import argparse, collections, glob, json, os
from datetime import datetime

LOGS = os.path.expanduser("~/.claude/projects/-home-admin-roofy")
# $ per million tokens: input, 5-minute cache write, 1-hour cache write, cache read, output
PRICES = {"opus": (4, 5, 8, 0.20, 20), "sonnet": (2, 2.5, 4, 0.20, 10), "haiku": (1, 1.25, 2, 0.10, 5)}
REBUILD_TOKENS = 100_000  # one turn that rewrites at least this much of its own context = a cold restart


def family(model):
    m = (model or "").lower()
    return "opus" if "opus" in m else "haiku" if "haiku" in m else "sonnet"


def load(path):
    turns, seen = [], {}
    for line in open(path, errors="ignore"):
        try:
            d = json.loads(line)
        except ValueError:
            continue
        m = d.get("message")
        if d.get("type") == "assistant" and isinstance(m, dict) and "usage" in m:
            key = m.get("id") or d.get("uuid")
            if key not in seen:
                turns.append(key)
            seen[key] = (m.get("model"), m["usage"], d.get("timestamp") or "")
    return [seen[k] for k in turns]


def price(turns, hint):
    c = collections.Counter()
    prev = None
    for model, u, ts in turns:
        p = PRICES[family(hint if not model or "synthetic" in model else model)]
        cc = u.get("cache_creation") or {}
        w5, w1 = cc.get("ephemeral_5m_input_tokens"), cc.get("ephemeral_1h_input_tokens")
        cw = u.get("cache_creation_input_tokens") or 0
        if w5 is None and w1 is None:
            w5, w1 = 0, cw
        cr, out, inp = u.get("cache_read_input_tokens") or 0, u.get("output_tokens") or 0, u.get("input_tokens") or 0
        usd = (inp * p[0] + (w5 or 0) * p[1] + (w1 or 0) * p[2] + cr * p[3] + out * p[4]) / 1e6
        c["usd"] += usd
        c["turns"] += 1
        if prev and cw >= REBUILD_TOKENS and cw >= 0.8 * (inp + cw + cr):
            c["rebuilds"] += 1
            c["rebuild_usd"] += ((w5 or 0) * p[1] + (w1 or 0) * p[2]) / 1e6
        prev = ts
    return c


def role(meta):
    agent, d, model = meta.get("agentType", ""), meta.get("description", "").lower(), meta.get("model") or "?"
    if agent in ("design-critic", "field-critic"):
        return "critics"
    if agent in ("spec-reviewer", "reviewer") or "review" in d:
        return "reviewers"
    return f"implementers ({model})"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="0000-00-00")
    since = ap.parse_args().since
    roles, runs, day = collections.defaultdict(collections.Counter), [], collections.Counter()
    for mp in glob.glob(LOGS + "/*.jsonl"):
        sid = os.path.basename(mp)[:-6]
        main_turns = [t for t in load(mp) if t[2][:10] >= since]
        c = price(main_turns, "opus")
        roles["conductor (main session)"].update(c)
        for t in main_turns[:1]:
            day[t[2][:10]] += c["usd"]
        for sp in glob.glob(f"{LOGS}/{sid}/subagents/agent-*.jsonl"):
            try:
                meta = json.load(open(sp[:-6] + ".meta.json"))
            except (OSError, ValueError):
                meta = {}
            turns = [t for t in load(sp) if t[2][:10] >= since]
            if not turns:
                continue
            c = price(turns, meta.get("model"))
            roles[role(meta)].update(c)
            runs.append((c["usd"], c["turns"], meta.get("description", "")))
    total = sum(c["usd"] for c in roles.values()) or 1
    print(f"total ${total:,.0f} since {since}")
    for r, c in sorted(roles.items(), key=lambda kv: -kv[1]["usd"]):
        print(f"  {r:28} ${c['usd']:6.0f} {c['usd'] / total:4.0%}  cold restarts {int(c['rebuilds'])} (${c['rebuild_usd']:.0f})")
    print("longest-cost runs:")
    for usd, n, d in sorted(runs, reverse=True)[:5]:
        print(f"  ${usd:5.1f} {n:4d} steps  {d[:70]}")
    long_runs = [r for r in runs if r[1] > 60]
    print(f"runs over 60 steps: {len(long_runs)} costing ${sum(r[0] for r in long_runs):.0f} ({sum(r[0] for r in long_runs) / total:.0%})")


if __name__ == "__main__":
    main()
