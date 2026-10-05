// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ModelNFT.sol";

/// @title ModelMarketplace - Enterprise Decentralized AI Model & Lineage Marketplace
/// @notice Enables listing, purchasing, multi-tier licensing, and automated fine-tuning lineage royalties for AI models
contract ModelMarketplace is Ownable, ReentrancyGuard {
    // Creator receives 90% of listing revenues, platform takes 10% protocol fee
    uint256 public constant CREATOR_SHARE_BPS = 9000;
    uint256 public constant PROTOCOL_FEE_BPS = 1000;
    uint256 public constant PARENT_LINEAGE_BPS = 1000; // 10% to upstream base model creator for fine-tunes
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant NEURAL_PER_ETH = 1000;
    uint256 public constant MIN_ETH_PRICE = 1e15; // 0.001 ETH minimal listing price

    // License Tiers: 1 = Personal/Indie (1x), 2 = Commercial Extended (3x), 3 = Enterprise Redistribution (10x)
    uint256 public constant TIER_PERSONAL = 1;
    uint256 public constant TIER_COMMERCIAL = 2;
    uint256 public constant TIER_ENTERPRISE = 3;

    bool public paused;

    struct Model {
        uint256 id;
        address payable owner;
        string name;
        string description;
        string category;
        string ipfsHash;
        string modelHash;
        string verificationStatus;
        uint256 verificationScore;
        uint256 price;
        uint256 parentModelId; // 0 if standalone/base model, >0 if fine-tuned derivative
        bool isActive;
        uint256 createdAt;
    }

    uint256 public modelCount;
    address payable public immutable platform;
    ModelNFT public immutable licenseNFT;
    IERC20 public immutable neuralToken;

    mapping(uint256 => Model) public models;
    mapping(uint256 => mapping(address => bool)) private _access;
    mapping(uint256 => mapping(address => uint256)) private _userLicenseTier;

    event ModelListed(
        uint256 indexed id,
        address indexed owner,
        string name,
        uint256 price,
        string ipfsHash,
        uint256 parentModelId
    );
    event ModelPurchased(
        uint256 indexed id,
        address indexed buyer,
        address indexed seller,
        uint256 price,
        uint256 tier
    );
    event LineageRoyaltyPaid(
        uint256 indexed modelId,
        uint256 indexed parentModelId,
        address indexed parentOwner,
        uint256 amount
    );
    event LicenseMinted(uint256 indexed modelId, address indexed buyer, uint256 tier, uint256 amount);
    event NeuralPurchase(uint256 indexed modelId, address indexed buyer, uint256 tokenAmount, uint256 tier);
    event MarketplacePaused(bool paused);
    event PlatformWithdrawn(address indexed recipient, uint256 amount);

    modifier whenNotPaused() {
        require(!paused, "Marketplace paused");
        _;
    }

    constructor(address payable _platform, address _licenseNFT, address _neuralToken) Ownable(msg.sender) {
        require(_platform != address(0), "Platform required");
        require(_licenseNFT != address(0), "License NFT required");
        require(_neuralToken != address(0), "NEURAL token required");
        platform = _platform;
        licenseNFT = ModelNFT(_licenseNFT);
        neuralToken = IERC20(_neuralToken);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit MarketplacePaused(_paused);
    }

    function withdrawPlatformFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        (bool sent, ) = platform.call{value: balance}("");
        require(sent, "Platform fee withdrawal failed");
        emit PlatformWithdrawn(platform, balance);
    }

    function getTierMultiplier(uint256 _tier) public pure returns (uint256) {
        if (_tier == TIER_ENTERPRISE) return 10;
        if (_tier == TIER_COMMERCIAL) return 3;
        return 1;
    }

    function calculatePriceForTier(uint256 _modelId, uint256 _tier) public view returns (uint256) {
        require(models[_modelId].id != 0, "Model does not exist");
        return models[_modelId].price * getTierMultiplier(_tier);
    }

    function uploadModelWithLineage(
        string calldata _name,
        string calldata _description,
        string calldata _category,
        string calldata _ipfsHash,
        string calldata _modelHash,
        string calldata _verificationStatus,
        uint256 _verificationScore,
        uint256 _price,
        uint256 _parentModelId
    ) public whenNotPaused returns (uint256) {
        require(bytes(_name).length > 0, "Name required");
        require(bytes(_ipfsHash).length > 0, "IPFS hash required");
        require(keccak256(bytes(_verificationStatus)) == keccak256(bytes("pending")), "Listing must be pending moderation");
        require(_price >= MIN_ETH_PRICE, "Price too low");
        if (_parentModelId > 0) {
            require(_parentModelId <= modelCount && models[_parentModelId].isActive, "Invalid parent model");
        }

        modelCount++;
        models[modelCount] = Model({
            id: modelCount,
            owner: payable(msg.sender),
            name: _name,
            description: _description,
            category: _category,
            ipfsHash: _ipfsHash,
            modelHash: _modelHash,
            verificationStatus: _verificationStatus,
            verificationScore: _verificationScore,
            price: _price,
            parentModelId: _parentModelId,
            isActive: true,
            createdAt: block.timestamp
        });

        _access[modelCount][msg.sender] = true;
        _userLicenseTier[modelCount][msg.sender] = TIER_ENTERPRISE;

        emit ModelListed(modelCount, msg.sender, _name, _price, _ipfsHash, _parentModelId);
        return modelCount;
    }

    function uploadModel(
        string calldata _name,
        string calldata _description,
        string calldata _category,
        string calldata _ipfsHash,
        string calldata _modelHash,
        string calldata _verificationStatus,
        uint256 _verificationScore,
        uint256 _price
    ) external whenNotPaused returns (uint256) {
        return uploadModelWithLineage(
            _name,
            _description,
            _category,
            _ipfsHash,
            _modelHash,
            _verificationStatus,
            _verificationScore,
            _price,
            0
        );
    }

    function buyModelTier(uint256 _modelId, uint256 _tier) public payable nonReentrant whenNotPaused {
        Model storage model = models[_modelId];
        require(model.id != 0, "Model does not exist");
        require(model.isActive, "Model not active");
        require(msg.sender != model.owner, "Owner already has access");
        
        uint256 activeTier = _userLicenseTier[_modelId][msg.sender];
        require(!_access[_modelId][msg.sender] || activeTier < _tier, "Already holds equal or higher license tier");

        uint256 effectiveTier = (_tier == TIER_COMMERCIAL || _tier == TIER_ENTERPRISE) ? _tier : TIER_PERSONAL;
        uint256 requiredPrice = model.price * getTierMultiplier(effectiveTier);
        require(msg.value >= requiredPrice, "Insufficient ETH sent");

        _access[_modelId][msg.sender] = true;
        _userLicenseTier[_modelId][msg.sender] = effectiveTier;

        uint256 platformFee = (msg.value * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 totalSellerShare = msg.value - platformFee;

        // Check if fine-tune has upstream parent lineage
        if (model.parentModelId > 0 && models[model.parentModelId].owner != address(0)) {
            uint256 parentRoyalty = (msg.value * PARENT_LINEAGE_BPS) / BPS_DENOMINATOR;
            uint256 creatorAmount = totalSellerShare - parentRoyalty;

            (bool parentPaid, ) = models[model.parentModelId].owner.call{value: parentRoyalty}("");
            require(parentPaid, "Parent lineage payment failed");
            emit LineageRoyaltyPaid(_modelId, model.parentModelId, models[model.parentModelId].owner, parentRoyalty);

            (bool creatorPaid, ) = model.owner.call{value: creatorAmount}("");
            require(creatorPaid, "Creator payment failed");
        } else {
            (bool creatorPaid, ) = model.owner.call{value: totalSellerShare}("");
            require(creatorPaid, "Creator payment failed");
        }

        (bool platformPaid, ) = platform.call{value: platformFee}("");
        require(platformPaid, "Platform payment failed");

        licenseNFT.mint(msg.sender, _modelId, 1, "");

        emit ModelPurchased(_modelId, msg.sender, model.owner, msg.value, effectiveTier);
        emit LicenseMinted(_modelId, msg.sender, effectiveTier, 1);
    }

    function buyModel(uint256 _modelId) external payable whenNotPaused {
        buyModelTier(_modelId, TIER_PERSONAL);
    }

    function buyModelWithNeuralTier(uint256 _modelId, uint256 _tier) public nonReentrant whenNotPaused {
        Model storage model = models[_modelId];
        require(model.id != 0, "Model does not exist");
        require(model.isActive, "Model not active");
        require(msg.sender != model.owner, "Owner already has access");

        uint256 activeTier = _userLicenseTier[_modelId][msg.sender];
        require(!_access[_modelId][msg.sender] || activeTier < _tier, "Already holds equal or higher license tier");

        uint256 effectiveTier = (_tier == TIER_COMMERCIAL || _tier == TIER_ENTERPRISE) ? _tier : TIER_PERSONAL;
        uint256 tokenAmount = model.price * NEURAL_PER_ETH * getTierMultiplier(effectiveTier);
        require(neuralToken.transferFrom(msg.sender, address(this), tokenAmount), "NEURAL payment failed");

        _access[_modelId][msg.sender] = true;
        _userLicenseTier[_modelId][msg.sender] = effectiveTier;

        uint256 platformFee = (tokenAmount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 totalSellerShare = tokenAmount - platformFee;

        if (model.parentModelId > 0 && models[model.parentModelId].owner != address(0)) {
            uint256 parentRoyalty = (tokenAmount * PARENT_LINEAGE_BPS) / BPS_DENOMINATOR;
            uint256 creatorAmount = totalSellerShare - parentRoyalty;

            require(neuralToken.transfer(models[model.parentModelId].owner, parentRoyalty), "Parent token lineage payment failed");
            emit LineageRoyaltyPaid(_modelId, model.parentModelId, models[model.parentModelId].owner, parentRoyalty);

            require(neuralToken.transfer(model.owner, creatorAmount), "Creator token payment failed");
        } else {
            require(neuralToken.transfer(model.owner, totalSellerShare), "Creator token payment failed");
        }

        require(neuralToken.transfer(platform, platformFee), "Platform token fee failed");
        licenseNFT.mint(msg.sender, _modelId, 1, "");

        emit NeuralPurchase(_modelId, msg.sender, tokenAmount, effectiveTier);
        emit LicenseMinted(_modelId, msg.sender, effectiveTier, 1);
    }

    function buyModelWithNeural(uint256 _modelId) external whenNotPaused {
        buyModelWithNeuralTier(_modelId, TIER_PERSONAL);
    }

    function checkAccess(uint256 _modelId, address _user) external view returns (bool) {
        return _access[_modelId][_user];
    }

    function getUserLicenseTier(uint256 _modelId, address _user) external view returns (uint256) {
        return _userLicenseTier[_modelId][_user];
    }

    function getModel(uint256 _modelId) external view returns (
        uint256 id,
        address owner,
        string memory name,
        string memory description,
        string memory category,
        string memory ipfsHash,
        string memory modelHash,
        string memory verificationStatus,
        uint256 verificationScore,
        uint256 price,
        uint256 parentModelId,
        bool isActive,
        uint256 createdAt
    ) {
        Model storage m = models[_modelId];
        require(m.id != 0, "Model does not exist");
        return (
            m.id,
            m.owner,
            m.name,
            m.description,
            m.category,
            m.ipfsHash,
            m.modelHash,
            m.verificationStatus,
            m.verificationScore,
            m.price,
            m.parentModelId,
            m.isActive,
            m.createdAt
        );
    }

    function getModelCount() external view returns (uint256) {
        return modelCount;
    }

    function deactivateModel(uint256 _modelId) external {
        require(models[_modelId].owner == msg.sender, "Not the owner");
        models[_modelId].isActive = false;
    }
}
