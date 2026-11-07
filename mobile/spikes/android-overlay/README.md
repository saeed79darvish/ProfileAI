# Cue Android test (Phase 0, throwaway)

A small native app that answers the risky questions before we build Cue's Android bubble.
Answers are fixed test text: no AI, no network, nothing leaves the phone. Delete this folder once the findings are written down.

## What it tests

| Question | How the app measures it |
| --- | --- |
| Can a bubble read the question on another app's screen? | Tap the bubble: it captures one frame, reads it on the phone (ML Kit), shows the questions it found |
| How fast is tap to result? | Logged on every tap: capture ms, text ms, total |
| How often does Android ask for screen capture consent? | Counted on every Start; logged when the system ends a session (lock screen, status bar chip) |
| Which apps block capture? | Black frames are flagged as `FLAG_SECURE` in the log |
| How do we get the answer into the app? | Three buttons on the panel: **A** copy and paste, **B** type it in through accessibility, **C** the Cue keyboard |
| Is accessibility a better way to read? | "Read via accessibility" reads the app's text tree instead of the screenshot |

## Run it

Needs JDK 17 and the Android SDK (platform 35). From this folder:

```bash
gradle wrapper --gradle-version 8.10.2   # once, creates ./gradlew
./gradlew installDebug                   # with a phone (USB debugging) or emulator connected
```

On the phone: open **Cue spike**, do steps 1 and 2, then open a real app (a dating app, a marketplace listing, a form in Chrome) and tap the bubble. Turn on steps 3 and 4 to try insert methods B and C. Use **Share** on the log to send findings.

## Findings

### Run 1: emulator, 2026-11-06

Pixel 7 emulator, Android 15 (API 35), software graphics on an Intel Mac, so timings are slower than a real phone. The target was a made-up dating profile page in Chrome ("Sam, 29", two prompts, a comment box).

| App | Read OK? | Tap to result | Blocks capture? | A copy | B type | C keyboard | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Chrome, test profile page | Yes, the question ranked first on most taps | 1.1–3.4 s (capture 0.1–1.2 s, text 0.8–2.0 s) | No | Works | Works, 0.1 s (after a fix) | Works | Address bar text also gets read |

What we learned:

1. **Reading another app works.** The bubble floats over Chrome, hides itself, captures the screen, and finds the prompt on the phone. The raw text includes noise, like the address bar, so the real app needs the model to pick the question.
2. **The consent prompt defaults to "A single app".** Cue needs "Entire screen", so the person must change a dropdown before tapping Start. Onboarding has to show this step.
3. **Consent is asked again every time the bubble restarts,** including after every app update and every restart of the phone. We saw 3 prompts in one session. The real app should keep the bubble alive and explain why the prompt comes back.
4. **Android shows a screen-sharing icon in the status bar the whole time.** Users will see it, so the copy should say why.
5. **Method A (copy) always works,** but costs a long-press and a tap on Paste.
6. **Method B (accessibility) is the best experience:** instant, no extra taps. Browsers report their container as focused, though, so the code has to search inside the page for the focused editable field. The first version failed with "focused view is not editable" until that search was added.
7. **Method C (keyboard) works, but the bubble cannot open the keyboard picker.** Android ignores `showInputMethodPicker` from an overlay, so the person has to tap the keyboard-switch icon themselves. The keyboard sees the text already in the field, but not the field's label or placeholder in Chrome (`hint=null`). The iPhone keyboard will have the same limit.
8. **The answer panel covered the field it was answering.** The real panel must sit above the field, or collapse when pasting.
9. **Hiding the bubble before capture needs more time on slow phones.** 180 ms sometimes left the edge of the bubble in the frame and cut "date?" to "dat". Wait for a fresh frame instead of a fixed delay.

Still to test, on a real phone:
- Real dating apps, for FLAG_SECURE black frames and for how editable fields are exposed.
- Real timings.
- How often Android ends the capture session on its own, for example on lock.

Decisions this should settle:
1. Screen capture only, or also apply for accessibility on Google Play?
2. Default insert method at launch.
3. Whether consent friction (prompts per day) is acceptable.
