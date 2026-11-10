# Changelog

The update window in the app shows the release notes of the newest release; they are written from this file.

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
