# Roles manual smoke test

The unit tests cover the logic. This checks the parts they can't: real QueUp endpoints, real socket events, and the live roles refresh. It takes about 5 minutes.

## You'll need

- A QueUp room where you can manage roles
- A **bot** account, whose role you can edit
- A second account (**alt**) in the room, e.g. in a private browser window, to act as the target

## Setup

1. In the room's role settings, give the bot's role **`roles.manage`** and **`members.kick`**, and drag it **above DJ**.
2. From the root of the repo, start the smoke test bot:

   ```
   QUEUP_USER=<bot username> QUEUP_PASS=<bot password> QUEUP_ROOM=<room slug> node test/bot.js
   ```

   It connects the bot, logs role and kick events, and opens a prompt. In the prompt you can run `bot.*` commands and a `cb` command to print Http status codes.
3. Once the `>` prompt appears, run `var alt = bot.getUserByName('<alt username>', true)`.

## Checks

| # | Do | Expect |
|---|---|---|
| 1 | Start the bot | `connected to ...` with no `ERROR`. `bot.getRoles().length` matches the number of roles in the room's settings. |
| 2 | In the browser, give alt **DJ** | No crash (the #40 regression). `EVENT user-setrole` prints, and `bot.isDJ(alt)` is `true`. |
| 3 | In the browser, remove DJ from alt | `EVENT user-unsetrole` prints, and `bot.isDJ(alt)` is `false`. |
| 4 | In the browser, take **`members.kick`** off the bot's role, wait 2 s, then put it back | While it's off, `bot.hasPermission(bot.getSelf(), 'kick')` is `false`. Once it's back, it's `true` again. |
| 5 | `bot.moderateSetRole(alt.id, 'dj', cb)`, then `bot.moderateUnsetRole(alt.id, 'dj', cb)` | Both return `true` and print `HTTP 200`. In the browser, alt gains DJ and then loses it. |
| 6 | `bot.moderateKickUser(alt.id, 'smoke test', cb)` | Returns `true` and prints `HTTP 200`. alt is kicked. |

Checks 1–4 confirm that roles load and stay up to date from real data. Checks 5–6 exercise the new role endpoints and the kick request against QueUp.

## Cleanup

Put the bot's role back how it was.