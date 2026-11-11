# Changelog

The update window in the app shows the release notes of the newest release; they are written from this file.

## v0.1.4

- **How long it's been running:** a working agent shows how long it has been at it (`<1m`, `36m`, `1h 12m`), in the working color; an agent waiting on you shows how long it has waited, in red. Resting ones still show how long they've rested.

## v0.1.3

- **Boards stay put:** a computer keeps the column it was given instead of moving when agents start and stop. Drag a board by its head to move it; `=` lays them all out again.
- **Preview card beside the row:** pointing at a row shows its card beside it, over the next column, so you can move straight down the list and each card replaces the last at once. No more card flashing under the row first.
- **Preview with the arrow keys:** moving the selection shows the selected item's card under it.

## v0.1.2

- **You are here:** the terminal you were in when the map opened has a box and a slowly blinking eye, never folds away, and the arrows start from it.
- **Calmer rows:** only a waiting agent gets a (red) box; working and done show by their mark and the color of their first words.
- **Resting tabs as rows:** in a space where everything rests, its tabs stay rows, newest first, dimmer in four steps by how long they've rested. Pills are only for sub-agents.
- **Hover card next to what you point at:** right under it (above when there's no room).
- **Tree lines:** a 2 px spine from each session, 1 px branches, all in the computer's color; every line ends at its last item with a rounded corner, starts under its parent's mark and stops just short of the child's.

## v0.1.1

- **Preview on hover:** pointing at a row, pill or cell shows a card at once with the last lines on that terminal's screen (read with `hc read`, at most every 15 s per terminal). The card sits over another column, so it never covers what you point at.

## v0.1.0

- **Agent Map** (`⌘G`): every computer, hc session, space, tab, agent and sub-agent in one window, as boards with a tree inside.
- A space whose one tab holds one agent is one line; the tree branches only where there are several tabs, terminals or sub-agents.
- Agents resting 12 hours or more, alone in their space, fold into small cells; spaces where everything rests fold into one line of tab pills.
- ↑↓ / ←→ to move, Enter or a click to go there, `/` to find, `a` everything, `s` shells, `l` English / Korean.
- "Update Agent Map" in the header when a newer release is out.
