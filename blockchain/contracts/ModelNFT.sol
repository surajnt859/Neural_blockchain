// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";

contract ModelNFT is ERC1155, Ownable, ERC2981 {
    uint256 public constant OWNERSHIP = 1;
    uint256 public constant ACCESS_30_DAY = 2;
    uint256 public constant ACCESS_90_DAY = 3;

    mapping(uint256 => string) private _uris;

    constructor() ERC1155("") Ownable(msg.sender) {
        _setDefaultRoyalty(msg.sender, 9000); // 90% creator royalty
    }

    function mint(address account, uint256 id, uint256 amount, bytes memory data) public onlyOwner {
        _mint(account, id, amount, data);
    }

    function setURI(uint256 id, string memory newuri) public onlyOwner {
        _uris[id] = newuri;
    }

    function uri(uint256 id) public view override returns (string memory) {
        return _uris[id];
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Licenses represent access rights and cannot be transferred between wallets.
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override
    {
        require(from == address(0) || to == address(0), "License is non-transferable");
        super._update(from, to, ids, values);
    }
}
