// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "./interfaces/IBonusChef.sol";
import "./interfaces/IMasterChef.sol";
import "./interfaces/IRewardBar.sol";
import "../interfaces/IVerification.sol";

contract MasterChef is IMasterChef, AccessControl, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant EASY_ROUTER_ROLE = keccak256("EASY_ROUTER_ROLE");
    struct UserInfo {
        uint256 amount;            // How many Stake tokens the user has provided.
        uint256 rewardDebt;        // Reward debt. See explanation below.
        uint256 claimedReward;     // Claimed reward.
    }

    struct PoolInfo {
        IERC20 stakeToken;           // Address of stake token contract.
        IERC20 rewardToken;          // Address of reard token contract.
        uint256 lastRewardBlock;     // Last block number that REWARD distribution occurs.
        uint256 rewardPerBlock;      // Reward per block.
        uint256 accRewardPerShare;   // Accumulated Reward per share, times 1e12. See below.
        uint256 nextRewardPerBlock;  // Next rewardPerBlock after updateBlockNumber.
        uint256 nextBlockNumber;     // Start blocknumber to update rewardPerBlock.
        IBonusChef bonusChef;        // BonusChef contract
        uint256 bpid;                // Bonus pool id
    }

    bool public initialized;         // initialized
    IRewardBar public rewardBar;     // RewardBar
    PoolInfo[] public poolInfo;
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;

    IVerification verification; // Neopin Verification

    event Initialize(address indexed _rewardBar);
    event UpdateRewardBar(address indexed _rewardBar);
    event UpdateBonusChef(uint256 indexed _pid, address _bonusChef, uint256 _bpid);
    event UpdateNextRewardPerBlock(uint256 indexed _pid, uint256 _nextRewardPerBlock, uint256 _nextBlockNumber);
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event AddPool(address indexed _stakeToken, address indexed _rewardToken, uint256 _startBlock, uint256 _rewardPerBlock, address _bonusChef, uint256 _bpid);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event ClaimReward(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyRedeemReward(address indexed user, uint256 indexed pid, uint256 amount);

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function pause() onlyOwner public {
        _pause();
    }

    function unpause() onlyOwner public {
        _unpause();
    }

    function initialize(IRewardBar _rewardBar, IVerification _verification) public onlyOwner {
        require(initialized == false, "!initialized");
        initialized = true;
        rewardBar = _rewardBar;

        verification = _verification;

        emit Initialize(address(_rewardBar));
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    function updateRewardBar(IRewardBar _rewardBar) public onlyOwner {
        rewardBar = _rewardBar;
        emit UpdateRewardBar(address(_rewardBar));
    }

    function updateVerification(IVerification _verification) public onlyOwner {
        verification = _verification;
    }

    function addPool(IERC20 _stakeToken, IERC20 _rewardToken, uint256 _startBlock, uint256 _rewardPerBlock, IBonusChef _bonusChef, uint256 _bpid) public onlyOwner {
        require(address(rewardBar) != address(0), 'invalid RewardBar');
        uint256 lastRewardBlock = block.number > _startBlock ? block.number : _startBlock;
        poolInfo.push(PoolInfo({
            stakeToken: _stakeToken,
            rewardToken: _rewardToken,
            rewardPerBlock: _rewardPerBlock,
            lastRewardBlock: lastRewardBlock,
            accRewardPerShare: 0,
            nextRewardPerBlock: 0,
            nextBlockNumber: 0,
            bonusChef: _bonusChef,
            bpid: _bpid
        }));
        uint256 _pid = poolInfo.length - 1;
        if (address(_bonusChef) != address(0)) {
            _bonusChef.attachMasterChef(_pid, _bpid);
        }
        emit AddPool(address(_stakeToken), address(_rewardToken), _startBlock, _rewardPerBlock, address(_bonusChef), _bpid);
    }

    function updateBonusChef(uint256 _pid, IBonusChef _bonusChef, uint256 _bpid) public onlyOwner {
        PoolInfo storage pool = poolInfo[_pid];
        require (address(pool.stakeToken) != address(0), "invalid pid");

        if (address(pool.bonusChef) != address(0)) {
            pool.bonusChef.detachMasterChef(_pid, pool.bpid);
        }
        pool.bonusChef = _bonusChef;
        pool.bpid = _bpid;
        if (address(_bonusChef) != address(0)) {
            pool.bonusChef.attachMasterChef(_pid, pool.bpid);
        }
        emit UpdateBonusChef(_pid, address(_bonusChef), _bpid);
    }

    function updateNextRewardPerBlock(uint256 _pid, uint256 _nextRewardPerBlock, uint256 _nextBlockNumber) public onlyOwner {
        PoolInfo storage pool = poolInfo[_pid];
        require(block.number < _nextBlockNumber, "invalid nextBlockNumber");
        require (address(pool.stakeToken) != address(0), "invalid pid");

        pool.nextRewardPerBlock = _nextRewardPerBlock;
        pool.nextBlockNumber = _nextBlockNumber;

        emit UpdateNextRewardPerBlock(_pid, _nextRewardPerBlock, _nextBlockNumber);
    }

    function getStakeToken(uint256 _pid) public view returns (IERC20) {
        PoolInfo storage pool = poolInfo[_pid];
        return pool.stakeToken;
    }

    function getUserAmount(uint256 _pid, address _user) public view returns (uint256) {
        UserInfo storage user = userInfo[_pid][_user];
        return user.amount;
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public pure returns (uint256) {
        return (_to - _from);
    }

    // View function to see pending Reward on frontend.
    function pendingReward(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accRewardPerShare = pool.accRewardPerShare;
        uint256 stakeSupply = pool.stakeToken.balanceOf(address(this));

        uint256 rewardPerBlock = pool.rewardPerBlock;
        if (pool.nextBlockNumber > 0 && block.number >= pool.nextBlockNumber) {
            rewardPerBlock = pool.nextRewardPerBlock;
        }
        if (block.number > pool.lastRewardBlock && stakeSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 reward = multiplier * rewardPerBlock;
            accRewardPerShare = accRewardPerShare + reward * 1e12 / stakeSupply;
        }
        return user.amount * accRewardPerShare / 1e12 - user.rewardDebt;
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        if (pool.nextBlockNumber > 0 && block.number >= pool.nextBlockNumber) {
            pool.rewardPerBlock = pool.nextRewardPerBlock;
            pool.nextRewardPerBlock = 0;
            pool.nextBlockNumber = 0;
        }
        uint256 stakeSupply = pool.stakeToken.balanceOf(address(this));
        if (stakeSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 reward = multiplier * pool.rewardPerBlock;
        pool.accRewardPerShare = pool.accRewardPerShare + reward * 1e12 / stakeSupply;
        pool.lastRewardBlock = block.number;
    }

    // Deposit tokens to MasterChef.
    function deposit(uint256 _pid, uint256 _amount, bytes memory _proof) public nonReentrant whenNotPaused {
        verifyProof(msg.sender, _proof);
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        updatePool(_pid);

        if (user.amount > 0) {
            uint256 pending = user.amount * pool.accRewardPerShare / 1e12 - user.rewardDebt;
            if(pending > 0) {
                safeRewardTransfer(pool.rewardToken, msg.sender, pending);
                emit ClaimReward(msg.sender, _pid, pending);
            }
            user.claimedReward += pending;
        }
        if (address(pool.bonusChef) != address(0)) {
            pool.bonusChef.claimByDeposit(_pid, pool.bpid, msg.sender, _amount);
        }
        if (_amount > 0) {
            pool.stakeToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount + _amount;
        }
        user.rewardDebt = user.amount * pool.accRewardPerShare / 1e12;

        emit Deposit(msg.sender, _pid, _amount);
    }

    function depositByEasyRouter(uint256 _pid, uint256 _amount, address _originUser, bytes memory _proof) public nonReentrant whenNotPaused {
        verifyProof(_originUser, _proof);
        require(hasRole(EASY_ROUTER_ROLE, msg.sender), "not easyRouter role");
        require(_originUser != address(0), "invalid originUser");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_originUser];

        require(address(pool.stakeToken) != address(0), "!create pool");

        updatePool(_pid);

        if (user.amount > 0) {
            uint256 pending = user.amount * pool.accRewardPerShare / 1e12 - user.rewardDebt;
            if(pending > 0) {
                safeRewardTransfer(pool.rewardToken, _originUser, pending);
                emit ClaimReward(_originUser, _pid, pending);
            }
            user.claimedReward += pending;
        }
        if (address(pool.bonusChef) != address(0)) {
            pool.bonusChef.claimByDeposit(_pid, pool.bpid, _originUser, _amount);
        }
        if (_amount > 0) {
            pool.stakeToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount + _amount;
        }
        user.rewardDebt = user.amount * pool.accRewardPerShare / 1e12;

        emit Deposit(_originUser, _pid, _amount);
    }

    // Withdraw tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount, bytes memory _proof) public nonReentrant whenNotPaused {
        verifyProof(msg.sender, _proof);
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        require(user.amount >= _amount, "withdraw not good");
        updatePool(_pid);

        uint256 pending = user.amount * pool.accRewardPerShare / 1e12 - user.rewardDebt;
        if(pending > 0) {
            safeRewardTransfer(pool.rewardToken, msg.sender, pending);
            user.claimedReward += pending;
            emit ClaimReward(msg.sender, _pid, pending);
        }
        if (address(pool.bonusChef) != address(0)) {
            pool.bonusChef.claimByWithdraw(_pid, pool.bpid, msg.sender, _amount);
        }
        if(_amount > 0) {
            user.amount = user.amount - _amount;
            pool.stakeToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount * pool.accRewardPerShare / 1e12;

        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw tokens from MasterChef.
    function withdrawByEasyRouter(uint256 _pid, uint256 _amount, address _originUser, bytes memory _proof) public nonReentrant whenNotPaused {
        verifyProof(_originUser, _proof);
        require(hasRole(EASY_ROUTER_ROLE, msg.sender), "not easyRouter role");
        require(_originUser != address(0), "invalid originUser");

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_originUser];

        require(address(pool.stakeToken) != address(0), "!create pool");
        require(user.amount >= _amount, "withdraw not good");
        updatePool(_pid);

        uint256 pending = user.amount * pool.accRewardPerShare / 1e12 - user.rewardDebt;
        if(pending > 0) {
            safeRewardTransfer(pool.rewardToken, _originUser, pending);
            user.claimedReward += pending;
            emit ClaimReward(_originUser, _pid, pending);
        }
        if (address(pool.bonusChef) != address(0)) {
            pool.bonusChef.claimByWithdraw(_pid, pool.bpid, _originUser, _amount);
        }
        if(_amount > 0) {
            user.amount = user.amount - _amount;
            pool.stakeToken.safeTransfer(msg.sender, _amount);
        }
        user.rewardDebt = user.amount * pool.accRewardPerShare / 1e12;

        emit Withdraw(_originUser, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid, bytes memory _proof) public nonReentrant whenNotPaused {
        verifyProof(msg.sender, _proof);
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        uint256 userAmount = user.amount;

        user.amount = 0;
        user.rewardDebt = 0;

        pool.stakeToken.safeTransfer(address(msg.sender), userAmount);
        emit EmergencyWithdraw(msg.sender, _pid, userAmount);
    }

    // Redeem reward from owner, EMERGENCY ONLY.
    function emergencyRedeemReward(uint256 _pid, uint256 _amount) public onlyOwner {
        PoolInfo storage pool = poolInfo[_pid];
        safeRewardTransfer(pool.rewardToken, msg.sender, _amount);
        emit EmergencyRedeemReward(msg.sender, _pid, _amount);
    }

    // Safe reward transfer function, just in case if rounding error causes pool to not have enough Reward.
    function safeRewardTransfer(IERC20 rewardToken, address _to, uint256 _amount) internal {
        rewardBar.safeRewardTransfer(rewardToken, _to, _amount);
    }

    function verifyProof(address _user, bytes memory _proof) internal view {
        if (address(verification) != address(0)) {
            (bool isVerified, string memory errMsg) = verification.isVerified(_user, _proof);
            require(isVerified, errMsg);
        }
    }
}
