// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "solmate/tokens/ERC721.sol";
import {Owned} from "solmate/auth/Owned.sol";
import {LibString} from "solmate/utils/LibString.sol";

/// @title Wok Agent Badge
/// @notice Free-mint badge NFT for Binance Agent ID holders (hackathon entry).
///  Only addresses holding an Agent ID (balanceOf > 0 on the SPACE ID Agent ID
///  contract) can mint. 1 badge per wallet, max supply 1000, mint is free
///  (value 0, minter pays gas only). Holders can check in once per day to
///  build a public on-chain streak.
/// @dev No funds are ever held by this contract: mint is free, there is no
///  treasury, no sale, no royalties and no promised return of any kind.
///  Owner powers (documented, minimal): setBaseURI, setMintPaused.
///  Owner CANNOT mint for others, cannot change supply, cannot move tokens,
///  cannot withdraw anything (there is nothing to withdraw).
interface IAgentID {
    function balanceOf(address owner) external view returns (uint256);
}

contract WokAgentBadge is ERC721, Owned {
    using LibString for uint256;

    IAgentID public immutable AGENT_ID;
    uint256 public constant MAX_SUPPLY = 1000;

    string public baseURI;
    uint256 public totalMinted;
    bool public mintPaused;

    mapping(address => bool) public hasMinted;
    mapping(uint256 => uint256) public lastCheckInDay; // tokenId => day number (unix/86400)
    mapping(uint256 => uint256) public streak; // tokenId => current consecutive-day streak

    event CheckIn(uint256 indexed tokenId, address indexed owner, uint256 streak, uint256 day);

    /// @param agentId Address of the Agent ID contract (balanceOf > 0 = holder).
    /// @param initialOwner Owner of this contract (pause + baseURI powers).
    ///  NOTE: when deployed via a CREATE2 factory, msg.sender in the
    ///  constructor is the factory, NOT the deployer — so the owner must be
    ///  passed explicitly, never taken from msg.sender.
    constructor(address agentId, address initialOwner)
        ERC721("Wok Agent Badge", "WOKAB")
        Owned(initialOwner)
    {
        AGENT_ID = IAgentID(agentId);
        baseURI = "https://jackbrother58.github.io/wok-agent-badge/metadata/";
    }

    /// @notice Mint one free badge. Caller must hold an Agent ID.
    function mint() external {
        require(!mintPaused, "MINT_PAUSED");
        require(AGENT_ID.balanceOf(msg.sender) > 0, "NO_AGENT_ID");
        require(!hasMinted[msg.sender], "ALREADY_MINTED");
        require(totalMinted < MAX_SUPPLY, "SOLD_OUT");
        hasMinted[msg.sender] = true;
        unchecked {
            ++totalMinted;
        }
        _mint(msg.sender, totalMinted);
    }

    /// @notice Daily check-in for a badge the caller owns. Once per day.
    ///  Streak increments only on consecutive days, otherwise resets to 1.
    function checkIn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "NOT_OWNER");
        uint256 day = block.timestamp / 1 days;
        require(lastCheckInDay[tokenId] != day, "ALREADY_CHECKED_IN");
        if (lastCheckInDay[tokenId] == day - 1) {
            unchecked {
                ++streak[tokenId];
            }
        } else {
            streak[tokenId] = 1;
        }
        lastCheckInDay[tokenId] = day;
        emit CheckIn(tokenId, msg.sender, streak[tokenId], day);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        // ownerOf reverts for unminted ids in Solmate's ERC721.
        ownerOf(tokenId);
        return string.concat(baseURI, tokenId.toString(), ".json");
    }

    /// @notice Owner-only: change metadata base URI (e.g. if hosting moves).
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        baseURI = newBaseURI;
    }

    /// @notice Owner-only: pause / unpause minting (emergency brake only).
    function setMintPaused(bool paused) external onlyOwner {
        mintPaused = paused;
    }
}
