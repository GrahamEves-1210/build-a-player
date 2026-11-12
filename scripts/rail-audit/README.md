# The bottom ad rail audit

The website runs an ad rail fixed to the bottom of the window on every page. Nothing a player can press may ever sit
under it, and nothing of ours may be drawn over it. This audit proves both, screen by screen. **Run it before every
push that touches a layout, a sheet, a new screen, or anything with `bottom`, `100dvh` or `position: fixed` in it.**

## Run it

```
npx vite --host ::1 --port 5245                  # the dev server (another terminal)
node scripts/rail-audit.mjs                       # everything; exit code 1 if anything is covered
node scripts/rail-audit.mjs --only career --sizes 390x844 --verbose      # one group at one size: a few minutes
node scripts/rail-audit.mjs --list                # the scenario groups
```

The whole matrix (every screen, six window sizes, three rail heights) is long: hours on a busy machine. Before a
push, run the groups the change touches at a small phone and a desktop:
`node scripts/rail-audit.mjs --only home,build,sim --sizes 320x568,1280x800d`.

It needs a Chromium (the Playwright one under `%LOCALAPPDATA%\ms-playwright`, or `CHROME=<path to chrome>`) and
Node 22 or newer. One headless browser, one window size after another. It never makes a real ad request (the ad
hosts are blocked; the rail is simulated), never signs in, and nothing it does is written anywhere: analytics and
every non-GET request to another host are answered locally, and sockets to other hosts never open. The dev server
has to be the dev server (`vite`, not a production build): the scenarios write saves with the game's own modules.

Options: `--sizes 320x568,390x844,1280x800d` (`d` = desktop), `--heights 56,106,150s` (the rail's box; `s` = the
taller unit, with no id or class the site could know it by), `--only <groups or scenario names>`, `--shots <dir>` (a
screenshot of every screen, and of every finding as `fail-…`), `--json <file>`, `--verbose`, `--explore` (prints
what is clickable on each screen: for writing scenarios), `--speed <n>` (the site's clock, default 4x), and
`--no-rail --shots <dir>` (no audit: the same walk with no ad, a screenshot of each screen; a layout with no ad must
not move, so run it before and after a change and compare).

## What it checks

On every screen, at every window size (320x568, 360x740, 390x844, 430x932, 1280x800, 1440x900), with the rail at
every height: 56 and 106 with Playwire's own id, and a 150 one that is just a box fixed to the bottom with an ad's
iframe in it, on the very top layer. A 16px close tab stands above each. The rail that was there while the screen
laid out counts as "before"; the other heights arrive with the screen already open ("after"), the way a real ad
loads late or is swapped for a taller one.

1. **The measurement.** `--web-rail` must reach the rail's real height, close tab included.
2. **Pinned under the rail.** Anything interactive that is fixed or sticky and touches the rail's band.
3. **Under the rail at the end of its scroller.** Every scroller on the screen is scrolled to its end; anything
   interactive still touching the band is reported (a button at the end of a page with no room to scroll clear).
   "Interactive" is a button, link, input, anything with a role or a tabindex, and anything React gave a click or
   pointer handler. It only counts where it would really take the tap (not behind another layer of ours).
4. **The ad itself.** A screenshot of the ad's box must be the simulated ad's flat colour: a sheet, a scrim or a
   screen drawn over it is reported with the element that covers it. (A faint shadow falling on it is noted, not
   failed.)

Mini games are not audited: the site takes every ad away while one is open (`ads-hidden`), and the report says so.
The report also lists what a scenario could not reach.

## The files

- `scripts/rail-audit.mjs`: the runner and the report.
- `rail-audit/scenarios.mjs`, `scenarios-modes.mjs`: every screen, as scripts. **A new screen, sheet or mode gets a
  line here.** Three tools do most of the work (`flow.mjs`): `sheet()` opens something, audits it and closes it;
  `walk()` plays a flow forward, auditing each new kind of screen; `crawl()` presses everything on a screen once
  and audits whatever opens. `seed.js` writes saves with the game's own code (a Career mid-season, at an injury,
  in the offseason, retired; a finished build; a made-up signed-in player, offline), so a scenario starts in the
  middle of a flow.
- `rail-audit/rail-sim.js`: the simulated rail and the check itself. The dev server's rail preview uses this file.
- `rail-audit/inpage.js`, `helpers.js`, `audit.mjs`, `cdp.mjs`: no writes and the fast clock; the page-side
  helpers; one screen's audit; the browser driver.

## While you work: the rail preview

On the dev server, add `?rail` to any address (`?rail=106` for a height, `?rail=150s` for the tall unnamed unit,
`?rail=0` to turn it off; it stays on for the tab until then). It puts the same simulated rail on the page, and
anything interactive that ends up under it is outlined in red and listed in the console as you move through the
site (`src/lib/railGuard.js`). It is not in a production build.

## How the site keeps clear (what to follow in new work)

- `src/lib/railWatch.js` measures the rail into `--web-rail` (0 when there is no ad) and sets `html.has-rail` while
  there is one. It knows a rail by what it is (a third-party box fixed to the bottom edge with an ad in it), not by
  one unit's name. Use the variable; never a fixed number.
- A screen in the app look is an `.ag-screen` (or Home): its end padding already clears the dock and the rail.
- A sheet, a modal or any full-screen layer over a page ends at the top of the rail: use one of the shared overlay
  classes, or add the new class to the list (app-game.css, "nothing under the bottom ad rail", rule 1).
- A bar pinned to the bottom uses `bottom: var(--web-rail, 0px)` plus whatever else it clears.
- A page that scrolls itself and is not an `.ag-screen` gets the rail's height as room at its end (rule 3).
- Every such value is 0 with no rail, so a player without ads sees no change.
