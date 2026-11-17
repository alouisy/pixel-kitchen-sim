// Router: ?mode=giant is the Mossback mini-game, everything else is the harbour rush (title screen, level 1).
const mode = new URLSearchParams(location.search).get('mode');
if (mode === 'giant') void import('./mossback.js');
else void import('./rush/rushClient.js');
