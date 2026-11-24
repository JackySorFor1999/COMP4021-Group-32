# Campus Courier Clash — COMP4021 Group 32

A real-time, two-player campus delivery game built with the course labs' Express,
Socket.IO, session, and canvas Sprite patterns. No game engine or frontend build
tool is used. All artwork and five sound files are included locally.

## Run

Install **Node.js 20 or later**, then open a terminal in this directory:

```sh
npm install
node game_server.js
```

Open **http://localhost:8000**. No bundling, asset generation, npm startup script,
external database, or second server is needed. See [README.html](README.html) for
the full illustrated-text instructions and marking guide.

## Play with two accounts

1. Register and sign in in a normal browser window.
2. Open a private window or a different browser and register/sign in as another
   player. Ordinary tabs share cookies, so use separate browser sessions.
3. Player one creates a room. Player two joins using its five-character code or
   the Open Shifts list. Both click **Ready for delivery**.
4. Use **WASD / arrow keys** to move and **Space** to dash. Collect up to three
   parcels; return to your own colored desk to deposit them automatically.
5. First to **12 points** wins. Otherwise, the higher score at **three minutes**
   wins; equal scores are a draw. The result includes both players' statistics,
   cumulative rankings, rematch, and a return to the home page.

Robots stun you and drop a parcel on contact. Dash into your rival to make them
drop one. Green speed power-ups last five seconds and respawn after twelve.
Touch/mouse direction buttons are also available on small screens.

## Cheat mode

Press **C** in the game to enable or disable cheat mode. When on, you move faster,
are immune to robots and dash hits, and score **12 points per delivered parcel**.
Delivering one parcel can therefore finish a match quickly. The HUD and character
display its status. Turning it off restores normal abilities and future scoring.
Every rematch starts with cheating off. A match that ever used cheating is marked
as practice and does not update cumulative rankings.

## Persistence and connection handling

Accounts and cumulative results are saved in `data/users.json`. Passwords are
salted and hashed with Node's built-in scrypt. The delivered ZIP starts with an
empty account database. Local accounts are excluded from Git; a fresh checkout
creates an empty database when the server first starts. Sessions use an HTTP-only
cookie and remain valid across page refreshes; restarting the server requires
signing in again.

Each account can play in one room and have one active game connection. Rooms are
independent, so multiple pairs can play at once. Refreshing or briefly disconnecting
holds a seat for **15 seconds** and rejoins the same match. Leaving a running
match forfeits to the connected opponent. A cancellation during the countdown
does not change rankings.

## Verification

```sh
npm test
```

The Node test suite covers input validation, password hashing, sessions,
unauthenticated connection rejection, room capacity, multiple independent rooms,
ready checks, collisions, shared pickups, scoring, timer endings, cheat toggling,
rankings, reconnection, and rematches. Test accounts use temporary directories;
the tests do not change your game database.

## Submission

- `32_project_files.zip`: runnable project sources, local assets, package files,
  documentation, and tests; excludes installed dependencies and test accounts.
- `32_project_video.mp4`: captioned demonstration, under five minutes.
- Deadline in the supplied brief: **11:59 p.m., 30 November 2026**.
- The details announcement is a separate Canvas task; the proposed text is in
  [Game Details.md](Game%20Details.md). Its original deadline was 13 November.
- [REQUIREMENTS.md](REQUIREMENTS.md) maps the implementation to the marking scheme.
- [LAB_REUSE.md](LAB_REUSE.md) explains which lab code was reused or extended.

Only one group member should submit the project ZIP and MP4 through Canvas.
Review the game and demonstration with your group before submitting.
