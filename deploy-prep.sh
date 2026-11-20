#!/usr/bin/env bash
# Prepare CREATE2 deployment of WokAgentBadge via the Arachnid deterministic
# deployment proxy on BSC (0x4e59b44847b379578588920ca78fbf26c0b4956c).
# Outputs: init code, salt, predicted CREATE2 address, gas estimate.
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH" FOUNDRY_DISABLE_NIGHTLY_WARNING=1
cd ~/workspace/hackathon-agent-id

PROXY=0x4e59b44847b379578588920ca78fbf26c0b4956c
AGENT_ID=0x60b9262456de011f7d15a54cdd8c48baaa8b022f
DEPLOYER=0x06AdAB5426FD95109705e29e4CE38dec8069632b
RPC=https://bsc-dataseed1.defibit.io

BYTECODE=$(forge inspect WokAgentBadge bytecode)
ARGS=$(cast abi-encode "constructor(address,address)" "$AGENT_ID" "$DEPLOYER")
INIT="${BYTECODE}${ARGS#0x}"
echo "$INIT" > out/init-code.txt
SALT=$(cast keccak "WokAgentBadge-v2")
echo "salt: $SALT"
echo "init code bytes: $(( (${#INIT} - 2) / 2 ))"

INIT_HASH=$(cast keccak "$INIT")
echo "init code hash: $INIT_HASH"
PREIMAGE="0xff${PROXY#0x}${SALT#0x}${INIT_HASH#0x}"
ADDR_HASH=$(cast keccak "$PREIMAGE")
PREDICTED="0x${ADDR_HASH: -40}"
echo "predicted CREATE2 address: $PREDICTED"
echo "$PREDICTED" > out/predicted-address.txt

DATA="${SALT}${INIT#0x}"
echo "$DATA" > out/factory-calldata.txt
echo "factory calldata bytes: $(( (${#DATA} - 2) / 2 ))"

echo "--- gas estimate (eth_estimateGas, from deployer, to proxy) ---"
python3 - <<'EOF'
import json, urllib.request
data = open('out/factory-calldata.txt').read().strip()
for rpc in ['https://bsc-dataseed1.defibit.io','https://bsc-dataseed1.bnbchain.org']:
    payload = json.dumps({"jsonrpc":"2.0","id":1,"method":"eth_estimateGas","params":[{"from":"0x06AdAB5426FD95109705e29e4CE38dec8069632b","to":"0x4e59b44847b379578588920ca78fbf26c0b4956c","value":"0x0","data":data}]}).encode()
    req = urllib.request.Request(rpc, data=payload, headers={'Content-Type':'application/json'})
    try:
        r = json.loads(urllib.request.urlopen(req, timeout=30).read())
        if 'result' in r:
            gas = int(r['result'], 16)
            print(rpc, '-> gas', gas, '| @0.1 gwei:', gas*0.1/1e9, 'BNB | @0.23 gwei:', gas*0.23/1e9, 'BNB | @1 gwei:', gas/1e9, 'BNB')
        else:
            print(rpc, '-> ERROR', r)
    except Exception as e:
        print(rpc, '-> EXC', e)
EOF
