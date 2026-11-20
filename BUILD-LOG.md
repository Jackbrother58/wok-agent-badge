# BUILD LOG — Wok Agent Badge (Binance Agent ID Hackathon)

## Status: CONTRACT + SITE LIVE — ready to submit (2026-11-20 ~20:30 WIB)

## Project
- **Name:** Wok Agent Badge (token: `Wok Agent Badge`, symbol `WOKAB`)
- **Concept:** free-mint badge NFT gated by Agent ID + daily on-chain check-in streak + public leaderboard.
- **Repo:** https://github.com/Jackbrother58/wok-agent-badge (public, MIT)
- **Site:** https://jackbrother58.github.io/wok-agent-badge/ (GitHub Pages, `main` / `docs`)
- **Submit deadline:** 9 Dec 2026 15:00 WIB. Review internal 9–17 Des, publik 17–20 Des.

## Contract (BSC 56)
- **Address:** `0x4de656203a7c533148fabf15ce77a558b8f3cb79`
- **Deploy tx:** `0x8b4f46d81cd69ed62b64b30ee471c8635c7da03684cbe7236c490a54a67f5ebd`
  (block 134698554, status 1, gasUsed 1,365,938, effectiveGasPrice ~0.103 gwei,
  cost ~0.000141 BNB)
- **BscScan:** https://bscscan.com/address/0x4de656203a7c533148fabf15ce77a558b8f3cb79
- **Verification:** Sourcify `exact_match` (creation + runtime), job
  `d2681f80-3870-4e23-a619-02366b0c5646`. BscScan shows Sourcify-verified
  contracts as verified. (Direct BscScan API verification needs an API key —
  none exists; parent can do it via the BscScan web form if the judges want
  the BscScan-native badge.)
- **How deployed:** no private key exists for the wallet. Deployed via the
  Arachnid deterministic deployment proxy
  (`0x4e59b44847b379578588920ca78fbf26c0b4956c`) with CREATE2, called through
  `baw contract-call` preview → execute (both previews clean: simulation
  success, zero risks, no App confirmation needed). Salt:
  `keccak256("WokAgentBadge-v2")` =
  `0x1b50708c02489893736be47b5e55908d6db454c534411adee4f74e8d1f4d100d`.
- **Verified on-chain state (post-deploy):** name `Wok Agent Badge`, symbol
  `WOKAB`, owner = user wallet `0x06Ad…632b`, `AGENT_ID()` =
  `0x60b9262456de011f7d15a54cdd8c48baaa8b022f`, `MAX_SUPPLY()` = 1000,
  `totalMinted()` = 0, `mintPaused()` = false,
  `baseURI()` = `https://jackbrother58.github.io/wok-agent-badge/metadata/`.
