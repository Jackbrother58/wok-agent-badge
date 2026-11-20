// Refreshes docs/leaderboard.json from on-chain data.
// Run: node scripts/refresh-leaderboard.js
// (Intended to run on a cron: refresh + git commit + git push.)
const fs = require('fs');
const path = require('path');

const CONTRACT = '0x4de656203a7c533148fabf15ce77a558b8f3cb79';
const DEPLOY_BLOCK = 134698554;
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const CHECKIN_TOPIC = '0x58b5ff600c8f70ee1f1b0b8580a69c78ba78f51913156ca1d798fc4322c386d9';
const RPCS = [
  'https://bsc-dataseed1.bnbchain.org',
  'https://bsc.publicnode.com',
  'https://bsc-dataseed1.defibit.io',
];

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
    try {
      return await rpc(url, method, params);
    } catch (e) {
      lastErr = e;
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
  const fromBlock = '0x' + DEPLOY_BLOCK.toString(16);
  const logs = await rpcAny('eth_getLogs', [
    { fromBlock, toBlock: 'latest', address: CONTRACT, topics: [TRANSFER_TOPIC] },
  ]);
  const mints = (logs || [])
    .filter((l) => l.topics[1] === '0x0000000000000000000000000000000000000000000000000000000000000000')
    .map((l) => ({
      owner: '0x' + l.topics[2].slice(26),
      tokenId: parseInt(l.topics[3], 16),
      blockNumber: parseInt(l.blockNumber, 16),
      txHash: l.transactionHash,
    }))
    .sort((a, b) => a.tokenId - b.tokenId);

  const totalMinted = parseInt(await ethCall(CONTRACT, '0xa2309ff8'), 16);

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
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`leaderboard updated: ${mints.length} minters, ${streaks.length} with streaks, totalMinted=${totalMinted}`);
}

main().catch((e) => {
  console.error('refresh failed:', e.message);
  process.exit(1);
});
