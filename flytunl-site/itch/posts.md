# itch.io posts (2026-10-16)

Drafted for the user to post; Claude does not post on itch. No stat numbers for gated
systems (feedback_marketing_no_stat_numbers).

## 1. Community > Release Announcements (one thread per game)

Title:

    TUNL: Fighter Jet Arcade - one button, one cave, and the whole world flies it today

Body:

    Hi! I make TUNL on my own, and it is now playable in the browser here on itch.

    Tap to hop, hold to climb, let go to fall. Every day there is one cave for everybody:
    same walls, same mines, same coins. At midnight UTC it turns into a new one.

    What's in it:
    - Today's top 10 with pilot names
    - A star mode that smashes through everything, plus lasers, bombs, shields and magnets
    - 8 ships to unlock, each with its own feel
    - Keyboard, mouse or touch, in 16 languages

    It starts easy and gets mean the deeper you go. I'd love to hear where it gets too hard
    for you, or what you score today.

    Play: https://tunl.itch.io/tunl

## 2. Devlog on the TUNL page (Devlog tab > Create a devlog post)

Title:

    How every player gets the same daily cave, built from nothing but the date

Type: Tech Discussion, tags procedural-generation, game-design, javascript, leaderboard; cover
`devlog-cover.jpg` (make-cover.py); a flight screenshot embedded after the first paragraph. Body:

    Every player of TUNL flies the same cave on the same day, and at midnight UTC it becomes
    a different one. There is no level file behind that. No server hands out a map and the
    game never stores the tunnel it just flew through.

    The cave is a function of the date. Ask it for any point of the tunnel, near or far, and
    it answers at once, identically on every phone and browser, without building anything in
    between. The shape comes from two overlapping waves: a slow wide arc and a faster ripple,
    so long stretches never quite repeat. The corridor starts as an open hall and narrows
    slowly the deeper you get.

    That one rule buys a lot: a fair daily leaderboard, because nobody gets an easier cave;
    a ghost of your best run that costs a few hundred bytes; and a link you can send a friend
    so they race exactly your cave.

    The rule underneath is strict: where an object goes may depend on its place in the cave
    and the day, and on nothing else. Not your screen size, not your score, not a power-up.
    Break it and nothing crashes, the cave just quietly stops being the same cave. I broke it
    twice. The first time, obstacle spacing read the difficulty at the player's position
    instead of where the obstacle sat, and six devices flew six different caves.
    The full story, with the code: https://flytunl.ch/devlog/daily-cave/

    Today's cave is waiting: tap to hop, hold to climb, and see where you land on the top 10.
