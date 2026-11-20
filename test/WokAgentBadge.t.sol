// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {WokAgentBadge} from "../src/WokAgentBadge.sol";
import {ERC721} from "solmate/tokens/ERC721.sol";

/// Minimal mock of the Agent ID contract: balanceOf returns 1 for holders.
contract MockAgentID {
    mapping(address => bool) public holds;
    function setHolds(address who, bool v) external {
        holds[who] = v;
    }
    function balanceOf(address who) external view returns (uint256) {
        return holds[who] ? 1 : 0;
    }
}

/// A receiver that correctly implements onERC721Received.
contract GoodReceiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return 0x150b7a02;
    }
}

/// A contract with no ERC721 receiver hook.
contract BadReceiver {}

contract WokAgentBadgeTest is Test {
    WokAgentBadge public badge;
    MockAgentID public agentId;
    address public owner = address(0xB0B);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B0);

    function setUp() public {
        agentId = new MockAgentID();
        vm.prank(owner);
        badge = new WokAgentBadge(address(agentId), owner);
    }

    function testMeta() public view {
        assertEq(badge.name(), "Wok Agent Badge");
        assertEq(badge.symbol(), "WOKAB");
        assertEq(badge.MAX_SUPPLY(), 1000);
        assertEq(badge.totalMinted(), 0);
        assertEq(address(badge.AGENT_ID()), address(agentId));
        assertEq(badge.owner(), owner);
    }

    function testMintHappyPath() public {
        agentId.setHolds(alice, true);
        vm.prank(alice);
        badge.mint();
        assertEq(badge.totalMinted(), 1);
        assertEq(badge.ownerOf(1), alice);
        assertEq(badge.balanceOf(alice), 1);
        assertTrue(badge.hasMinted(alice));
        assertEq(
            badge.tokenURI(1),
            "https://jackbrother58.github.io/wok-agent-badge/metadata/1.json"
        );
    }

    function testMintRevertsWithoutAgentId() public {
        vm.prank(alice);
        vm.expectRevert("NO_AGENT_ID");
        badge.mint();
    }

    function testMintRevertsSecondMintSameWallet() public {
        agentId.setHolds(alice, true);
        vm.prank(alice);
        badge.mint();
        vm.prank(alice);
        vm.expectRevert("ALREADY_MINTED");
        badge.mint();
    }

    function testMintRevertsWhenPaused() public {
        agentId.setHolds(alice, true);
        vm.prank(owner);
        badge.setMintPaused(true);
        vm.prank(alice);
        vm.expectRevert("MINT_PAUSED");
        badge.mint();
        vm.prank(owner);
        badge.setMintPaused(false);
        vm.prank(alice);
        badge.mint();
        assertEq(badge.totalMinted(), 1);
    }

    function testOnlyOwnerCanPause() public {
        vm.prank(alice);
        vm.expectRevert("UNAUTHORIZED");
        badge.setMintPaused(true);
    }

    function testOnlyOwnerCanSetBaseURI() public {
        vm.prank(alice);
        vm.expectRevert("UNAUTHORIZED");
        badge.setBaseURI("https://example.com/");
        vm.prank(owner);
        badge.setBaseURI("https://example.com/");
        assertEq(badge.baseURI(), "https://example.com/");
    }

    function testTransfer() public {
        agentId.setHolds(alice, true);
        vm.prank(alice);
        badge.mint();
        vm.prank(alice);
        badge.transferFrom(alice, bob, 1);
        assertEq(badge.ownerOf(1), bob);
        assertEq(badge.balanceOf(alice), 0);
        assertEq(badge.balanceOf(bob), 1);
        // hasMinted stays true: alice cannot mint again even after transfer
        vm.prank(alice);
        vm.expectRevert("ALREADY_MINTED");
        badge.mint();
    }

    function testSafeTransferToGoodReceiver() public {
        agentId.setHolds(alice, true);
        vm.prank(alice);
        badge.mint();
        GoodReceiver r = new GoodReceiver();
        vm.prank(alice);
        badge.safeTransferFrom(alice, address(r), 1);
        assertEq(badge.ownerOf(1), address(r));
    }

    function testSafeTransferToBadReceiverReverts() public {
        agentId.setHolds(alice, true);
        vm.prank(alice);
        badge.mint();
        BadReceiver r = new BadReceiver();
        vm.prank(alice);
        // Solmate's safeTransferFrom reverts (empty data: the missing hook call
        // itself reverts before the UNSAFE_RECIPIENT check is reached).
        vm.expectRevert();
        badge.safeTransferFrom(alice, address(r), 1);
    }

    function testCheckInStreak() public {
        agentId.setHolds(alice, true);
        vm.prank(alice);
        badge.mint();
        // day 0
        vm.warp(1 days);
        vm.prank(alice);
        badge.checkIn(1);
        assertEq(badge.streak(1), 1);
        // same day again -> revert
        vm.prank(alice);
        vm.expectRevert("ALREADY_CHECKED_IN");
        badge.checkIn(1);
        // next day -> streak 2
        vm.warp(2 days);
        vm.prank(alice);
        badge.checkIn(1);
        assertEq(badge.streak(1), 2);
        // skip a day -> reset to 1
        vm.warp(4 days);
        vm.prank(alice);
        badge.checkIn(1);
        assertEq(badge.streak(1), 1);
    }

    function testCheckInOnlyOwner() public {
        agentId.setHolds(alice, true);
        vm.prank(alice);
        badge.mint();
        vm.warp(1 days);
        vm.prank(bob);
        vm.expectRevert("NOT_OWNER");
        badge.checkIn(1);
    }

    function testTokenURIRevertsUnminted() public {
        vm.expectRevert("NOT_MINTED");
        badge.tokenURI(1);
    }

    function testMintFreeValueZero() public {
        // mint() is non-payable: sending value must revert at the EVM level.
        agentId.setHolds(alice, true);
        vm.deal(alice, 1 wei);
        vm.prank(alice);
        (bool ok, ) = address(badge).call{value: 1 wei}(
            abi.encodeWithSelector(badge.mint.selector)
        );
        assertFalse(ok);
        assertEq(badge.totalMinted(), 0);
    }

    function testSupplyCapEnforced() public {
        // Mint 1000 badges from 1000 distinct holder addresses, then 1001st fails.
        for (uint256 i = 0; i < 1000; i++) {
            address who = address(uint160(0x10000 + i));
            agentId.setHolds(who, true);
            vm.prank(who);
            badge.mint();
        }
        assertEq(badge.totalMinted(), 1000);
        address last = address(uint160(0x20000));
        agentId.setHolds(last, true);
        vm.prank(last);
        vm.expectRevert("SOLD_OUT");
        badge.mint();
    }
}
