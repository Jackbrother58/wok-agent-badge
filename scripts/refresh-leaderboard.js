// Refreshes docs/leaderboard.json from on-chain data.
// Run: node scripts/refresh-leaderboard.js
// (Intended to run on a cron: refresh + git commit + git push.)
const fs = require('fs');
const path = require('path');

const CONTRACT = '0x4de656203a7c533148fabf15ce77a558b8f3cb79';
const RPCS = [
  'https://bsc-dataseed.binance.org',
  'https://bsc-dataseed1.bnbchain.org',
  'https://bsc-dataseed2.bnbchain.org',
  'https://bsc-dataseed3.bnbchain.org',
  'https://bsc-dataseed4.bnbchain.org',
  'https://bsc.publicnode.com',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed.nariox.org',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || 'rpc error');
  return j.result;
}

async function rpcAny(method, params) {
  let lastErr;
  for (const url of RPCS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await rpc(url, method, params);
      } catch (e) {
        lastErr = e;
        if (attempt === 0) await sleep(2000);
      }
    }
  }
  throw lastErr;
}

function pad32(hex) {
  hex = hex.replace(/^0x/, '').toLowerCase();
  return '0x' + hex.padStart(64, '0');
}

async function ethCall(to, data) {
  return rpcAny('eth_call', [{ to, data }, 'latest']);
}

async function main() {
  // NOTE: no eth_getLogs anywhere in this script. Public BSC RPCs rate-limit
  // eth_getLogs with JSON-RPC -32005 "limit exceeded" (verified 2026-11-20
  // from this VM on 8+ public endpoints), while eth_call still works.
  // Minters are derived from totalMinted() + ownerOf(tokenId) instead.
  const totalMinted = parseInt(await ethCall(CONTRACT, '0xa2309ff8'), 16);

  const mints = [];
  for (let i = 1; i <= totalMinted; i += 50) {
    const chunk = [];
    for (let j = i; j <= Math.min(i + 49, totalMinted); j++) chunk.push(j);
    const owners = await Promise.all(
      chunk.map((id) =>
        ethCall(CONTRACT, '0x6352211e' + pad32('0x' + id.toString(16)).slice(2)).catch(() => null),
      ),
    );
    chunk.forEach((id, k) => {
      if (owners[k]) mints.push({ owner: '0x' + owners[k].slice(26), tokenId: id });
    });
  }

  // Current streak per minted token (batched, 20 at a time).
  const streaks = [];
  for (let i = 0; i < mints.length; i += 20) {
    const chunk = mints.slice(i, i + 20);
    const vals = await Promise.all(
      chunk.map((m) => ethCall(CONTRACT, '0x82efb8e3' + pad32('0x' + m.tokenId.toString(16)).slice(2)).catch(() => '0x0')),
    );
    chunk.forEach((m, j) => {
      const s = parseInt(vals[j], 16);
      if (s > 0) streaks.push({ tokenId: m.tokenId, owner: m.owner, streak: s });
    });
  }
  streaks.sort((a, b) => b.streak - a.streak || a.tokenId - b.tokenId);

  const out = {
    updatedAt: new Date().toISOString(),
    contract: CONTRACT,
    totalMinted,
    minters: mints,
    streaks,
  };
  const outPath = path.join(__dirname, '..', 'docs', 'leaderboard.json');
  // Don't rewrite (and don't bump updatedAt) when nothing changed, so the
  // auto-push cron only commits real changes.
  try {
    const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const same =
      prev.totalMinted === out.totalMinted &&
      JSON.stringify(prev.minters) === JSON.stringify(out.minters) &&
      JSON.stringify(prev.streaks) === JSON.stringify(out.streaks);
    if (same) {
      console.log(`leaderboard unchanged: ${mints.length} minters, totalMinted=${totalMinted}`);
      return;
    }
  } catch (e) {
    // No previous file (or unreadable) — write fresh below.
  }
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`leaderboard updated: ${mints.length} minters, ${streaks.length} with streaks, totalMinted=${totalMinted}`);
}

main().catch((e) => {
  console.error('refresh failed:', e.message);
  process.exit(1);
});
