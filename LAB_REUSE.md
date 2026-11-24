# Course lab reuse

The source lab directories were found in the surrounding `COMP_4021` course
folder. Their contents were read and extended for this project; they are not
required at runtime and are not modified by the project.

| Lab source | Reused or extended in this project |
| --- | --- |
| Lab 3 `gem_rush/sprite.js` | Copied into `public/scripts/sprite.js` with an attribution header. The original Sprite factory, sprite sheet loading, sequence timing, scaling, shadows, drawing, and update methods animate every courier, parcel, robot, and power-up. |
| Lab 3 `gem_rush/bounding_box.js` | Copied into `public/scripts/bounding_box.js` with an attribution header. It remains the bounding-box dependency used by the Sprite module's `getBoundingBox` API. Server collision checks extend the same bounding-region concept with circle/rectangle checks so clients cannot claim collisions. |
| Lab 3 `gem_rush/player.js` and `gem_rush.html` | Direction and last-facing state, speed changes, bounds checks, keyboard event handling, and the `requestAnimationFrame` update/draw design inform `server/game.js` and `public/scripts/courier_game.js`. Movement is time-based and moved to the server for multiplayer consistency. |
| Lab 5 `game_room/game_server.js` | Express static serving, JSON request middleware, `express-session`, file-backed accounts, `/register`, `/signin`, `/validate`, and `/signout` form the account/server foundation in `game_server.js` and `server/accounts.js`. Registration rechecks duplicates after hashing, as in the completed lab. Hashing uses Node's built-in scrypt instead of a native argon2 package. |
| Lab 5 `public/scripts/game_room.js` | The `GameRoom` IIFE, `init`/`validate` structure, registration confirmation, fetch-based account requests, signed-in user state, and page switching are adapted in `public/scripts/game_room.js`. DOM APIs replace jQuery selectors. |
| Lab 6 `hand_game/game_server.js` | The shared HTTP/Socket.IO server and event lifecycle (`join`, `ready`, `update_players`, `game_start`, `game_end`, `disconnect`) are extended in `game_server.js`. The original global waiting area becomes a map of independent two-player rooms, with session authentication and reconnection handling. |
| Lab 6 `public/scripts/hand_game.js` | Connection/error handling, ready UI, multiplayer page transitions, result rendering, and restarting are extended in `public/scripts/game_room.js`. |

The campus delivery mechanics, server simulation, room-code pairing, persistent
rankings, original map/sprite artwork, sound assets, interface design, and tests
are new project work built on these foundations. No Phaser, Three.js, or other
game engine is used. No frontend build system is required.

The game relies on standard web development libraries only: Express,
express-session, and Socket.IO. The browser explicitly uses Socket.IO's WebSocket
transport, and both players send controls rather than trusted positions or scores.
