#!/usr/bin/env node
// PreToolUse hook (Edit|Write|MultiEdit): before a src/*.js edit, tell the agent which
// docs/agents/*.md files hold the rules for that file. Mirrors the "Which docs to read
// before editing a file" table in CLAUDE.md - keep the two in sync. Never blocks.
const MAP = {
  'update.js':    ['physics', 'fairness', 'hazards', 'coins', 'portal'],
  'systems.js':   ['fairness', 'hazards', 'coins', 'portal'],
  'world.js':     ['difficulty', 'fairness', 'coins'],
  'constants.js': ['the topic of the constant you touch (its doc block names it)'],
  'lifecycle.js': ['fairness', 'onboarding'],
  'state.js':     ['fairness', 'onboarding'],
  'draw.js':      ['ship-render', 'visuals', 'hazards', 'screens', 'share', 'portal', 'economy (pick by the part you edit)'],
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
