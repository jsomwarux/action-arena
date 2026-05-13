

--- PAGE 1 ---

Action Arena — Complete Test Plan (Updated)
Setup Before Testing
Test Accounts
Create 4 test accounts in the app. Use simple credentials you can remember:
Account Email Password Purpose
Player 1 test1@actionarena.com test1234 Your primary testing account
Player 2 test2@actionarena.com test2234 Opponent / league mate
Player 3 test3@actionarena.com test3234 Third league member
Player 4 test4@actionarena.com test4234 Edge case testing (late joiner, non-bettor)
You'll be switching between these accounts frequently. To speed this up, you can keep two iOS
Simulators open at the same time. To do this:
1. Open Xcode
2. Go to the top menu: Xcode → Open Developer Tool → Simulator
3. Once Simulator is open, go to File → Open Simulator → choose a diﬀerent iPhone model
(e.g., iPhone 15 Pro and iPhone 16)
4. Now you have two simulators running side by side
5. Run your app on one, log in as Player 1. Run the app on the other, log in as Player 2.
If that's too complicated, just use one simulator and log in/out between accounts as needed.
Mock Data System
Before testing, make sure:
1. Open your project's .env ﬁle (in the project root folder)
2. Conﬁrm this line exists: EXPO_PUBLIC_USE_MOCK_DATA=true
3. This tells the app to show fake NFL games instead of trying to fetch real ones from the
internet
You should see 14-16 fake NFL games with realistic odds when you open the Bet Board.

--- PAGE 2 ---

Database
1. Go to your Supabase dashboard (supabase.com → your project)
2. Click "Table Editor" in the left sidebar
3. Conﬁrm these tables exist: users, leagues, league_members, weekly_matchups, bets,
bet_legs, standings, user_cosmetics, season_passes, seasons
4. If any are missing, you need to run the SQL migrations before testing
Arena Coins
Every new account should start with 500 free Arena Coins. After creating each test account,
check:
1. Log in with the account
2. Go to Proﬁle
3. Look for a coin balance display — it should show 500
If it shows 0 or no balance is visible, the default coin balance wasn't set up correctly. Ask Codex
to ﬁx this before continuing.
Test 1: Authentication
1.1 — Sign Up (New Account)
1. Open the app. You should see the login/signup screen — dark background, green accents,
"Action Arena" branding.
2. Look for a "Sign Up" button or a "New to the Arena?" link. Tap it.
3. Type in an email address: test1@actionarena.com
4. Type in a password: test1234
5. Tap the Sign Up button.
6. What should happen: The screen should change to the main app with the tab bar at the
bottom (Home, Leagues, Bet Board, Leaders, Proﬁle). You should NOT still be on the login
screen.
7. Check the database: Open your Supabase dashboard in a browser. Go to Authentication →
Users. You should see test1@actionarena.com listed there.
8. Check the users table: Go to Table Editor → users. There should be a row with the same
user ID, with is_premium = false and arena_coins = 500.
If the app stays on the login screen or shows an error, something is wrong with the Supabase
connection. Check your .env ﬁle.

--- PAGE 3 ---

