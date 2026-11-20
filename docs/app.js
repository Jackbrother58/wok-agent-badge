// Wok Agent Badge — front-end. No backend, no stored sessions.
// Reads go to public BSC RPCs; writes go through the user's own wallet.
(function () {
  'use strict';

  var CONTRACT = '0x4de656203a7c533148fabf15ce77a558b8f3cb79';
  var AGENT_ID = '0x60b9262456de011f7d15a54cdd8c48baaa8b022f';
  var RPCS = [
    'https://bsc-dataseed.binance.org',
    'https://bsc-dataseed1.bnbchain.org',
    'https://bsc-dataseed2.bnbchain.org',
    'https://bsc-dataseed3.bnbchain.org',
    'https://bsc-dataseed4.bnbchain.org',
    'https://bsc.publicnode.com',
    'https://bsc-dataseed1.defibit.io',
    'https://bsc-dataseed.nariox.org',
  ];
  var SEL = {
    totalMinted: '0xa2309ff8',
    balanceOf: '0x70a08231',
    hasMinted: '0x38e21cce',
    mint: '0x1249c58b',
    checkIn: '0xe95a644f',
    streak: '0x82efb8e3',
    ownerOf: '0x6352211e',
  };

  var $ = function (id) { return document.getElementById(id); };
  var user = null;
  var myTokenId = null;

  function pad32(hex) {
    hex = hex.replace(/^0x/, '').toLowerCase();
    while (hex.length < 64) hex = '0' + hex;
    return '0x' + hex;
  }
  function toHex(n) {
    return '0x' + n.toString(16);
  }
  function shortAddr(a) {
    return a.slice(0, 6) + '…' + a.slice(-4);
  }

  function rpc(method, params) {
    var body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params });
    var tries = RPCS.map(function (url) {
      return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.error) throw new Error(j.error.message || 'rpc error');
          return j.result;
        });
    });
    // race: first success wins
    return Promise.any ? Promise.any(tries) : tries[0];
  }

  function ethCall(to, data) {
    return rpc('eth_call', [{ to: to, data: data }, 'latest']);
  }
  function parseUint(hex) {
    return parseInt(hex, 16);
  }

  function refreshSupply() {
    return ethCall(CONTRACT, SEL.totalMinted).then(function (r) {
      $('mintedCount').textContent = parseUint(r);
    }).catch(function () {
      $('mintedCount').textContent = '?';
    });
  }

  function refreshStreakBoard() {
    fetch('leaderboard.json').then(function (r) { return r.json(); }).then(function (d) {
      var el = $('streakBoard');
      el.innerHTML = '';
      if (!d.streaks || !d.streaks.length) {
        el.innerHTML = '<li class="muted">No check-ins yet — be the first.</li>';
        return;
      }
      d.streaks.slice(0, 20).forEach(function (s, i) {
        var li = document.createElement('li');
        li.textContent = '#' + (i + 1) + '  ' + shortAddr(s.owner) + '  ·  badge #' + s.tokenId + '  ·  ' + s.streak + '-day streak';
        el.appendChild(li);
      });
    }).catch(function () {
      $('streakBoard').innerHTML = '<li class="muted">Could not load streaks.</li>';
    });
  }

  function refreshRecent() {
    // Renders from leaderboard.json (precomputed on-chain by the cron).
    // No eth_getLogs: public BSC RPCs rate-limit it (-32005) and the file
    // already carries the same minters list.
    fetch('leaderboard.json').then(function (r) { return r.json(); }).then(function (d) {
      var el = $('recentBoard');
      el.innerHTML = '';
      if (!d.minters || !d.minters.length) {
        el.innerHTML = '<li class="muted">No mints yet — be the first.</li>';
        return;
      }
      d.minters.slice(-20).reverse().forEach(function (m) {
        var li = document.createElement('li');
        li.textContent = shortAddr(m.owner) + '  ·  badge #' + m.tokenId;
        el.appendChild(li);
      });
    }).catch(function () {
      $('recentBoard').innerHTML = '<li class="muted">Could not load recent minters.</li>';
    });
  }

  function findMyToken() {
    // Log-free lookup: scan ownerOf(tokenId) from the newest token down.
    // Public RPCs rate-limit eth_getLogs, so the site never calls it.
    return ethCall(CONTRACT, SEL.totalMinted).then(function (r) {
      var total = parseUint(r);
      var ids = [];
      for (var i = total; i >= 1; i--) ids.push(i);
      var chain = Promise.resolve(null);
      for (var c = 0; c < ids.length; c += 10) {
        (function (chunk) {
          chain = chain.then(function (found) {
            if (found !== null) return found;
            return Promise.all(chunk.map(function (id) {
              return ethCall(CONTRACT, SEL.ownerOf + pad32(toHex(id)).slice(2)).then(function (o) {
                return { id: id, owner: ('0x' + o.slice(26)).toLowerCase() };
              }).catch(function () { return null; });
            })).then(function (res) {
              for (var k = 0; k < res.length; k++) {
                if (res[k] && res[k].owner === user.toLowerCase()) return res[k].id;
              }
              return null;
            });
          });
        })(ids.slice(c, c + 10));
      }
      return chain;
    }).catch(function () { return null; });
  }

  function refreshEligibility() {
    var el = $('eligibility');
    var mintBtn = $('mintBtn');
    el.className = 'status';
    el.textContent = 'Checking your Agent ID…';
    mintBtn.disabled = true;
    ethCall(AGENT_ID, SEL.balanceOf + pad32(user).slice(2)).then(function (r) {
      var holds = parseUint(r) > 0;
      if (!holds) {
        el.textContent = 'This wallet does not hold an Agent ID, so it cannot mint.';
        el.classList.add('no');
        return;
      }
      return ethCall(CONTRACT, SEL.hasMinted + pad32(user).slice(2)).then(function (r2) {
        if (parseUint(r2) > 0) {
          el.textContent = 'You hold an Agent ID — and you already minted your badge.';
          el.classList.add('ok');
          return findMyToken().then(showMyBadge);
        }
        el.textContent = 'You hold an Agent ID — you can mint your free badge.';
        el.classList.add('ok');
        mintBtn.disabled = false;
      });
    }).catch(function () {
      el.textContent = 'Could not check eligibility right now. Try again.';
    });
  }

  function showMyBadge(tokenId) {
    if (!tokenId) return;
    myTokenId = tokenId;
    $('myBadgeBox').classList.remove('hidden');
    ethCall(CONTRACT, SEL.streak + pad32(toHex(tokenId)).slice(2)).then(function (r) {
      $('myBadgeInfo').textContent = 'Badge #' + tokenId + '  ·  current streak: ' + parseUint(r) + ' day(s).';
    }).catch(function () {
      $('myBadgeInfo').textContent = 'Badge #' + tokenId + '.';
    });
  }

  function waitReceipt(txHash) {
    return new Promise(function (resolve, reject) {
      var tries = 0;
      var tick = function () {
        tries++;
        rpc('eth_getTransactionReceipt', [txHash]).then(function (r) {
          if (r) return resolve(r);
          if (tries > 40) return reject(new Error('receipt timeout'));
          setTimeout(tick, 3000);
        }).catch(function () {
          if (tries > 40) return reject(new Error('receipt timeout'));
          setTimeout(tick, 3000);
        });
      };
      tick();
    });
  }

  $('connectBtn').addEventListener('click', function () {
    if (!window.ethereum) {
      $('walletStatus').textContent = 'No wallet found. Open this page inside your wallet app browser (Binance Wallet or MetaMask) on your phone.';
      return;
    }
    window.ethereum.request({ method: 'eth_requestAccounts' }).then(function (accounts) {
      user = accounts[0];
      return window.ethereum.request({ method: 'eth_chainId' }).then(function (chainId) {
        if (chainId !== '0x38') {
          return window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] }).catch(function () {
            throw new Error('Please switch your wallet to BNB Smart Chain (chain 56) and reconnect.');
          });
        }
      });
    }).then(function () {
      $('walletStatus').textContent = 'Connected: ' + shortAddr(user);
      $('walletBox').classList.add('hidden');
      $('mintBox').classList.remove('hidden');
      refreshEligibility();
    }).catch(function (e) {
      $('walletStatus').textContent = 'Connection failed: ' + (e && e.message ? e.message : e);
    });
  });

  $('mintBtn').addEventListener('click', function () {
    if (!user) return;
    $('mintBtn').disabled = true;
    $('mintStatus').textContent = 'Confirm the transaction in your wallet…';
    window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{ from: user, to: CONTRACT, value: '0x0', data: SEL.mint }],
    }).then(function (txHash) {
      $('mintStatus').innerHTML = 'Mint sent: <a href="https://bscscan.com/tx/' + txHash + '" target="_blank" rel="noopener">' + shortAddr(txHash) + '</a> — waiting for confirmation…';
      return waitReceipt(txHash);
    }).then(function (receipt) {
      if (receipt.status === '0x1' || receipt.status === 1) {
        $('mintStatus').textContent = 'Minted! Refreshing your badge…';
        refreshSupply();
        refreshRecent();
        return findMyToken().then(showMyBadge).then(refreshEligibility);
      }
      $('mintStatus').textContent = 'Transaction failed on-chain. No badge minted.';
      $('mintBtn').disabled = false;
    }).catch(function (e) {
      $('mintStatus').textContent = 'Mint cancelled or failed: ' + (e && e.message ? e.message : e);
      $('mintBtn').disabled = false;
    });
  });

  $('checkInBtn').addEventListener('click', function () {
    if (!user || !myTokenId) return;
    $('checkInBtn').disabled = true;
    $('checkInStatus').textContent = 'Confirm the transaction in your wallet…';
    window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{ from: user, to: CONTRACT, value: '0x0', data: SEL.checkIn + pad32(toHex(myTokenId)).slice(2) }],
    }).then(function (txHash) {
      $('checkInStatus').textContent = 'Check-in sent (' + shortAddr(txHash) + ') — waiting…';
      return waitReceipt(txHash);
    }).then(function (receipt) {
      if (receipt.status === '0x1' || receipt.status === 1) {
        $('checkInStatus').textContent = 'Checked in! Streak updated.';
        showMyBadge(myTokenId);
      } else {
        $('checkInStatus').textContent = 'Check-in failed on-chain.';
      }
      $('checkInBtn').disabled = false;
    }).catch(function (e) {
      $('checkInStatus').textContent = 'Check-in cancelled or failed: ' + (e && e.message ? e.message : e);
      $('checkInBtn').disabled = false;
    });
  });

  refreshSupply();
  refreshStreakBoard();
  refreshRecent();
})();
