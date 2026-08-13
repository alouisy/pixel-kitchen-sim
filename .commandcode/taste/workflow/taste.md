# Workflow

- Prefers the agent not to spend tokens running/testing the app when the user has already verified it; focus effort on reading and analyzing code instead. Confidence: 0.9
- Prefers to do testing manually themselves rather than the agent running automated/headless browser tests; when verification is needed, just start the dev server and hand over the URL so the user can check visually. Confidence: 0.95
- Wary of the agent touching or deleting user-local data (e.g. the Chrome cache/profile) and of reckless actions with side effects; prefers a non-invasive approach that leaves their environment untouched. Confidence: 0.9
- Wants the agent to make minimal, targeted changes and to revert anything that breaks existing functionality or drifts from the established design (e.g., removing an injected font link, restoring original label styling) rather than layering on more changes. Confidence: 0.85
- When a reported fix keeps not matching the request (e.g., the new font still applied to the whole UI after claiming it was label-only), expects the agent to pause, re-analyze the root cause, and verify the actual rendered effect before claiming success; visibly repeating the same wrong fix is strongly disliked ("tu es en train de boucler et ne pas faire ce que je te demande"). Confidence: 0.75
