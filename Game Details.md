# Campus Courier Clash

**COMP4021 Group 32 — Proposed Game Details**

## 1. Title of the Game

**Campus Courier Clash**

A competitive, two-player delivery game in which students race to deliver parcels across a busy campus while avoiding robots and disrupting their opponent.

## 2. Game Home Page

The home page will display the game description, objective, controls, and scoring rules.

- **Registration:** New players can create an account. The form will validate inputs and display appropriate error messages.
- **Sign-in:** Existing players can sign in with their account. Invalid credentials will produce a clear error message, and login sessions will be maintained in the browser.
- **Player pairing:** Players can create or join a room using a room code. The lobby will display both players' names and ready status. Each room supports exactly two players, and the match starts when both players are ready.

## 3. Game Play Page

### Game Overview

The game takes place on one small, top-down campus map rendered using HTML canvas. Two players control their characters simultaneously from separate browsers. Movements, parcel collection, collisions, scores, and other game events will be synchronized through WebSocket.

Players collect parcels from shared pickup locations and bring them to their own delivery desk. Each player can carry up to three parcels. Reaching their delivery desk deposits the carried parcels, with each delivered parcel earning one point under normal rules.

### Controls

| Input | Action |
| --- | --- |
| WASD or arrow keys | Move the player |
| Space | Dash, with a short cooldown between dashes |
| C | Enable or disable cheat mode |

### Player Interaction

Both players compete for the same parcels and power-ups. Dashing into the opponent makes them drop one carried parcel, which either player can collect. Players can use movement and dash timing to disrupt deliveries and gain an advantage.

### Game Elements

The game will include at least four animated and interactive element types:

| Element | Animation and Interaction |
| --- | --- |
| Players | Move and dash around the map, collect parcels, and collide with other entities. |
| Parcels | Use a bobbing or spinning animation, can be collected and delivered, and visibly scatter when dropped. |
| Campus robots | Patrol the map. Colliding with a robot briefly stuns the player and makes them drop one carried parcel. |
| Speed power-ups | Use an animated visual effect and temporarily increase a player's movement speed when collected. |

Static scenery, map boundaries, and interface text will not be counted as interactive element types.

### Interface and Sound

The game interface will show both players' names and scores, remaining time, the local player's carried parcel count, dash cooldown, and cheat mode status.

At least two different sound files will be used during gameplay, including a parcel pickup sound and a collision sound. Visual feedback will indicate deliveries, dropped parcels, stuns, and active speed boosts.

### Winning, Losing, and Match Duration

- The first player to deliver **12 parcels** wins immediately under normal scoring.
- Otherwise, the match ends after **three minutes**.
- When time expires, the player with the higher delivery score wins, and the other player loses.
- If both scores are equal when time expires, the match ends in a draw.
- Cheat mode changes delivery scoring as described in Section 5, allowing a player to reach the winning score much faster.

## 4. Game Over Page

The results page will display the winner or draw and useful statistics for each player:

- Final score.
- Parcels collected.
- Parcels delivered.
- Parcels dropped.
- Successful dash hits against the opponent.

An overall leaderboard across registered players will rank players by total wins, using total delivered parcels as a tie-breaker. Normal match results will update these cumulative statistics.

Players can request a rematch, which starts when both players agree, or return to the home page. Matches in which cheating was used will show their results but will not update the competitive leaderboard.

## 5. Cheating: Enabling and Disabling

Pressing **C** during gameplay toggles cheat mode for that player. A visible indicator will show whether it is enabled.

While cheat mode is enabled:

- The player's movement speed increases.
- Robot collisions do not stun the player or make them drop parcels.
- Each delivered parcel awards **12 points**, allowing the player to reach the winning score on their next delivery and finish the game quickly.

Pressing **C** again disables cheat mode, removes its speed and immunity benefits, and restores normal scoring for future deliveries. Previously awarded points remain part of the current match score. Cheat mode starts disabled for each new match.

## Implementation Scope

- Primarily reuse and extend the course lab code.
- Use HTML, CSS, and JavaScript for the browser interface and canvas gameplay.
- Use a single Node.js web server and WebSocket communication. Socket.IO may be used as permitted by the brief.
- Keep both browsers synchronized, with the server resolving shared events such as simultaneous parcel pickup and score changes.
- Do not use game engines or game development frameworks such as Phaser or Three.js.
- Support installing dependencies with `npm install`, starting the server directly with Node.js, and opening the game at `http://localhost:8000`.
- Complete one map and the core mechanics first. Extra maps, character selection, and additional power-ups are optional improvements.

## Submission Notes

- **Project details announcement:** Submit Sections 1–5 through the Announcements feature in the Canvas group area before **11:59 p.m., Friday, 13 November 2026**.
- **Final project and video:** Submit before **11:59 p.m., Monday, 30 November 2026**.
- **Project archive:** `32_project_files.zip`, containing all required project files and `package.json`; include `README.html` if additional instructions are useful.
- **Demonstration video:** `32_project_video.mp4`, lasting no more than five minutes, demonstrating all features with most of the video focused on gameplay.
- Only one group member needs to submit the final project files and video through Canvas.

Source: [Group Project brief](<Group Project.pdf>), especially pages 14–38. The game design above is a proposal based on those requirements.
