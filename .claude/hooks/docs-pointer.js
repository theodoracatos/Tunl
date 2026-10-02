#!/usr/bin/env node
// PreToolUse hook (Edit|Write|MultiEdit): before a src/*.js edit, tell the agent which
// docs/agents/*.md files hold the rules for that file. This MAP is the list (CLAUDE.md
// "Which docs to read before editing a file" points here instead of copying it). Never blocks.
const MAP = {
  'update.js':    ['physics', 'fairness', 'hazards', 'coins', 'portal', 'frenzy'],
  'systems.js':   ['fairness', 'hazards', 'coins', 'portal', 'frenzy'],
  'world.js':     ['difficulty', 'fairness', 'coins'],
  'constants.js': ['the topic of the constant you touch (its doc block names it)'],
  'lifecycle.js': ['fairness', 'onboarding'],
  'state.js':     ['fairness', 'onboarding'],
  'draw.js':      ['docs/agents/ by the part you edit - ship / 3D hull: ship-render + economy; walls, HUD, title, depth light, portal ring: visuals + hazards (crystals) + portal; death screen, freeze frame: screens + share'],
  'paint.js':     ['economy', 'ship-render'],
  'share.js':     ['share'],
  'approach.js':  ['onboarding'],
  'audio.js':     ['audio'],
  'input.js':     ['screens', 'README (hard rules)'],
  'ads-web.js':   ['economy'],
  'main.js':      ['economy', 'visuals'],
  'fonts.js':     ['visuals'],
};
const EXTRA = {
  'systems.js': ' Run test-cave.js after touching any maintain*()/make*().',
  'world.js':   ' Run test-cave.js after touching a difficulty curve.',
};

let raw = '';
process.stdin.on('data', d => (raw += d));
process.stdin.on('end', () => {
  let f = '';
  try { f = (JSON.parse(raw).tool_input || {}).file_path || ''; } catch (e) { return; }
  const m = f.match(/(?:^|\/)src\/([^/]+\.js)$/);
  if (!m || !MAP[m[1]]) return;
  const docs = MAP[m[1]].map(d => /^[a-z-]+$/.test(d) ? `docs/agents/${d}.md` : d).join(', ');
  const msg = `Editing src/${m[1]}: if not read yet this session, read ${docs} first.` + (EXTRA[m[1]] || '');
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: msg },
  }));
});
