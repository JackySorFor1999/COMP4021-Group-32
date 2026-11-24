# Group project requirements and verification

Source: the supplied `Group Project.pdf`, particularly pages 14–38. This checklist
describes implementation evidence; it does not promise a particular mark.

| Requirement / maximum marks | Implementation evidence |
| --- | --- |
| Home: description and instructions (5) | Home page has the objective, three-step rules, controls, win/lose conditions, and a full instructions dialog. |
| Home: registration (10) | Display name, username, password, confirmation; browser and server validation; duplicate detection; salted password hashing; persistent account file. |
| Home: sign-in (10) | Credential verification, error messages, HTTP-only session cookie, `/validate` restoration after refresh, sign-out. |
| Home: pairing (15) | Create/join five-character room codes, open-room list, two visible player slots, ready checks, room capacity validation. |
| Gameplay: things in the game (30) | Four animated/interactive types: couriers, collectible/droppable parcels, moving robots, and collectible speed power-ups. Static scenery is additional and is not counted. |
| Gameplay: player interaction (20) | Shared contested pickups, simultaneous movement, dash hits and dropped parcels, shared scores/state via WebSocket. |
| Gameplay: controls (10) | WASD / arrows, Space dash, C cheat toggle; small-screen mouse/touch buttons. |
| Gameplay: duration (10) | Server-enforced 180-second match limit, or earlier finish at 12 points. |
| Gameplay: cheat mode (15) | C toggles visible speed/immunity/scoring benefits on/off. One delivered parcel wins while enabled. Fresh matches reset cheating. |
| Results: statistics (10) | Both players' score, collected/delivered/dropped parcels, dash hits, robot collisions, and match duration. |
| Results: ranking (10) | Overall registered-player leaderboard by cumulative wins, then deliveries; persisted in the account file. Practice/cancelled matches are excluded. |
| Results: restart/home (10) | Mutual rematch requests and Back to dispatch button. |
| Graphics and sound (10) | HTML canvas map and lab Sprite animations; five distinct local WAV files played using HTML `<audio>` elements. |
| Running the project (15) | `npm install`, then `node game_server.js`, then `http://localhost:8000`. One server; local assets; no build script. |
| Multi-user support (30) | Each pair plays simultaneously; multiple rooms are independent; one account cannot occupy multiple seats; disconnect grace/rejoin and forfeit handling. |
| Game quality (50) | Original campus theme/art, feedback animations, sound toggle, HUD, cooldowns, symmetric map, coherent home/lobby/game/results screens. Final assessment is the instructor's. |
| Details announcement (20) | `Game Details.md` contains the proposed five required sections. **Your group must verify/post its own Canvas announcement.** Original deadline: 13 November 2026. |
| Project video (20) | `32_project_video.mp4` is the captioned demonstration. Review it before submitting; the brief requires ≤5 minutes and mostly gameplay. |

## Technical constraints

- Single Node.js server; standard web libraries only; no game engine.
- Course code reused/extended as documented in `LAB_REUSE.md`.
- Canvas gameplay, two players in different browser sessions, actual WebSocket
  transport, persistent accounts/rankings, and at least two sound files.
- Project ZIP and MP4 submitted through Canvas by one group member. Deadline in
  the supplied brief: 11:59 p.m., 30 November 2026.

## Automated verification

Run `npm test`. The suite covers the simulation and live HTTP/WebSocket server:
validation/hashing, private data protection, authenticated sessions, duplicate
connections, room limits, four simultaneous clients in two rooms, ready checks,
rejoining a match, result persistence, rematches, countdown cancellation, movement
bounds, normalized input, contested pickups, bag limits, delivery ownership,
robot collisions, dash hits/cooldown, boost timers, cheat toggling/quick wins,
normal wins, simultaneous wins, timeout wins, and draws.

## Manual browser verification

- Two separate cookie sessions register, sign in, create/join, and ready up.
- Both browsers render the same match and scores.
- Movement, parcels, collisions, boosts, dash, cheat on/off, quick finish, and
  result pages work through the actual interface.
- Refresh restores the signed-in account and the same active match.
- Home and gameplay layouts checked at narrow and desktop widths.
- Canvas sprites and all five audio assets load locally; browser logs checked.
- The delivered archive is installed and checked independently of development
  dependencies. Runtime data in the archive starts empty.
