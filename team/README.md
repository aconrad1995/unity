# Unity Rave AI team

Four agents that take one request at a time and stop for Andy's approval.

| Role | Owns | File |
| --- | --- | --- |
| Lead | The brief at the start, the packet at the end | `.claude/agents/unity-lead.md` |
| Scout | Sourced fact cards | `.claude/agents/unity-scout.md` |
| Maker | The one deliverable | `.claude/agents/unity-maker.md` |
| Checker | One verdict: PASS, FIX or ESCALATE | `.claude/agents/unity-checker.md` |

## How to run it

Open this repo in Claude Code and type:

```
/unity-team build: <what you want changed>
```

Playbooks and their status are in `.claude/skills/unity-team/playbooks.md`. Today `build` is live, `content` is a dry run, and `sellers` and `sponsors` are blocked until the app is hosted and Mary sets sponsor price and terms.

## Where it stops for you

1. After the brief.
2. After the fact cards, for sellers and sponsors only.
3. On ESCALATE.
4. After the packet, before anything is committed, sent or posted.

Log each run in `team/tracker.md`.