1.2 — Sign Up Validation (Testing Bad Inputs)
These tests make sure the app doesn't crash when someone types something wrong.
1. Go back to the signup screen (log out ﬁrst if needed).
2. Leave the email ﬁeld completely empty. Leave the password ﬁeld empty. Tap Sign Up.
What should happen: An error message appears. The app does NOT crash.
3. Type "notanemail" in the email ﬁeld (no @ symbol). Type "test1234" as the password. Tap
Sign Up.
What should happen: An error message about invalid email format. The app does
NOT crash.
4. Type "valid@email.com" in the email ﬁeld. Type "123" as the password (too short —
Supabase requires at least 6 characters). Tap Sign Up.
What should happen: An error message about password being too short. The app
does NOT crash.
5. Type "test1@actionarena.com" (the account you already created). Type "test1234". Tap Sign
Up.
What should happen: An error message saying this email already exists. The app
does NOT crash.
1.3 — Log In (Existing Account)
1. If you're currently logged in, go to Proﬁle → Settings → Sign Out.
2. You should now see the login screen.
3. Type: test1@actionarena.com
4. Type: test1234
5. Tap Log In.
6. What should happen: You land on the Home tab with the bottom tab bar visible.
1.4 — Log In Validation (Testing Bad Inputs)
1. Type test1@actionarena.com as the email. Type "wrongpassword" as the password. Tap Log
In.
What should happen: Error message like "Invalid credentials." The app does NOT
crash.
2. Type "nobody@actionarena.com" (an account that doesn't exist). Type any password. Tap
Log In.
What should happen: Error message. No crash.
3. Leave both ﬁelds completely empty. Tap Log In.

--- PAGE 4 ---

What should happen: Error message. No crash.
1.5 — Session Persistence (Does the App Remember You?)
1. Log in successfully as Player 1.
2. Completely close the app. In the iOS Simulator, swipe up from the bottom of the screen to
see the app switcher, then swipe the app upward to kill it.
3. Tap the app icon to reopen it.
4. What should happen: You should land directly on the Home tab, already logged in. You
should NOT see the login screen.
1.6 — Log Out
1. While logged in, tap the Proﬁle tab (far right in the tab bar).
2. Look for a Settings button or gear icon. Tap it.
3. Find "Sign Out" and tap it.
4. What should happen: You're taken back to the login screen.
5. Try tapping the back button or swiping back.
What should happen: You cannot get back into the app without logging in again.
Test 2: League Creation
2.1 — Create a Head-to-Head (H2H) League
1. Log in as Player 1 (test1@actionarena.com).
2. Tap the Leagues tab in the bottom bar.
3. Tap the "Create" button.
4. You should see a form. Fill it in:
League name: "Test H2H League"
Type: Head-to-Head (this means players face oﬀ against each other each week, like
fantasy football)
Visibility: Private (only people with the invite code can join)
Max members: 10
Sport: NFL (should be the only option for now)
5. Tap the Create button.
6. What should happen:
You're taken to the new league's detail screen.
You can see yourself listed in the standings as the only member.

--- PAGE 5 ---

An invite code is displayed somewhere on the screen (a 6-character code like
"X7K2MP").
Write down this invite code — you'll need it later.
7. Check the database: Go to Supabase → Table Editor → leagues. You should see a new row
with name "Test H2H League", type "h2h", visibility "private".
8. Check league_members: You should see a row linking your user ID to this league.
2.2 — Create a Cumulative League
1. Go back to Leagues tab → Create.
2. Fill in:
League name: "Test Cumulative League"
Type: Cumulative (no weekly matchups — just total proﬁt over the whole season,
whoever has the most at the end wins)
Visibility: Private
Max members: 10
Sport: NFL
3. Tap Create.
4. What should happen: Same as 2.1, but the standings should show proﬁt-based rankings
instead of Win-Loss-Tie records.
2.3 — Create a Public League
1. Create another league:
Name: "Public Test League"
Type: Head-to-Head
Visibility: Public (anyone can ﬁnd and join this league)
Max members: 10
2. Tap Create.
3. Now log out. Log in as Player 3 (test3@actionarena.com).
4. Go to Leagues → Join → Browse Public Leagues (or however the public browse is labeled).
5. What should happen: You should see "Public Test League" in the list. It should show: the
league name, type (H2H), member count (1/10), sport (NFL), and the commissioner's name
(Player 1's display name).
2.4 — Create League Validation
1. Try creating a league with no name (leave the name ﬁeld empty). Tap Create.

--- PAGE 6 ---

What should happen: Error message. You cannot create a league without a name.
2. Try creating a league with a very long name (type 100+ random characters). Tap Create.
What should happen: Either the name gets truncated (cut short), or an error message
appears. The app should NOT crash.
3. Create 3-4 leagues and look at each one's invite code.
What should happen: Every invite code is diﬀerent. No two leagues share the same
code.
Test 3: Joining Leagues
3.1 — Join via Invite Code
1. Log in as Player 1. Go to the H2H league you created. Find and copy the invite code.
2. Log out. Log in as Player 2 (test2@actionarena.com).
3. Go to Leagues → Join.
4. Look for an "Enter Invite Code" option. Tap it.
5. Type or paste the invite code from step 1.
6. Tap Join.
7. What should happen:
You're taken to the league detail screen.
You can see both Player 1 and Player 2 in the standings.
8. Check the database: Go to Supabase → league_members. You should see two rows for this
league — one for Player 1 and one for Player 2.
3.2 — Join via Public Browse
1. Log in as Player 3 (test3@actionarena.com).
2. Go to Leagues → Join → Browse Public Leagues.
3. Find "Public Test League" in the list.
4. Tap the Join button next to it.
5. What should happen: Same as 3.1 — you're taken to the league, you appear in the
standings.
3.3 — Join with Invalid Code
1. Go to Leagues → Join → Enter Invite Code.
2. Type a random 6-character code that you made up (like "ZZZZZ9").
3. Tap Join.

--- PAGE 7 ---

4. What should happen: An error message appears saying "League not found" or something
similar. The app does NOT crash.
3.4 — Join a Full League
1. Log in as Player 1. Create a new league with max members set to 4.
2. Join this league with Player 2, Player 3, and Player 4 (using the invite code each time).
3. Now create a 5th test account (or reuse one) and try to join.
4. What should happen: Error message saying "League is full." You cannot join.
3.5 — Join a League You're Already In
1. Log in as Player 2, who is already in the H2H league.
2. Go to Join → Enter Invite Code. Type the same H2H league invite code.
3. Tap Join.
4. What should happen: Either an error message saying you're already a member, or it just
takes you to the league. It should NOT create a duplicate member entry.
5. Check the database: Supabase → league_members. There should still be only ONE row for
Player 2 in this league, not two.
3.6 — Add All Test Players to the H2H League
1. Get Players 1, 2, 3, and 4 all into the same H2H league (use the invite code for each).
2. Open the league detail screen.
3. Verify all of these:
Standings show all 4 members.
Go to the Schedule tab — matchups should have been generated automatically.
Each week should show exactly 2 matchups (4 players means 2 games per week, no
one sits out).
The schedule should cover the full season: 14 regular weeks + 3 playoﬀ weeks.
Test 4: League Detail
4.1 — Standings Table
1. Open the H2H league with all 4 members.
2. Look at the standings table.
3. Verify:

--- PAGE 8 ---

All 4 members are listed.
Everyone shows a 0-0-0 record (0 wins, 0 losses, 0 ties).
Everyone shows $0.00 total proﬁt.
Rankings are shown (everyone is tied at this point, which is ﬁne).
4.2 — Matchup Schedule
1. Go to the Schedule tab within the league detail.
2. Verify:
You can see weekly matchups for the entire season (Week 1 through Week 17).
Weeks 1-14 are regular season.
Weeks 15-17 are marked as playoﬀs.
Every member plays every other member at least once during the regular season.
Week 1 shows speciﬁc matchups (e.g., "Player 1 vs Player 3, Player 2 vs Player 4").
4.3 — Members List
1. Go to the Members tab within the league detail.
2. Verify:
All 4 members are listed.
Each member shows some basic info.
3. Tap on one of the other members (not yourself).
4. What should happen: You navigate to that member's proﬁle page within this league.
4.4 — Invite Code Sharing
1. On the league detail screen, ﬁnd the invite code section.
2. Look for a "Share" or "Copy" button next to the code.
3. Tap it.
4. What should happen: Either the code is copied to your clipboard (you might see a brief
"Copied!" conﬁrmation), or a share sheet pops up letting you send it via text/email.
4.5 — Odd Number of Members (Bye Week Test)
1. Create a brand new H2H league.
2. Join with exactly 3 members (Player 1, 2, and 3). Do NOT add Player 4.
3. Go to the schedule.
4. Verify:
Each week, two players have a matchup and one player has a "bye" (a week oﬀ).

--- PAGE 9 ---

Byes rotate — the same player does NOT have a bye two weeks in a row.
A bye should count as an automatic win.
Test 5: Bet Placement — Straight Bets
5.1 — Viewing Games and Odds
1. Log in as Player 1. Make sure you're in at least one league.
2. Tap the Bet Board tab.
3. Verify all of these:
If you're in multiple leagues, there's a dropdown or selector at the top to choose which
league you're betting for. Select the H2H league.
You can see all the mock NFL games for the current week (14-16 games).
Each game card shows both team names and the game date/time.
Each game has three betting options visible: Moneyline, Spread, and Over/Under.
The odds numbers are displayed next to each option (like -150, +130, -110, etc.).
Each odds button is tappable.
5.2 — Budget Tracker
1. Before placing any bets, look at the budget tracker at the top of the Bet Board.
2. Verify it shows:
$100 remaining (or "Budget: $100")
0/5 bets placed
$0 allocated
3. Tap any moneyline odds button (e.g., Chiefs -150). A dollar amount input should appear.
4. Enter $20 and add it to the slip.
5. Verify the budget tracker now shows:
$80 remaining
1/5 bets placed
$20 allocated
6. Remove the bet from the slip (swipe it away or tap a delete/remove button).
7. Verify the budget tracker goes back to:
$100 remaining
0/5 bets placed
$0 allocated

--- PAGE 10 ---

5.3 — Placing a Valid Straight Bet
1. On any game, tap the moneyline odds for one team. Let's say "Chiefs -150."
2. Set the amount to $20.
3. Add it to the slip.
4. Pull up the bet slip (drag up from the bottom or tap the slip icon).
5. Verify the bet slip shows:
Team: Chiefs
Market: Moneyline
Odds: -150
Amount: $20.00
Potential Payout: $33.33
6. Check the math yourself: $20 on -150 means: decimal odds = (100 ÷ 150) + 1 = 1.667. Payout
= $20 × 1.667 = $33.33. Proﬁt if it wins = $33.33 - $20 = $13.33.
5.4 — Placing Multiple Straight Bets
1. Place 5 straight bets on 5 diﬀerent games, each for $20. That's $20 × 5 = $100 total.
2. Verify:
Budget tracker shows $0 remaining, 5/5 bets placed.
The submit/lock button is now enabled (not grayed out).
All 5 bets appear in the bet slip with correct details.
5.5 — Spread and Over/Under Bets
1. Clear your slip (remove all bets). Start fresh.
2. Place a bet on a spread: tap "Chiefs -3.5 (-110)" → set amount to $20 → add to slip.
3. Place a bet on an over/under: tap "Over 47.5 (-110)" → set amount to $20 → add to slip.
4. Verify both bets in the slip:
The spread bet shows "Chiefs -3.5" and "Spread" as the market.
The over/under bet shows "Over 47.5" and "Over/Under" as the market.
Both show odds of -110.
Both show the correct payout: $20 on -110 = $20 × 1.909 = $38.18 payout.
5.6 — Changing Bet Amounts
1. Add a bet to the slip for $20.

--- PAGE 11 ---

2. Before submitting, ﬁnd a way to edit the amount (tap the bet in the slip, or look for an edit
button).
3. Change the amount from $20 to $15.
4. Verify:
Budget tracker updates: if you had $80 remaining before, it should now show $85.
The payout in the slip recalculates to match the new $15 amount.
5.7 — Removing Bets from Slip
1. Add 3 bets to the slip ($20 each = $60 total).
2. Remove the middle bet (swipe it left, or tap a trash/X icon).
3. Verify:
Only 2 bets remain in the slip.
Budget tracker shows $60 remaining (was $40, now $20 was freed up → $60).
The remaining 2 bets still show their correct details.
Test 6: Bet Placement — Validation Rules
6.1 — Minimum 5 Bets
1. Place only 3 bets, carefully choosing amounts that total exactly $100 (e.g., $35, $35, $30).
2. Look at the submit/lock button.
3. Verify: The submit button is disabled (grayed out or not tappable).
4. Verify: A message is visible that tells you speciﬁcally that you need at least 5 bets.
5. Now add 2 more bets (adjust your amounts so the total is still $100 — e.g., change to $20,
$20, $20, $20, $20).
6. Verify: The submit button becomes enabled (green, tappable).
6.2 — Maximum $35 Single Bet
1. Start fresh. Try to set a single bet amount to $40.
2. Verify: Either:
The input won't let you type a number higher than $35, OR
An error message appears when you try to add it to the slip telling you the max is $35.
3. Set a bet to exactly $35.
4. Verify: This is allowed. No error.

--- PAGE 12 ---

6.3 — Must Allocate Exactly $100
1. Place 5 bets that total only $95 (e.g., $19 each).
2. Try to submit.
3. Verify: Submit button is disabled. A message says you need to allocate the remaining $5.
4. Now try to make your bets total $105.
5. Verify: The app prevents you from going over $100. Either:
The last bet amount is automatically reduced to ﬁt, OR
An error message appears telling you you've exceeded the budget.
6.4 — No Betting Both Sides of Same Game
1. Find a game — let's say Chiefs vs Ravens.
2. Place a straight bet on Chiefs moneyline. Add it to the slip.
3. Now try to also select Ravens moneyline on the same game.
4. Verify: Either:
The Ravens option is grayed out / disabled, OR
An error message appears saying you can't bet both sides of the same game.
6.5 — No Duplicate Selections Across Bet Types
1. Place a straight bet on Chiefs -3.5.
2. Now switch to Parlay mode.
3. Try to add Chiefs -3.5 as a leg in your parlay.
4. Verify: The app prevents this. You get a message saying this selection is already used in
another bet. One selection per game per league, across all bet types.
Test 7: Bet Placement — Parlays
7.1 — Building a Basic Parlay
1. Switch to Parlay mode on the Bet Board (look for a toggle or tabs: Straight / Parlay / Teaser).
2. Verify: The mode indicator changes — Parlay mode should use the amber/orange accent
color.
3. Tap a selection on Game 1 (e.g., Chiefs moneyline at -150).
4. Verify: A leg is added and combined odds start displaying somewhere.
5. Tap a selection on Game 2 (e.g., Bills +3.5 at -110).
6. Verify: Combined odds update in real-time.

--- PAGE 13 ---

7. Check the math: Chiefs -150 decimal = 1.667. Bills -110 decimal = 1.909. Combined = 1.667 ×
1.909 = 3.182. In American odds that's approximately +218.
8. Set the parlay amount to $20.
9. Verify: Potential payout = $20 × 3.182 = $63.64.
10. Add the parlay to the slip.
11. Verify in the slip:
The parlay has an amber/orange type badge.
Both legs are listed underneath the parlay.
Combined odds and payout are shown.
7.2 — Minimum and Maximum Legs
1. Try to add a parlay with only 1 leg (just one selection).
Verify: Not allowed. You need at least 2 legs.
2. Build a parlay with exactly 6 legs (selections from 6 diﬀerent games).
Verify: Allowed. The parlay shows all 6 legs.
3. Try to add a 7th leg.
Verify: Not allowed. Maximum is 6 legs.
7.3 — No Same-Game Parlay
1. Start building a parlay.
2. Add the moneyline from Game 1.
3. Now try to also add the spread from the same Game 1.
4. Verify: The app blocks this. You should see a message saying you can't add two selections
from the same game to a parlay.
7.4 — Parlay Payout Cap ($500)
1. Build a 5 or 6-leg parlay using heavy underdogs (selections with high positive odds like
+300, +400, +500).
2. Set the amount to $35 (the maximum).
3. Verify: If the calculated payout exceeds $500, a warning message appears telling you the
payout is capped at $500.
4. Verify: The displayed potential payout shows $500.00, NOT the uncapped amount.
7.5 — Parlay Combined Odds Live Update
1. Enter parlay mode. Add Leg 1. Note the combined odds.

--- PAGE 14 ---

2. Add Leg 2. Note the combined odds — they should be higher.
3. Add Leg 3. Note the combined odds — even higher.
4. Remove Leg 2.
5. Verify: Combined odds recalculate immediately — they should go down since you removed
a leg.
6. Add a diﬀerent leg.
7. Verify: Combined odds recalculate with the new leg's odds.
7.6 — Parlay Counts as 1 Bet
1. Build a 4-leg parlay and set it to $20.
2. Look at the budget tracker.
3. Verify: It shows 1/5 bets placed (NOT 4/5 — the parlay is one bet, not four).
4. Place 4 more straight bets to reach 5 total bets and $100 total.
5. Verify: Submit button is enabled.
Test 8: Bet Placement — Teasers
8.1 — Building a Basic Teaser
1. Switch to Teaser mode on the Bet Board.
2. Verify: Teaser mode uses the cyan/blue accent color.
3. First, select a teaser size: 6 points. This should be a selector (buttons or dropdown showing
6, 6.5, and 7).
4. Verify: Moneyline options are disabled, hidden, or grayed out on every game. Only Spread
and Over/Under should be selectable.
5. Tap a spread: Chiefs -7.5.
6. Verify: The display shows BOTH the original and adjusted line: "Chiefs -7.5 → -1.5 (6pt
teaser)." The adjusted line = original minus 6 = -7.5 + 6 = -1.5.
7. Tap an over/under: Over 47.5.
8. Verify: Display shows "Over 47.5 → Over 41.5 (6pt teaser)." The adjusted total = 47.5 - 6 =
41.5 (lower, making it easier to go over).
9. Set amount to $20.
10. Verify: The odds shown match the teaser lookup table: 2 legs, 6 points = -110.
11. Verify: Payout = $20 × 1.909 = $38.18.
12. Add to slip.
13. Verify in the slip:

--- PAGE 15 ---

The teaser has a cyan/blue badge.
Both legs are shown with original AND adjusted lines.
Teaser size (6pt) is displayed.
Odds and payout are correct.
8.2 — Teaser Size Variations
1. Build a 2-leg teaser using 6 points. Note the odds displayed.
Verify: Odds = -110.
2. Remove it. Build the exact same 2 legs but select 6.5 points.
Verify: Odds = -120. Adjusted lines shifted by 6.5 instead of 6.
3. Remove it. Same legs, select 7 points.
Verify: Odds = -130. Adjusted lines shifted by 7.
8.3 — Teaser Line Adjustments — All Four Directions
Teasers always move the line in YOUR favor. Test all four cases:
1. Favorite spread: Select Chiefs -7.5 with a 6pt teaser.
Verify: Adjusted = -1.5. The line moved toward 0 (easier for the favorite to cover).
2. Underdog spread: Select Dolphins +3.5 with a 6pt teaser.
Verify: Adjusted = +9.5. The line moved away from 0 (more cushion for the underdog).
3. Over: Select Over 47.5 with a 6pt teaser.
Verify: Adjusted = Over 41.5. The total went down (easier to go over a lower number).
4. Under: Select Under 47.5 with a 6pt teaser.
Verify: Adjusted = Under 53.5. The total went up (easier to stay under a higher
number).
8.4 — Teaser Leg Limits
1. Try to build a teaser with only 1 leg.
Verify: Not allowed. Minimum is 2 legs.
2. Build a teaser with exactly 4 legs.
Verify: Allowed. Odds should match the 4-leg row in the lookup table.
3. Try to add a 5th leg.
Verify: Not allowed. Maximum is 4 legs.

--- PAGE 16 ---

8.5 — No Moneyline in Teasers
1. While in teaser mode, look at any game card.
2. Verify: The Moneyline option is visibly disabled, grayed out, or completely hidden. You
should only be able to tap Spread and Over/Under.
8.6 — Teaser Odds Table Veriﬁcation
Go through every combination and verify the odds match this table:
Legs 6 pts 6.5 pts 7 pts
2 -110 -120 -130
3 +150 +130 +110
4 +250 +200 +160
How to test: Build a 2-leg teaser at 6pts → verify odds = -110. Remove, build 2-leg at 6.5pts →
verify -120. Remove, build 2-leg at 7pts → verify -130. Then do 3-leg and 4-leg versions. That's 9
combinations total. Verify each one.
Also verify the payout math for each. For example: 3-leg at +150 means decimal odds = (150 ÷
100) + 1 = 2.5. A $20 bet pays $20 × 2.5 = $50.
8.7 — Teaser Counts as 1 Bet
1. Build a 4-leg teaser for $25.
2. Look at the budget tracker.
3. Verify: Shows 1/5 bets placed (NOT 4/5).
Test 9: Lock of the Week
9.1 — Lock Designation Required
1. Build a complete valid card: 5 bets totaling $100.
2. Do NOT designate any bet as your Lock of the Week.
3. Try to submit.
4. Verify: Submit button is disabled. A message speciﬁcally tells you to choose your Lock of
the Week.

--- PAGE 17 ---

9.2 — Designating a Lock
1. In the bet slip, ﬁnd the way to mark a bet as your Lock (there should be a tap target, a star
icon, a ﬂame icon, or a "Set as Lock" button on each bet).
2. Tap it on one of your bets.
3. Verify:
That bet is visually transformed — it should look noticeably diﬀerent from the other
bets (gold border, lock/ﬂame icon, elevated card, etc.).
The other bets might dim slightly to make the Lock stand out.
You feel a haptic feedback (a thump on your phone).
The submit button should now be enabled (assuming all other validation passes).
9.3 — Only One Lock Allowed
1. With one bet already designated as Lock, try to tap the Lock button on a diﬀerent bet.
2. Verify: Either:
The Lock moves to the new bet (deselecting the old one), OR
A message tells you to remove the current Lock ﬁrst.
3. There should never be two Locks at the same time.
9.4 — Lock on Diﬀerent Bet Types
1. Designate a straight bet as Lock → Verify: Works, Lock badge visible.
2. Remove it. Designate a parlay as Lock → Verify: Works, Lock badge visible on the entire
parlay.
3. Remove it. Designate a teaser as Lock → Verify: Works, Lock badge visible on the entire
teaser.
9.5 — Lock Visible After Submission
1. Submit your bets with a Lock designated.
2. On the read-only Bet Board (locked view), ﬁnd your bets.
3. Verify: The Lock bet is clearly identiﬁable — it should be the most visually prominent bet
on the screen.
9.6 — Lock Visible in Matchup Detail
1. After submitting bets, go to your current matchup in the league.
2. Verify: Your Lock bet is highlighted in your bet list.

--- PAGE 18 ---

3. If your opponent has also submitted, verify: Their Lock is also highlighted. There should be
a "Lock vs Lock" section or both Locks should be immediately identiﬁable.
9.7 — Lock 1.5x Multiplier (Test After Settlement)
This test happens during settlement testing (Test 10-12), but documenting the expected
behavior here:
If your Lock bet WINS: proﬁt should be 1.5× the normal proﬁt. Example: a $20 bet at -150
normally proﬁts $13.33. As a Lock, it should proﬁt $13.33 × 1.5 = $20.00.
If your Lock bet LOSES: loss should be 1.5× the normal loss. Example: a $20 bet that loses
normally costs -$20.00. As a Lock, it should cost -$20.00 × 1.5 = -$30.00.
If your Lock bet PUSHES: proﬁt is still $0.00 (1.5 × 0 = 0).
Test 10: Mixed Bet Submission
10.1 — Submit a Mixed Card
Build a complete card with all three bet types plus a Lock:
1. Place 3 straight bets: $15 each = $45
2. Place 1 three-leg parlay: $25
3. Place 1 two-leg teaser (6pt): $30
4. Total: 5 bets, $100 ✓
5. Designate the parlay as your Lock of the Week.
6. Verify before submitting:
Budget tracker shows 5/5 bets, $0 remaining.
The Lock badge is visible on the parlay.
Submit button is enabled.
7. Tap Submit.
8. Verify:
A conﬁrmation modal appears showing ALL your bets organized by type.
Straight bets show their details.
The parlay shows all 3 legs with combined odds.
The teaser shows both legs with original and adjusted lines.
The Lock is clearly marked on the parlay.
9. Conﬁrm the submission.
10. Verify:

--- PAGE 19 ---

Bet Board switches to a read-only view.
All bets show with lock/pending indicators.
The Lock bet is visually prominent.
11. Check the database:
Supabase → bets table: 5 rows. Check that bet_type values are correct (3 "straight", 1
"parlay", 1 "teaser").
Supabase → bet_legs table: count the rows. Should be: 3 (straight) + 3 (parlay) + 2
(teaser) = 8 leg rows total.
Verify the Lock bet has some indicator in the database (a is_lock ﬁeld or similar).
10.2 — Bet Locking Behavior (Per-Game Lock Timing)
1. Submit your bets. Your bets are on games that start at diﬀerent times (Thursday night,
Sunday 1pm, Sunday 4pm, Sunday night, Monday night).
2. In the mock data system, simulate one game starting (mark it as "in progress").
3. Verify: The bet on that speciﬁc game shows as locked (can't be changed).
4. Verify: Bets on games that haven't started yet still show as unlocked.
5. For a parlay with legs across diﬀerent games: simulate one leg's game starting.
6. Verify: That speciﬁc leg shows as locked.
7. Verify: If other legs' games haven't started, the parlay is partially locked — you can see
which legs are locked and which aren't.
Test 11: Bet Settlement — Straight Bets
11.1 — Settling a Win
1. Player 1 placed a straight bet: Chiefs moneyline at -150 for $20. This bet is NOT the Lock.
2. In the mock data system, mark the Chiefs game as complete. Set the result so the Chiefs
won.
3. Run the settlement function (however Codex built this — it might be a button in the app, a
script you run in the terminal, or an Edge Function you trigger in Supabase).
4. Verify in the app:
The bet shows result = "Win" (green indicator).
Proﬁt = $13.33 (which is $20 × (100/150) = $13.33).
5. Verify in the database:
bets table: result = "win", proﬁt = 13.33
bet_legs table: result = "win"

--- PAGE 20 ---

11.2 — Settling a Loss
1. Player 1 placed a straight bet: Bills +3.5 at -110 for $15. Not the Lock.
2. Mark the game complete. Bills lost by 7 points (they did NOT cover +3.5).
3. Run settlement.
4. Verify: Bet result = "Loss" (red indicator). Proﬁt = -$15.00.
11.3 — Settling a Push
1. Player 1 placed a spread bet: Chiefs -3.0 (a whole number, not -3.5) at -110 for $20.
2. Mark the game complete. Chiefs won by exactly 3 points.
3. Run settlement.
4. Verify: Bet result = "Push" (gray indicator). Proﬁt = $0.00.
11.4 — Lock of the Week Win (1.5x Multiplier)
1. Player 1 designated a straight bet as their Lock: Patriots +7.5 at -110 for $25.
2. Mark the game complete. Patriots lost by 3 (they covered +7.5).
3. Run settlement.
4. Verify:
Base proﬁt would be: $25 × (100/110) = $22.73.
Lock multiplier: $22.73 × 1.5 = $34.09.
Displayed proﬁt = $34.09 (not $22.73).
11.5 — Lock of the Week Loss (1.5x Multiplier)
1. Player 1 designated a straight bet as their Lock: $20 on a team that lost.
2. Run settlement.
3. Verify:
Base loss = -$20.00.
Lock multiplier: -$20.00 × 1.5 = -$30.00.
Displayed proﬁt = -$30.00 (not -$20.00).
Test 12: Bet Settlement — Parlays
12.1 — All Legs Win
1. Player 1 placed a 3-leg parlay for $25. Legs at -150, -110, +200. Not the Lock.

--- PAGE 21 ---

2. Mark all 3 games complete with all selections winning.
3. Run settlement.
4. Verify:
All 3 legs show "Win."
Combined decimal odds = 1.667 × 1.909 × 3.0 = 9.546.
Payout = $25 × 9.546 = $238.64.
Proﬁt = $238.64 - $25.00 = $213.64.
12.2 — One Leg Loses
1. Player 1 placed a 3-leg parlay for $25.
2. Mark 2 games as wins, 1 game as a loss.
3. Run settlement.
4. Verify:
Entire parlay result = "Loss." (One leg failing kills the whole parlay.)
Proﬁt = -$25.00.
Individual leg results show correctly: 2 wins and 1 loss.
12.3 — One Leg Pushes (Parlay Recalculation)
1. Player 1 placed a 3-leg parlay for $25: Leg A at -150, Leg B at -110, Leg C on a whole-number
spread that pushes.
2. Leg A wins, Leg B wins, Leg C pushes.
3. Run settlement.
4. Verify:
Leg C drops out of the parlay.
The parlay recalculates as a 2-leg parlay using only Leg A and Leg B odds.
New combined decimal odds = 1.667 × 1.909 = 3.182.
Payout = $25 × 3.182 = $79.55.
Proﬁt = $79.55 - $25.00 = $54.55.
12.4 — All Legs Push
1. Player 1 placed a 2-leg parlay where both legs are on whole-number spreads.
2. Both games result in pushes.
3. Run settlement.
4. Verify: Entire parlay = "Push." Proﬁt = $0.00.

--- PAGE 22 ---

12.5 — Push Reduces to Single Leg
1. Player 1 placed a 2-leg parlay: Leg A at +200, Leg B pushes.
2. Run settlement.
3. Verify:
Leg B drops out.
Parlay reduces to a straight bet at Leg A's odds (+200 = decimal 3.0).
Payout = $25 × 3.0 = $75.00.
Proﬁt = $75.00 - $25.00 = $50.00.
12.6 — Payout Cap Enforcement
1. Player 1 placed a 6-leg parlay with all underdogs. Calculated payout would be $800+.
2. All legs win.
3. Run settlement.
4. Verify:
Payout is capped at $500.00.
Proﬁt = $500.00 - bet amount.
12.7 — Parlay as Lock of the Week
1. Player 1 designated a 3-leg parlay as their Lock.
2. All legs win. Normal proﬁt would be $213.64.
3. Run settlement.
4. Verify: Proﬁt = $213.64 × 1.5 = $320.46.
12.8 — Parlay as Lock — Loss
1. Player 1 designated a parlay as Lock. One leg loses. Normal loss = -$25.
2. Run settlement.
3. Verify: Loss = -$25 × 1.5 = -$37.50.
Test 13: Bet Settlement — Teasers
13.1 — All Legs Win (Against ADJUSTED Lines)
1. Player 1 placed a 2-leg, 6-point teaser at $30:
Leg A: Chiefs -7.5 → adjusted to -1.5

--- PAGE 23 ---

Leg B: Over 47.5 → adjusted to Over 41.5
2. Set game results:
Chiefs win by 3. This covers the ADJUSTED line of -1.5 (3 > 1.5). But it would NOT
have covered the original -7.5.
Game total is 44. This is over the ADJUSTED line of 41.5. But it would NOT have been
over the original 47.5.
3. Run settlement.
4. Verify:
BOTH legs show "Win" — they're evaluated against adjusted lines, NOT originals.
Odds from lookup table: 2 legs, 6pts = -110 → decimal 1.909.
Payout = $30 × 1.909 = $57.27.
Proﬁt = $57.27 - $30.00 = $27.27.
13.2 — One Leg Loses Against Adjusted Line
1. Same teaser setup as 13.1. But this time Chiefs win by only 1 point.
2. Chiefs won by 1. The adjusted line is -1.5. Winning by 1 does NOT cover -1.5 (1 < 1.5).
3. Run settlement.
4. Verify:
Leg A = Loss.
Entire teaser = Loss (one leg losing kills the whole teaser).
Proﬁt = -$30.00.
13.3 — Teaser Leg Push (Drop and Recalculate)
1. Player 1 placed a 3-leg, 6-point teaser at $25:
Leg A: Chiefs -7.5 → -1.5
Leg B: Bills +3.5 → +9.5
Leg C: Over 47.0 → Over 41.0 (whole number for push possibility)
2. Legs A and B win. Game total for Leg C is exactly 41 → Push.
3. Run settlement.
4. Verify:
Leg C drops out.
Teaser recalculates from 3-leg odds to 2-leg odds: was +150, now -110.
Payout = $25 × 1.909 = $47.73.
Proﬁt = $47.73 - $25.00 = $22.73.

--- PAGE 24 ---

13.4 — Teaser Push Below Minimum Legs
1. Player 1 placed a 2-leg teaser. Both legs push.
2. Run settlement.
3. Verify: Drops below 2 legs → entire teaser = Push. Proﬁt = $0.00.
13.5 — Diﬀerent Teaser Sizes Produce Diﬀerent Results
This tests that the settlement engine correctly uses diﬀerent adjusted lines for diﬀerent teaser
sizes.
1. Set up three teasers on the same spread: Chiefs -8.5
Teaser 1: 6-point → adjusted to -2.5
Teaser 2: 6.5-point → adjusted to -2.0
Teaser 3: 7-point → adjusted to -1.5
2. Chiefs win by exactly 2.
3. Run settlement.
4. Verify:
6pt teaser: Chiefs -2.5, won by 2 → DOES NOT COVER (2 < 2.5) → Loss
6.5pt teaser: Chiefs -2.0, won by 2 → PUSH (2 = 2.0) → Push (or recalculate if multi-leg)
7pt teaser: Chiefs -1.5, won by 2 → COVERS (2 > 1.5) → Win
13.6 — Teaser as Lock of the Week
1. Player 1 designated a 2-leg teaser as Lock. Teaser wins. Normal proﬁt = $27.27.
2. Verify: Proﬁt = $27.27 × 1.5 = $40.91.
Test 14: Weekly Matchup Resolution
14.1 — H2H Winner Determination
1. In the H2H league, Player 1 and Player 2 are matched up in Week 1.
2. Both players place and submit their bets.
3. Settle all bets for the week.
4. Let's say Player 1's weekly proﬁt = +$45.00 and Player 2's weekly proﬁt = -$12.00.
5. Run weekly resolution (this may happen automatically after settlement, or may need to be
triggered).
6. Verify:

--- PAGE 25 ---

Player 1 gets a Win. Player 2 gets a Loss.
Standings update: Player 1 is 1-0-0 (1 win). Player 2 is 0-1-0 (1 loss).
Check Supabase → weekly_matchups: winner_id = Player 1's user ID.
14.2 — H2H Tie
1. Set up a scenario where both players end with exactly the same weekly proﬁt.
2. Run resolution.
3. Verify: Both players get a Tie. Standings show 0-0-1 for each.
14.3 — Cumulative League Update
1. In the Cumulative league, settle all bets for the week.
2. Run resolution.
3. Verify:
Each player's total_proﬁt is updated. No W-L-T records (cumulative leagues don't
have matchups).
Rankings are ordered by total_proﬁt (highest at #1).
14.4 — Player Didn't Place Bets
1. Player 4 does NOT place any bets for the week. Everyone else does.
2. Run settlement and resolution.
3. Verify:
Player 4's weekly proﬁt = $0.
In the H2H matchup, Player 4's opponent gets a Win (because any proﬁt beats $0, or
$0 ties with $0 if the opponent also had $0 — but typically the opponent will have
non-zero proﬁt).
14.5 — Standings Accuracy Over Multiple Weeks
1. Simulate 3 full weeks: place bets for all players each week → settle → resolve.
2. After EACH week, verify:
W-L-T records are cumulative and correct.
Total proﬁt = sum of all weekly proﬁts.
Rankings are sorted correctly.
3. Keep a notepad with expected values so you can cross-check.

--- PAGE 26 ---

Test 15: Matchup Detail Screen
15.1 — Current Week Matchup
1. Log in as Player 1 during an active week (bets placed, games not yet settled).
2. Navigate to your current week's matchup (from Home dashboard or League Detail).
3. Verify:
Shows you vs your opponent.
Your bets are listed with correct details.
Your Lock bet is clearly highlighted.
Opponent's bets are listed (bets are public within a league).
Opponent's Lock is clearly highlighted.
There should be a "Lock vs Lock" visual element — both Locks are immediately
identiﬁable.
Unsettled bets show as "Pending" or "In Progress."
15.2 — Past Week Matchup
1. After settling Week 1, navigate back to the Week 1 matchup.
2. Verify:
All bets show ﬁnal results: green for win, red for loss, gray for push.
Proﬁt comparison shows correct totals for both sides.
The winner is clearly indicated.
Lock bets show the 1.5x multiplier on their proﬁt/loss.
15.3 — Multi-Leg Bets in Matchup View
1. View a matchup where one player has parlays and teasers.
2. Verify:
Parlays show all legs with individual leg results under the parent bet.
Teasers show both original and adjusted lines for each leg.
Type badges are color-coded: amber for parlay, cyan for teaser.
If a parlay or teaser is the Lock, the Lock eﬀect is visible on the entire bet.

--- PAGE 27 ---

Test 16: Proﬁle and Stats
16.1 — Stats Accuracy
1. After several weeks of simulated data, go to the Proﬁle tab.
2. Get a calculator or spreadsheet. Manually calculate Player 1's stats from the bets you placed.
3. Verify each stat matches:
Total proﬁt (should be green if positive, red if negative).
Overall record (H2H leagues: W-L-T).
Win rate = (number of winning bets ÷ total bets) × 100.
ROI = (total proﬁt ÷ total amount wagered) × 100.
Current streak (e.g., "W3" means last 3 bets were wins).
16.2 — Best Bet and Worst Bet
1. Look through all settled bets in the database for Player 1.
2. Find the single bet with the highest proﬁt and the single bet with the biggest loss.
3. Verify:
"Best Bet" card shows the correct bet — game, selection, odds, amount, proﬁt. If it's a
parlay, all legs should be displayed. Gold/trophy styling.
"Worst Bet" card shows the correct bet — same details but red styling.
If the Lock multiplier made a bet the biggest win/loss, that should be reﬂected.
16.3 — Bet History
1. Go to bet history in the Proﬁle.
2. Count the total bets listed.
3. Verify:
Count matches the number of bets in Supabase for this user.
Most recent bets are at the top.
Each straight bet shows: game, selection, market, odds, amount, result, proﬁt.
Each parlay shows: all legs with individual results, combined odds, amount, total
result, proﬁt. Amber badge.
Each teaser shows: all legs with original AND adjusted lines, teaser size, odds,
individual results, total result, proﬁt. Cyan badge.
Lock bets have a visible Lock indicator throughout bet history.

--- PAGE 28 ---

16.4 — Bet History Filters
1. Filter by "Wins only" → Verify: Only winning bets shown.
2. Filter by "Parlays only" → Verify: Only parlays (with amber badges).
3. Filter by "Week 2" → Verify: Only Week 2 bets.
4. Filter by a speciﬁc league → Verify: Only bets from that league.
5. Combine ﬁlters: "Wins" + "Parlays" → Verify: Only winning parlays.
6. Clear all ﬁlters → Verify: Full history returns.
16.5 — Stats by Bet Type
1. Verify: Win rate is broken down separately for straights, parlays, and teasers.
2. Verify: Proﬁt by bet type adds up: straight proﬁt + parlay proﬁt + teaser proﬁt = total proﬁt.
3. Verify: Average parlay size is correct (total legs across all parlays ÷ number of parlays).
4. Verify: Teaser record shows W-L for each point size (6, 6.5, 7pt) separately.
16.6 — Achievements
Test each achievement by manufacturing the right scenario:
1. Win 5 bets in a row → Verify: "Hot Streak" achievement unlocks with gold styling.
2. Win a bet at +300 odds or longer → Verify: "Underdog Hunter" unlocks.
3. Win every bet in a single week → Verify: "Perfect Week" unlocks.
4. Win 5 weeks with positive proﬁt in a row → Verify: "Budget Master" unlocks.
5. Hit a 4+ leg parlay → Verify: "Parlay King" unlocks.
6. Hit 3 teasers in a single week → Verify: "Teaser Genius" unlocks.
7. Verify: Achievements you haven't earned are visible but grayed out / locked — you can see
what they are (motivation to earn them) but they're clearly not yet unlocked.
16.7 — Member Proﬁle
1. From the standings or members list, tap on another member.
2. Verify: You see their stats, bet history, and achievements — scoped to this speciﬁc league.
3. Verify: All their bets are visible (bets are public within a league).
4. Verify: A "You vs [Member]" section shows head-to-head comparison with correct stats.
Test 17: Leaderboard
17.1 — Ranking Accuracy

--- PAGE 29 ---

1. Tap the Leaderboard tab.
2. Verify:
Members are ranked by total proﬁt (highest ﬁrst).
Rankings match what the standings show in the league detail.
Your row is visually highlighted (green accent or diﬀerent background).
17.2 — Weekly View
1. Switch to the "This Week" sub-view (there should be a tab or toggle).
2. Verify: Rankings show only this week's performance, not season totals.
17.3 — Trend Arrows
1. After completing Week 2, go to the Leaderboard.
2. A player who moved UP in rank since last week → Verify: Green up arrow.
3. A player who moved DOWN → Verify: Red down arrow.
4. A player who stayed the same → Verify: Gray dash or no arrow.
Test 18: Weekly Awards
18.1 — Sharpest Bettor
1. After settling a week, look for weekly awards (on the league detail screen or Home
dashboard).
2. Calculate ROI for each player: (weekly proﬁt ÷ $100 wagered) × 100.
3. Verify: The player with the highest ROI is named "Sharpest Bettor."
18.2 — Degen of the Week
1. Verify: The player with the worst (most negative) ROI is named "Degen of the Week."
18.3 — Lock of the Week Award
1. Verify: The single Lock bet with the highest proﬁt across all league members is shown as
"Lock of the Week."
2. Verify: The Lock's 1.5x multiplied proﬁt is displayed.
3. If it's a parlay or teaser, all legs should be shown.

--- PAGE 30 ---

Test 19: Notiﬁcations
19.1 — Bet Won
1. Place a bet. Settle it as a win.
2. Verify: Push notiﬁcation appears on the phone/simulator saying something like "Your bet
on Chiefs -3.5 hit! +$13.33."
3. Tap the notiﬁcation.
4. Verify: The app opens and navigates to the relevant bet or matchup.
19.2 — Parlay Leg Progress
1. Place a 3-leg parlay.
2. Settle the ﬁrst leg as a win.
3. Verify: Notiﬁcation: "1 of 3 parlay legs hit, 2 games remaining."
4. Settle the second leg as a win.
5. Verify: Notiﬁcation: "2 of 3 parlay legs hit, 1 game remaining."
6. Settle the third leg as a win.
7. Verify: Notiﬁcation: "Your 3-leg parlay hit! +$XXX" (should feel extra exciting — this is a
rare moment).
19.3 — Matchup Result
1. Settle all bets and run weekly resolution.
2. Verify: Both players get a notiﬁcation with the matchup result ("You beat [opponent]
$45.20 to -$12.00" or "You lost to [opponent]").
19.4 — Bets Not Placed Reminder
1. Advance to a new week.
2. Player 4 does not place any bets.
3. Wait for the reminder timing (24 hours before ﬁrst game, per the app logic).
4. Verify: Player 4 gets a reminder notiﬁcation to place bets.
19.5 — Opponent Locked In
1. Player 2 locks in their bets.
2. Verify: Player 1 (their H2H opponent) gets a notiﬁcation: "[Player 2] locked in their bets."

--- PAGE 31 ---

19.6 — Notiﬁcation Preferences
1. Go to Settings → Notiﬁcation Preferences.
2. Turn OFF "Bet Won" notiﬁcations.
3. Win a bet.
4. Verify: NO notiﬁcation ﬁres for the win.
5. Turn "Bet Won" back ON.
6. Win another bet.
7. Verify: Notiﬁcation ﬁres again.
Test 20: League Chat
20.1 — Sending and Receiving Messages
1. Open two simulators. Log in as Player 1 on one, Player 2 on the other.
2. Both open the same league → Chat tab.
3. Player 1 types a message and sends it.
4. Verify: The message appears on Player 2's screen in real-time WITHOUT Player 2 having to
refresh or pull down.
20.2 — System Messages
1. Player 1 locks in their weekly bets.
2. Open the league chat.
3. Verify: A system message appears: "[Player 1] locked in their bets for Week X." This
message should look diﬀerent from regular user messages (centered, smaller, muted text).
20.3 — Sharing a Bet to Chat
1. From bet history or the locked bet board, ﬁnd a bet and look for a "Share to Chat" option.
2. Tap it.
3. Verify: A rich card appears in the chat showing:
Bet type badge (amber for parlay, cyan for teaser, etc.)
Selection(s)
Odds
Amount
If it's the Lock, the Lock eﬀect should be visible on the shared card.
4. Log in as Player 2 and open the chat.

--- PAGE 32 ---

5. Verify: Player 2 can see the shared bet card.
20.4 — Chat Stickers
1. If you've purchased a sticker pack from the cosmetics shop, open the chat.
2. Look for a sticker button (usually near the message input).
3. Send a sticker.
4. Verify: The sticker appears in the chat, big enough to see clearly, with a smooth animation.
Test 21: Playoﬀ and Championship
21.1 — Playoﬀ Clinching
1. Simulate enough weeks of the season that playoﬀ positions become mathematically
determined.
2. Look at the standings.
3. Verify: Players who have clinched a playoﬀ spot show a green checkmark or "Clinched"
indicator.
4. Verify: Players who are mathematically eliminated show an "x" or "Eliminated" indicator.
21.2 — Playoﬀ Bracket Generation
1. Complete all 14 regular season weeks (place bets, settle, resolve for each).
2. Verify: A playoﬀ bracket is generated automatically.
3. Verify: Teams are seeded correctly — the #1 seed plays the lowest remaining seed, #2 plays
the next lowest, etc.
21.3 — Playoﬀ Matchups
1. Advance through Weeks 15, 16, and 17.
2. Verify:
Week 15: First round — higher seeds play lower seeds.
Week 16: Winners from Week 15 advance. Losers are eliminated.
Week 17: Championship matchup between the two remaining players.
3. Verify: Eliminated players can still place bets but aren't in the bracket.
21.4 — Season Complete
1. Settle the championship week (Week 17).

--- PAGE 33 ---

2. Verify:
A champion is declared (the winner of the championship matchup).
League status changes to "complete."
Final standings are preserved and viewable.
Test 22: End-of-Season Awards
22.1 — Awards Display
1. After the season is marked complete, go to the league detail screen.
2. Look for an awards/trophy section.
3. Verify these awards are displayed:
Season MVP: Player with the highest total proﬁt. Shows their name and total proﬁt
number.
Best Record: Player with the most wins (H2H only). Shows their W-L-T record.
Parlay King: Player with the most parlay wins during the season.
Most Consistent: Player with the most weeks of positive proﬁt.
Biggest Single Bet: The single bet that produced the highest proﬁt all season. Shows
the bet details.
22.2 — Season Snapshot
1. Check the database: Go to Supabase → seasons table.
2. Verify: A row exists with:
The correct league_id
champion_id matching the championship winner
ﬁnal_standings containing everyone's ﬁnal records and proﬁts
awards containing all the award winners and their stats
Test 23: Cosmetics Shop
23.1 — Viewing the Shop
1. Go to Proﬁle → ﬁnd the Shop icon or button. Tap it.
2. Verify:
Your coin balance (500 for new accounts) is visible at the top.

--- PAGE 34 ---

A "Get Coins" button is visible near the balance.
Items are organized by category: Team Logos, Trophy Skins, Lock Eﬀects, Win
Celebrations, Chat Stickers, Proﬁle Frames.
You can switch between categories.
Each item shows a preview, a name, and a price in coins.
23.2 — Previewing Items
1. Tap on a Trophy Skin (e.g., "Diamond Trophy").
2. Verify: You see an animated or detailed preview of the item. Trophy skins should shimmer
or rotate. Lock eﬀects should play their animation.
3. Tap on a Lock Eﬀect (e.g., "Fire Lock").
4. Verify: The ﬁre animation plays on loop in the preview.
5. Tap on a Win Celebration (e.g., "Money Rain").
6. Verify: A demo of the money rain animation plays.
23.3 — Purchasing a Cosmetic
1. Your coin balance should be 500.
2. Find an item priced at 150 coins (e.g., a Team Logo). Tap the purchase/buy button.
3. Verify:
A purchase conﬁrmation animation plays (sparkle eﬀect, haptic feedback).
Your coin balance drops from 500 to 350.
The item now shows as "Owned."
4. Check the database: Supabase → user_cosmetics table. A row should exist for this user and
this item.
23.4 — Equipping a Cosmetic
1. Find the item you just purchased. Tap "Equip" (or whatever the button says).
2. Verify:
The item shows as equipped (checkmark, glow, or "Equipped" label).
Only one item per category can be equipped. If you equip a diﬀerent Team Logo, the
ﬁrst one should be unequipped.
23.5 — Cosmetics Visible Across the App
After equipping cosmetics, go through every screen and verify they appear:

--- PAGE 35 ---

1. Team Logo: Go to League Standings → Verify: Your custom logo appears next to your
name. Go to Leaderboard → same. Go to Matchup Detail → same. Go to Chat → send a
message → your logo should appear next to your message.
2. Proﬁle Frame: Go anywhere your avatar appears → Verify: The decorative frame is visible
around your avatar.
3. Trophy Skin: Go to League Standings → Verify: The trophy icon next to the league or #1
rank uses your selected skin (or it appears in the end-of-season awards if the season is
complete).
4. Lock Eﬀect: Place bets and designate your Lock → Verify: The Lock bet shows your
purchased eﬀect (ﬁre, lightning, etc.) instead of the default lock icon. Submit bets → view
the matchup → Verify: Your Lock has the eﬀect. Share the Lock bet to chat → Verify: The
eﬀect is visible on the shared card.
5. Win Celebration: Win a matchup → view the result for the ﬁrst time → Verify: Your
purchased celebration plays (money rain, ﬁreworks, etc.) instead of default confetti.
23.6 — Insuﬃcient Coins
1. Spend your coins until you have very few left (say 50 coins).
2. Try to purchase an item that costs 150 coins.
3. Verify: An error message or visual indicator says you don't have enough coins. The
purchase does NOT go through. You're shown the coin store or a "Get Coins" prompt.
23.7 — Coin Store
1. Go to the Coin Store (from "Get Coins" button or through Proﬁle).
2. Verify: Three packs are displayed:
500 coins — $4.99
1,200 coins — $9.99
2,800 coins — $19.99
3. Tap a purchase button.
4. Verify: A toast or message appears saying "Coming Soon — payment integration not yet
available." The app does NOT crash.
Test 24: Season Pass
24.1 — Season Pass Purchase Screen
1. Find the Season Pass screen (through Proﬁle, Settings, or when you try to access gated
analytics).

--- PAGE 36 ---

2. Verify: The screen shows everything included:
Exclusive cosmetics (with previews) that can't be bought with coins.
Ad-free experience.
Advanced analytics.
Early bet access (30 minutes before free users).
Price: $9.99.
24.2 — Redeem Code Flow
1. Get a Season Pass redeem code (you'll need to generate these — check with how Codex set
this up, maybe directly in the Supabase season_passes table).
2. Enter the code on the Season Pass screen.
3. Tap Redeem.
4. Verify:
Season Pass activates.
Proﬁle or Settings shows you as a Season Pass holder.
Check Supabase → season_passes table: a row exists for your user_id and the current
season_year.
24.3 — Analytics Gating
1. Log in as a FREE user (no Season Pass).
2. Go to Proﬁle → ﬁnd the Analytics or Advanced Stats section.
3. Verify: The charts/data are blurred or partially hidden. You can see the shape of the data
but not the actual numbers. A "Get Season Pass" button is visible.
4. Find the "Watch video to unlock stats" button.
5. Tap it.
6. Verify: The stats unlock immediately (for now — this will be a real ad later). The blurred
content becomes readable.
24.4 — Analytics Unlocked with Season Pass
1. Log in as a Season Pass holder (use your redeemed code account).
2. Go to the analytics section.
3. Verify: All charts and data are fully visible — no blur, no unlock button, no "Get Season
Pass" prompt.
4. Verify the analytics show:
Win rate by bet type (separate percentages for straight, parlay, teaser).
Weekly proﬁt trend line (a chart showing your proﬁt each week).

--- PAGE 37 ---

Parlay hit rate.
Teaser record by point size (6 vs 6.5 vs 7).
Best/worst performing teams to bet on.
24.5 — Season Pass Exclusive Cosmetics
1. Go to the Cosmetics Shop.
2. Look for the exclusive Season Pass items.
3. Verify:
They're visually distinct from regular items (special border, "Season 1 Exclusive" tag,
or diﬀerent coloring).
Free users see them but CANNOT purchase them — they show a "Season Pass
Required" indicator instead of a coin price.
Season Pass holders CAN equip them.
24.6 — Early Bet Access
1. This test requires the app to enforce a timing window. If the mock data system supports
simulating the "new odds drop" moment:
Log in as a FREE user → Go to Bet Board → Verify: A message says odds will be
available in 30 minutes (or the board is locked).
Log in as a Season Pass holder → Go to Bet Board → Verify: You can already see and
select odds.
2. After 30 minutes pass, the free user should gain access too.
Test 25: Ad Hooks
25.1 — No Visible Ad Space (Current State)
Since no ad SDK is integrated yet, verify that ad hooks are completely invisible:
1. Go to the Leaderboard tab.
Verify: No blank space or placeholder at the bottom where a banner ad will eventually
go.
2. View a matchup result and navigate away.
Verify: No blank screen, no pause, no placeholder where an interstitial would
eventually appear.
3. The app should look and feel exactly the same as if ads didn't exist at all.

--- PAGE 38 ---

25.2 — Ad Hooks Hidden for Season Pass Holders
1. Log in as a Season Pass holder.
2. Repeat all the checks from 25.1.
3. Verify: Identical experience — no visible ad anything.
25.3 — Rewarded Ad Button (Analytics)
1. Log in as a FREE user.
2. Go to analytics.
3. Find the "Watch video to unlock stats" button.
4. Verify: The button exists, looks inviting (not punishing), has a play icon.
5. Tap it → Stats unlock immediately (placeholder behavior).
6. Verify: Log in as a Season Pass holder and go to analytics → this button should NOT appear.
Stats are just visible.
Test 26: Analytics Events
26.1 — Event Logging
1. Open the developer console or Metro terminal where the app logs output.
2. Perform each action below and verify a log entry appears:
Gameplay events:
Create a league → Look for "league_created" event
Join a league → "league_joined"
Place and submit bets → "bets_placed" (should include bet_type breakdown)
Settle a bet → "bet_settled" (should include result and proﬁt)
View a matchup → "matchup_viewed"
View your proﬁle → "proﬁle_viewed"
Send a chat message → "chat_message_sent"
Share a bet to chat → "bet_shared_to_chat"
Monetization events:
Open the shop → "shop_viewed"
Tap on an item preview → "shop_item_previewed"
Purchase a cosmetic → "cosmetic_purchased" (should include category and coin cost)

--- PAGE 39 ---

Equip a cosmetic → "cosmetic_equipped"
Open the coin store → "coin_store_viewed"
View the Season Pass screen → "season_pass_screen_viewed"
Redeem a Season Pass → "season_pass_redeemed"
Tap the "watch video" button on analytics → "rewarded_unlock_triggered"
Test 27: Edge Cases
27.1 — Network Loss During Bet Placement
1. Start adding bets to the slip (add 3-4 bets).
2. Turn oﬀ the simulator's network connection:
On your Mac: turn oﬀ Wi-Fi, OR
In Simulator: go to the top menu → Features → there may be a network toggle
3. Try to submit your bets.
4. Verify:
An error message appears about no network connection.
Your bets are still in the slip — you did NOT lose your work.
5. Turn the network back on.
6. Try submitting again.
7. Verify: Bets submit successfully.
27.2 — Odds API Down (Mock Mode)
1. Set an invalid API key in your .env ﬁle (change one character).
2. Set EXPO_PUBLIC_USE_MOCK_DATA=false (trying to use real API with a bad key).
3. Restart the app. Go to the Bet Board.
4. Verify: The app does NOT crash. It shows an error message about being unable to load
odds.
5. Set EXPO_PUBLIC_USE_MOCK_DATA=true again. Restart.
6. Verify: Mock games appear normally.
27.3 — Rapid Bet Selection
1. Go to the Bet Board. Tap odds buttons as fast as you possibly can — 5-6 taps in rapid
succession.
2. Verify:

--- PAGE 40 ---

The budget tracker stays accurate (no double-counting, no negative numbers).
No duplicate bets appear in the slip.
The app doesn't freeze or crash.
27.4 — Leave League Mid-Season
1. Log in as Player 4.
2. Go to Settings → Manage Leagues → ﬁnd a league → tap "Leave."
3. Verify:
A conﬁrmation dialog warns that this is permanent/irreversible.
4. Conﬁrm leaving.
5. Verify:
Player 4 no longer appears in the league standings.
The schedule for remaining players isn't broken (their matchups still make sense).
Past matchups that involved Player 4 are still viewable by other members.
27.5 — Long Display Names
1. Go to Settings → Edit Proﬁle → change your display name to something 50+ characters long
(like "TheUltimateActionArenaChampionOfTheWorld2026Forever").
2. Verify:
The name truncates gracefully everywhere: standings, leaderboard, matchup cards,
chat messages, member proﬁles.
Nothing overﬂows, breaks layout, or crashes.
27.6 — Concurrent Bet Placement
1. Log in as Player 1 on two diﬀerent simulators at the same time.
2. On Simulator A: build a bet slip for the H2H league.
3. On Simulator B: build a diﬀerent bet slip for the same league, same week.
4. Submit from Simulator A → Verify: Succeeds.
5. Submit from Simulator B → Verify: Rejected. The app tells you bets have already been
submitted for this week.

--- PAGE 41 ---

Test 28: Odds API Integration (Separate Track — Run When Ready)
28.1 — Live API Connection
1. Set EXPO_PUBLIC_USE_MOCK_DATA=false.
2. Make sure a sport with live odds is currently in season (NBA, MLB, NHL).
3. Open the Bet Board.
4. Verify: Real games appear with real odds from The Odds API.
5. Verify: All three markets load (moneyline, spread, over/under).
28.2 — Odds Refresh
1. Note the odds for a speciﬁc game.
2. Wait 5+ minutes (or pull-to-refresh).
3. Verify: If odds have changed on the API's end, the new odds appear in the app.
4. Place a bet on those old odds, then refresh.
5. Verify: Your placed bet still shows the odds at the time you locked it in — NOT the updated
odds.
28.3 — Settlement with Real Game Results
1. Place a bet on a real game that's happening soon.
2. After the game ﬁnishes, run the settlement function.
3. Verify: The result is fetched correctly from The Odds API.
4. Verify: Your bet settles correctly (win/loss/push matches the real game result).
28.4 — NFL Preseason Validation (Late August)
1. When NFL preseason games appear on The Odds API:
2. Switch to NFL in the app. Disable mock data.
3. Verify: Preseason NFL games appear with real odds.
4. Place bets including a teaser.
5. Verify: Teaser line adjustments calculate correctly against real NFL spreads.
6. After a preseason game ﬁnishes, settle.
7. Verify: Settlement works with real NFL data.
Final Testing Checklist
Before considering the app ready for real users, every box must be checked:

--- PAGE 42 ---

Authentication:
 Signup works end-to-end
 Signup validation catches all bad inputs
 Login works with correct credentials
 Login shows errors for bad credentials
 Session persists after closing and reopening app
 Logout works and prevents unauthorized access
Leagues:
 H2H and Cumulative leagues can be created
 Public leagues appear in browse
 Join via invite code works
 Join via public browse works
 Invalid codes show error
 Full leagues reject new members
 Duplicate joins are prevented
 Standings display correctly
 Matchup schedule generates correctly
 Odd-member leagues have proper bye rotation
Bet Placement — Straight:
 Games and odds display correctly
 Budget tracker updates accurately on add/remove/edit
 Payout math is correct for all three markets
 Multiple bets can be placed and managed in slip
Bet Placement — Validation:
 Minimum 5 bets enforced with clear message
 Maximum $35 per bet enforced
 Must allocate exactly $100 enforced
 Can't bet both sides of same game
 Can't duplicate selections across bet types
Bet Placement — Parlays:
 Parlay builder works with real-time combined odds
 2-6 leg limits enforced
 No same-game parlays allowed
 $500 payout cap warning and enforcement

--- PAGE 43 ---

 Parlay counts as 1 bet in budget tracker
Bet Placement — Teasers:
 Teaser builder shows adjusted lines correctly
 All four line adjustment directions work
 Only spread and O/U selectable (no moneyline)
 All 9 odds table combinations veriﬁed
 2-4 leg limits enforced
 Teaser counts as 1 bet
Lock of the Week:
 Cannot submit without designating a Lock
 Only one Lock allowed at a time
 Lock works on all bet types
 Lock is visually prominent everywhere
 Lock vs Lock visible in matchup detail
 1.5x multiplier correctly applied on wins AND losses
Settlement — Straights:
 Wins settle correctly with right proﬁt
 Losses settle correctly
 Pushes settle to $0
 Lock multiplier on wins correct
 Lock multiplier on losses correct
Settlement — Parlays:
 All-win parlays pay correctly
 One loss kills entire parlay
 Push drops leg and recalculates
 All-push = push
 Push to single leg = straight bet
 $500 cap enforced
 Lock multiplier on parlays correct
Settlement — Teasers:
 Evaluated against ADJUSTED lines (not originals)
 Push drops leg and uses new lookup odds
 Below minimum legs = push
 Diﬀerent sizes produce diﬀerent results on same game

--- PAGE 44 ---

 Lock multiplier on teasers correct
Matchups & Standings:
 H2H winners determined correctly
 Ties handled
 Cumulative updates correctly
 Missing bets handled (forfeit)
 Multi-week standings accumulate correctly
Proﬁle & Stats:
 All stats are mathematically accurate
 Best/Worst bet identiﬁed correctly
 Bet history complete with ﬁlters working
 Stats by bet type break down correctly
 All 6 achievements trigger correctly
 Member proﬁles show correct scoped data
Leaderboard & Awards:
 Rankings match standings
 Weekly view works
 Trend arrows display correctly
 Sharpest Bettor awarded correctly
 Degen of the Week awarded correctly
 Lock of the Week award shows correct bet
Social:
 Chat messages send and receive in real-time
 System messages appear for key events
 Shared bet cards render correctly with type badges and Lock eﬀects
 Chat stickers work (if purchased)
Notiﬁcations:
 Bet won notiﬁcation ﬁres
 Parlay leg progress notiﬁcations ﬁre
 Matchup result notiﬁcation ﬁres
 Bets not placed reminder ﬁres
 Opponent locked in notiﬁcation ﬁres
 Notiﬁcation preferences respected

--- PAGE 45 ---

Playoﬀs & Season:
 Clinch/elimination indicators work
 Playoﬀ bracket generates correctly
 Winners advance, losers eliminated
 Championship resolves
 End-of-season awards display correctly
 Season snapshot saved to database
Cosmetics:
 Shop displays items with previews
 Purchases deduct coins correctly
 Equipped items visible across all screens
 Only one item per category equippable
 Insuﬃcient coins handled gracefully
 Coin store shows packs with "coming soon"
Season Pass:
 Purchase screen shows all beneﬁts
 Redeem code works
 Analytics gated for free users (blurred preview)
 "Watch video" unlocks stats for free users
 Season Pass holders see full analytics
 Exclusive cosmetics only available to pass holders
 Early bet access works (if testable)
Ad Hooks:
 No visible blank space where ads will go
 Season Pass holders see no ad-related UI
 Rewarded ad button works on analytics screen
Edge Cases:
 Network loss handled gracefully
 API failure doesn't crash app
 Rapid tapping doesn't break budget tracker
 Leaving league mid-season works cleanly
 Long display names truncate properly
 Concurrent submissions prevented
Analytics Events:

--- PAGE 46 ---

 All gameplay events logging
 All monetization events logging
API Integration (when ready):
 Live odds load from real API
 Odds refresh works
 Settlement with real results works
 NFL preseason validation passes