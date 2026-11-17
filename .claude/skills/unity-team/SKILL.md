---
name: unity-team
description: Run the Unity Rave four-agent team (Lead, Scout, Maker, Checker) on one request. Use when Andy says "run the Unity team", names a Unity playbook (build, content, sellers, sponsors), or types /unity-team followed by a request.
---

# Unity Rave team

Run one request through four roles in a fixed order, stopping for Andy's approval at set points. Each role is a subagent in `.claude/agents/`. Pass each one only the inputs listed for it. You are the conductor: you pass work along and you stop when told to. You do not do any role's work yourself.

## Before starting

1. Pick the playbook from `playbooks.md` in this folder: build, content, sellers or sponsors. If unclear, ask.
2. Read that playbook's section. If its status is BLOCKED, tell Andy what blocks it and stop. Do not work around a block.
3. Unity only. No Bobsled or Desert Evergreen data, accounts or pricing here.

## Steps

1. **Lead: brief.** Call `unity-lead` (job 1) with the request and the playbook section. Show Andy the brief. STOP until he approves it.
2. **Scout: fact cards.** Call `unity-scout` with the approved brief and the playbook section. For sellers and sponsors, show the cards and STOP so Andy or Mary can pick who to pursue.
3. **Maker: draft.** Call `unity-maker` with the brief, the cards and the playbook section.
4. **Checker: verdict.** Call `unity-checker` with the brief, the cards, the deliverable, the checklist and the round number. On FIX, send the numbered list back to `unity-maker`, then check again. Two FIX rounds maximum, then treat it as ESCALATE. On ESCALATE, show Andy the decision and STOP.
5. **Lead: packet.** Call `unity-lead` (job 2). Show Andy the packet. STOP for approval.

## After approval

- build: only now commit on the working branch and push it, if Andy says to. Never main. Never deploy. A pull request only if he asks for one.
- content: Mary picks and posts. The team posts nothing.
- sellers, sponsors: Andy or Mary sends. The team sends nothing.
- Then add one row to `team/tracker.md` and remind Andy to fill in the outcome later.

## Rules

- Andy approves before anything is sent, published, merged, deployed, deleted or paid for.
- Never ask for passwords, keys or logins. If a source needs a login, ask Andy to pull the data and paste it.
- Each role stays in its lane: Lead does not research or draft, Scout does not write for an audience, Maker adds no facts, Checker does not rewrite.
- One deliverable per run. A second request is a second run.
