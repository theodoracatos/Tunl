# 19.10 - reply to App Review, Guideline 2.1 (ATT request not found)

Rejection 2026-10-15 02:30 UTC, submission 9c823b48-a9d2-4186-8f74-a02973e21fd6, reviewed on iPad Air 11-inch (M3)
and iPhone 17 Pro Max, iPadOS 27.0.1. The reviewer looked for the ATT request at launch; since 19.6 (da47f29) it comes
after the first finished flight, and the App Review notes still said "On first launch" (fixed 2026-10-15 via iris).

Send together with the screen recording (physical device, fresh install). The recording also goes into the App
Review Information attachments for future submissions.

## Reply (Resolution Center)

```
Hello,

Thank you for the review. App Tracking Transparency is implemented, but the permission request does not appear at
launch: TUNL asks once, about one second after the end of the player's first flight (the first crash), on the
results screen. We are sorry that our App Review notes still described an earlier version that asked on first
launch; they are now corrected.

Before the user answers, no tracking takes place. Ads requested before the answer carry no advertising identifier
(IDFA), and nothing is shared with data brokers. If the user declines, the app works normally with non-personalized
ads via Google AdMob.

To see the request on a fresh install:
1. Make sure Settings > Privacy & Security > Tracking > "Allow Apps to Request to Track" is on.
2. Launch TUNL and tap anywhere on the title screen.
3. Press and hold the screen. A short practice flight over the city ends on its own after at most 12 seconds; the
   ship then enters the cave and crashes into its ceiling within a few seconds.
4. About one second after the crash, the system App Tracking Transparency dialog appears.

The attached screen recording, captured on a physical iPhone from a fresh install, shows the launch, the first
flight, the permission request and the flow after it. The same steps are in the App Review Information notes.

Best regards,
Alexandros Theodoracatos
```

## Recording steps (iPhone)

1. Delete TUNL, then reinstall it from the App Store (19.9 asks at the same moment as 19.10). Alternative without
   reinstalling: Settings > General > Transfer or Reset iPhone > Reset > Reset Location & Privacy.
2. Check Settings > Privacy & Security > Tracking > "Allow Apps to Request to Track" is on.
3. Control Center > Screen Recording, start.
4. Open TUNL, tap the title, press and hold until the crash, wait for the dialog, tap "Ask App Not to Track" (or Allow),
   then show the results screen and tap PLAY AGAIN once.
5. Stop the recording and AirDrop it to the Mac (any folder; tell Claude the path).
