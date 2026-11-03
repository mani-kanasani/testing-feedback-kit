# The prompt

Open Claude Code in your app's folder and paste this. It reads the kit's own instructions, looks at your app, tells
you its plan and asks you three things before it changes anything.

```text
Add the Testing and Feedback Kit to this app: https://github.com/mani-kanasani/testing-feedback-kit

1. Clone it with git clone --depth 1 into a temporary folder outside this project, and read its INSTALL.md from start
   to end before you change anything here.
2. Look at this app as INSTALL.md step 1 says: the framework, the router, the backend and sign-in, the layout, the
   menu and the theme. Tell me in a few lines what you found and your plan, then ask me what step 1 asks, each as two
   or three choices with the one you recommend.
3. Then follow INSTALL.md step by step: copy the kit in, the styles in this app's colours, the database on my local
   or development database only, the page, the menu item, the floating button, the bell, and the agent if I said yes.
4. Check it the way INSTALL.md step 8 says, look at the page in a browser at a phone's width and at a laptop's, and
   tell me what you checked and what you did not.

Rules: never print or commit a key or a password. Never put the service role key in browser code or in the agent
server. Do not touch my production database, or deploy, without my yes in this conversation. Change nothing in the
app that the kit does not need.
```

## After it is in

To have the agent work the tickets, say this in Claude Code in the same project:

```text
Work the feedback queue.
```

It takes the most urgent open ticket, fixes it, says what it changed, and moves it to In review. Then you, or the
person who filed it, test it and mark it Done.
