# Project verification

Branch: `Brandon`

## Git repair

The rebase conflict was an add/add conflict in `.gitignore`. The merged file keeps the Node, test, Java, and Maven ignore rules. The rebase applied all six commits and left no unresolved files.

## Campus Courier Clash

Start the game with:

```sh
npm install
npm start
```

Then open `http://localhost:8000`.

Checks completed:

- `npm test` passed all 21 tests.
- JavaScript syntax checks passed for the server, browser scripts, and tests.
- Two accounts registered and signed in from separate browser sessions.
- Room creation, joining, ready checks, and the shared match worked.
- The match ended after three minutes and showed the draw result, statistics, and leaderboard.

## Search engine project

- `mvn -q test` in `phase1/` passed.
- `mvn -q test` in `phase2/` passed 35 of 44 tests. The other 9 tests need a populated crawl index. `phase2/webapp/spider_db` is generated and ignored by Git, so a fresh checkout has no crawl data. Run `./RECRAWL.sh <seed-url>` before testing phase 2.

A small committed test fixture would make the phase 2 tests repeatable without a local crawl.
