# Kore Manual QA Checklist

Use this during manual bug sweeps before release. Check each item, confirm the expected result, and note any bugs directly under the section.

## 1. Onboarding

- [ ] Launch the app as a brand-new user.
  Expected result: The app opens to the landing/auth onboarding entry flow, not Home.
- [ ] Continue through onboarding to completion.
  Expected result: Completing onboarding routes to Home without a blank or stuck screen.
- [ ] Force close and reopen after onboarding is complete.
  Expected result: Onboarding does not appear again unless app state was intentionally reset.

Notes / bugs found:
- 

## 2. Guest Vs Signed-In Auth Flow

- [ ] Continue as guest from auth/landing flow.
  Expected result: Guest can enter the app and reach Home.
- [ ] Close and reopen while still in guest mode.
  Expected result: Guest state persists and returns to the expected screen.
- [ ] Sign in with an existing account.
  Expected result: Signed-in user reaches onboarding or Home depending on completion state.
- [ ] Sign out from Profile.
  Expected result: User state resets and app routes away from signed-in flow.
- [ ] Sign back in after signing out.
  Expected result: Profile, streak, and cloud-backed state reload correctly.

Notes / bugs found:
- 

## 3. Home Screen Recommendation Flow

- [ ] Open Home and verify the main UI renders correctly.
  Expected result: Core controls, question flow, streak UI, and milestone progress appear without layout issues.
- [ ] Use "Surprise me".
  Expected result: App skips question answering and starts recommendation flow.
- [ ] Answer all questions and submit normally.
  Expected result: App transitions to loading/result flow without duplicate taps or stuck state.
- [ ] Verify locked vs unlocked feature buttons at the current streak.
  Expected result: Only unlocked rewards/features are tappable and visible as available.
- [ ] Check milestone progress text and progress bar.
  Expected result: Days remaining and milestone label match the current streak.

Notes / bugs found:
- 

## 4. Result Screen Behavior

- [ ] Trigger a recommendation and observe loading state.
  Expected result: Loading screen appears with no visual break or frozen state.
- [ ] Verify the final result content.
  Expected result: Title, metadata, synopsis/pitch, and streaming info render cleanly.
- [ ] Test error state by using a failed request path if available.
  Expected result: Friendly error text appears and recovery actions are visible.
- [ ] Tap rating controls.
  Expected result: Rating saves once and reflected state updates correctly.
- [ ] Tap "Save for later".
  Expected result: Item saves once and button state reflects success.
- [ ] Use back / try different answers / reroll flow.
  Expected result: Navigation returns to the correct screen and state is sensible.

Notes / bugs found:
- 

## 5. History And Watch Later

- [ ] Open History after generating recommendations.
  Expected result: Recent items appear in expected order.
- [ ] Open a History item.
  Expected result: Detail view opens with the selected anime data.
- [ ] Save an item to Watch Later from Result.
  Expected result: Item appears in Watch Later.
- [ ] Open a Watch Later item.
  Expected result: Detail view opens with the selected anime data.
- [ ] Remove items from Watch Later if the UI allows it.
  Expected result: Removed items no longer appear after refresh/reopen.

Notes / bugs found:
- 

## 6. Profile And Edit Profile

- [ ] Open Profile as guest.
  Expected result: Guest messaging is shown and account creation path is visible.
- [ ] Open Profile while signed in.
  Expected result: Username, display name, streak, and account info render correctly.
- [ ] Open Edit Profile and change editable fields.
  Expected result: Updates save and appear when returning to Profile.
- [ ] Verify favorite genres/preferences UI.
  Expected result: Selection state saves and reappears correctly after navigation/reopen.
- [ ] Toggle dark mode if available.
  Expected result: Theme updates correctly and persists after reopen.

Notes / bugs found:
- 

## 7. Milestones And Unlocks

- [ ] Reach or simulate a new milestone threshold.
  Expected result: Milestone celebration appears at the correct unlock point.
- [ ] Continue from milestone celebration for each available reward type encountered.
  Expected result: The app routes to the correct reward screen or follow-up flow.
- [ ] Reopen after claiming a milestone.
  Expected result: Already-seen milestones do not immediately retrigger.
- [ ] Verify milestone-related buttons on Home/Profile.
  Expected result: Unlock state is consistent across screens.

Notes / bugs found:
- 

## 8. Era Lock

- [ ] Check Era Lock before it is unlocked.
  Expected result: It appears locked with correct unlock messaging.
- [ ] Check Era Lock after unlocking.
  Expected result: It is accessible and shows current state clearly.
- [ ] Activate an era and generate a recommendation.
  Expected result: Flow works without navigation or state issues.
- [ ] Turn Era Lock off or change eras.
  Expected result: New state persists correctly across navigation/reopen.

Notes / bugs found:
- 

## 9. Offline / Refresh / Reopen Behavior

- [ ] Put the device/browser offline while using the app.
  Expected result: Offline message appears and app fails gracefully.
- [ ] Reconnect after being offline.
  Expected result: App recovers without requiring a full reset unless expected.
- [ ] Refresh/reload during Home, Result, and Profile flows.
  Expected result: App rehydrates to a sensible screen and does not show corrupt state.
- [ ] Force close and reopen after saving ratings, watch later items, preferences, and streak updates.
  Expected result: Persisted state matches the last successful action.

Notes / bugs found:
- 

## 10. Regression Checklist Before Release

- [ ] Brand-new user can enter the app successfully.
  Expected result: Landing/auth/onboarding flow is intact.
- [ ] Guest user can complete a recommendation flow.
  Expected result: Home -> Result -> History/Watch Later works.
- [ ] Signed-in user can complete a recommendation flow.
  Expected result: Profile/state loads correctly and recommendation flow still works.
- [ ] Ratings, Watch Later, and History behave correctly after repeated use.
  Expected result: No duplicate, stale, or obviously missing data.
- [ ] Milestone/unlock routing still works.
  Expected result: Correct reward screen opens from celebration flow.
- [ ] Profile, Edit Profile, and Era Lock open without visual or navigation regressions.
  Expected result: No stuck transitions, blank screens, or missing data.
- [ ] Dark mode and persisted preferences survive reopen.
  Expected result: Last saved preference state is restored.
- [ ] Final pass for visual issues on target devices/sizes.
  Expected result: No broken spacing, clipped text, invisible buttons, or overlapping elements.

Notes / bugs found:
- 
