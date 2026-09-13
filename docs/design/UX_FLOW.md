# UX flow

1. `/` explains the premise, team size, difficulty, expected duration and resume path.
2. Create returns a server-generated room id and navigates to `/room/:roomId`.
3. Game shell loads meta and state independently, showing loading and reconnect states.
4. Player focuses a node, reads task/project/event/market context, selects a market or hand card, then commits an action.
5. The command dock groups legal actions and preserves the server as the only rule source.
6. Pending choices become an accessible blocking dialog; revision conflicts replace cache with the server state.
7. Victory or defeat becomes a result dialog with tasks, influence and domains, then returns to the landing page.
8. Widths below the desktop threshold show a “请使用桌面端访问” message; the project does not maintain a separate mobile game layout.