- **User Agent ID check:** `balanceOf(user)` on the Agent ID contract = 1 —
  the user CAN mint (badge #1 is theirs to mint from their phone).
- **Gas math (pre-deploy):** balance 0.0039126 BNB; est. deploy gas
  1,389,956 @ ~0.1 gwei ≈ 0.00014 BNB. Balance after both deploys:
  0.0036024 BNB (total spent ≈ 0.00031 BNB).

## V1 deploy — SUPERSEDED (do not use)
- **Address:** `0x75cf505ec31fea5d1c0a4d19573cce21917079d1`
- **Deploy tx:** `0x957ec761cf7d66bb4c127caea7e090a38e5ee621a18f0315b9cca1cbc3f27eba`
  (block 134698372, status 1, gasUsed 1,364,850, ~0.000169 BNB)
- **Bug:** constructor used `Owned(msg.sender)`, but under CREATE2-via-proxy
  `msg.sender` is the proxy, so the owner became the proxy contract
  (immutable, can never call `setBaseURI`/`setMintPaused`). Found from the
  `OwnershipTransferred(0x0 → proxy)` log. Contract itself was functional
  (mint/check-in fine), but owner powers were dead. Fixed in v2 by passing
  the owner explicitly as a constructor arg. V1 has 0 mints and is abandoned.

## Contract design
- Solidity 0.8.36, Solmate ERC721 + Owned, optimizer runs = 1 (small deploy).
- `mint()`: free (non-payable), requires Agent ID `balanceOf > 0`, 1/wallet,
  cap 1000. `checkIn(tokenId)`: once/day, streak increments on consecutive
  days, resets otherwise; emits `CheckIn(tokenId, owner, streak, day)`.
- Owner powers (documented in README + site): `setBaseURI`, `setMintPaused`
  only. No mint-for-others, no supply change, no fund holding, no royalties.
- Tests: 17 Foundry tests, all passing (`forge test`).
- Red lines: no QR login, no session storage, no approval requests, no
  "Binance"/"BNB" in project/token/domain names, no seed/key collection,
  no promised returns, Agent ID never used to look up other people's wallets.

## Site (`docs/`, GitHub Pages — verified live 200)
- `index.html` / `style.css` / `app.js` — mobile-first, vanilla JS, no backend.
- Flow: connect injected wallet → switch to BSC 56 → on-chain Agent ID check
  → mint (user confirms in own wallet) → check-in + streak display.
- Reads via public BSC RPCs (CORS verified `access-control-allow-origin: *`).
- `badge.svg`, `metadata/1..1000.json` (generated), `leaderboard.json`
  (refreshed from on-chain events by `scripts/refresh-leaderboard.js`).
- Leaderboard auto-refresh cron: every 30 min, refresh + push only on real
  change (script skips rewrite when minters/streaks/total are unchanged).

## Submit materials (copy-ready for the form)
- **Project name:** Wok Agent Badge
- **Website:** https://jackbrother58.github.io/wok-agent-badge/
- **Contract:** 0x4de656203a7c533148fabf15ce77a558b8f3cb79 (BNB Smart Chain)
- **Agent ID usage:** `mint()` gates on `balanceOf(msg.sender) > 0` on the
  Agent ID contract (0x60b9262456de011f7d15a54cdd8c48baaa8b022f); the badge is
  the holder's Agent ID identity on-chain and the daily check-in streak is
  tied to it. The site only checks the connected wallet's own Agent ID.
- **Reward receiving address:** user wallet 0x06AdAB5426FD95109705e29e4CE38dec8069632b
  (confirm with user at submit time).
- **Submit entry point:** "Submit Project Now" button on the Square post
  https://www.binance.com/en/square/post/389517345917641 — the exact form
  URL is NOT exposed in text fetches (Binance pages are JS-rendered; curl
  returns empty). Parent must open the post in the live browser and click
  through. Do NOT guess a form URL.

## Promo drafts (NOT posted — user posts from their phone)
- `promo/post-facebook-id.md` — FB, Indonesian, 1 hashtag.
- `promo/post-x-en.md` — X, English, ~249 chars, both hackathon hashtags.
- Note: the user's X promo-award post for the hackathon itself was already
  posted separately (link sent to parent ~19:44 WIB).

## Timeline (WIB, 2026-11-20)
- 19:39 user drops Binance announcement link; parent briefs build.
- 19:44 coordinator starts. Balance 0.0039126 BNB; devMode enabled; BSC gas
  0.06–0.23 gwei; baw has no deploy command → CREATE2 factory path chosen.
- ~20:00 contract written + 17 tests passing; CREATE2 prep done.
- ~20:05 v1 deployed (owner=proxy bug found via OwnershipTransferred log).
- ~20:10 v2 deployed with explicit owner arg; state verified on-chain.
- ~20:15 Sourcify exact_match verified.
- ~20:20 repo created + pushed; GitHub Pages enabled; site verified live 200
  (index, badge.svg, metadata/1.json, leaderboard.json).
- ~20:30 promo drafts + build log done; leaderboard cron set up.

## Fix 2026-11-20 ~20:45 WIB — eth_getLogs rate limit (leaderboard + site)
- **Problem:** `scripts/refresh-leaderboard.js` failed twice with JSON-RPC
  `-32005 "limit exceeded"` on `eth_getLogs`. Verified from this VM:
  `eth_blockNumber`/`eth_call` work, but `eth_getLogs` is rate-limited on
  ALL public BSC RPCs tried (binance.org dataseed, publicnode, drpc
  max-100-blocks, 1rpc usage-limit, blastapi/Alchemy rate-limit,
  llamarp/meowrpc timeout). BscScan API is also unusable: `api.bscscan.com`
  301-redirects to docs HTML; Etherscan V2 says "Free API access is not
  supported for this chain" (BSC not on free V2 plan).
- **Fix (log-free everywhere):** leaderboard script now derives minters from
  `totalMinted()` + `ownerOf(tokenId)` (eth_call only, batched 50). Site
  `app.js`: `refreshRecent()` renders from `leaderboard.json` instead of
  live logs; `findMyToken()` scans `ownerOf` from newest token down.
  RPC list widened to 8 endpoints (site races them, script falls back).
  Verified: script runs clean, syntax OK, no `eth_getLogs` call left.
- **Discovery while testing the fix — 7 REAL MINTS:** `totalMinted()` = 7
  (verified by direct eth_call). Badge #1–#7 held by 7 distinct wallets
  (see `docs/leaderboard.json`); spot check: #1 owner Agent ID balanceOf
  = 1, so the gate works — all 7 are verified Agent ID holders. User wallet
  (0x06Ad…632b) is NOT among them — user has not minted yet. No check-ins
  yet (0 streaks). **That is 7/30 Agent ID interactions toward the
  Innovation Award threshold, ~40 minutes after the site went live.**
  How they found it is unknown (parent/user may have shared the link, or
  holders found the verified contract) — do NOT assume; just report the
  on-chain fact. Leaderboard auto-push will publish these 7 on the site.

## Open items for parent/user
1. **User mints badge #1 from their phone** (open the site in Binance
   Wallet browser → connect → mint). This is also the first live end-to-end
   test of the mint flow.
2. **Submit the project** via the "Submit Project Now" button (live browser;
   exact form URL unknown from text fetches — see above).
3. **Promotion to reach 30 Agent ID interactions** before 9 Dec 15:00 WIB:
   user posts the FB + X drafts; parent can also run the radar/FB channels.
   Current count: 0 interactions (0 mints).
4. Optional: direct BscScan-native verification (needs a BscScan API key;
   Sourcify exact_match already satisfies "verified source" on BscScan).
5. Sessions: all build sessions must be closed before Sat 21 Nov 07:00 WIB
   (make.fun gta6-trophy-guide-01 round 8 recording seal sweeps all live
   sessions). This build is done; no build session should stay alive past
   that window.
