// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.10;

import './interfaces/IUniswapV2Factory.sol';
import './UniswapV2Pair.sol';

contract UniswapV2Factory is IUniswapV2Factory {
  address public override feeTo;
  address public override feeToSetter;
  address public override migrator;

  bool public isPermitMode;
  mapping(address => bool) public routers;

  mapping(address => mapping(address => address)) public override getPair;
  address[] public override allPairs;

  constructor(address _feeToSetter) {
    feeToSetter = _feeToSetter;
  }

  function allPairsLength() external view override returns (uint256) {
    return allPairs.length;
  }

  function pairCodeHash() external pure override returns (bytes32) {
    return keccak256(type(UniswapV2Pair).creationCode);
  }

  function createPair(address tokenA, address tokenB) external override returns (address pair) {
    require(tokenA != tokenB, 'NeopinswapFactory: IDENTICAL_ADDRESSES');
    (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    require(token0 != address(0), 'NeopinswapFactory: ZERO_ADDRESS');
    require(getPair[token0][token1] == address(0), 'NeopinswapFactory: PAIR_EXISTS'); // single check is sufficient
    bytes memory bytecode = type(UniswapV2Pair).creationCode;
    bytes32 salt = keccak256(abi.encodePacked(token0, token1));
    assembly {
      pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
    }
    UniswapV2Pair(pair).initialize(token0, token1);
    getPair[token0][token1] = pair;
    getPair[token1][token0] = pair; // populate mapping in the reverse direction
    allPairs.push(pair);
    emit PairCreated(token0, token1, pair, allPairs.length);
  }

  function isPermit(address _router) external view override returns (bool) {
    if (isPermitMode == false) {
      return true;
    }
    return routers[_router];
  }

  function addPermit(address _router, bool _isPermit) external override {
    require(msg.sender == feeToSetter, 'NeopinswapFactory: FORBIDDEN');
    routers[_router] = _isPermit;
  }

  function setPermitMode(bool _isPermitMode) external override {
    require(msg.sender == feeToSetter, 'NeopinswapFactory: FORBIDDEN');
    isPermitMode = _isPermitMode;
  }

  function setFeeTo(address _feeTo) external override {
    require(msg.sender == feeToSetter, 'NeopinswapFactory: FORBIDDEN');
    feeTo = _feeTo;
  }

  function setMigrator(address _migrator) external override {
    require(msg.sender == feeToSetter, 'NeopinswapFactory: FORBIDDEN');
    migrator = _migrator;
  }

  function setFeeToSetter(address _feeToSetter) external override {
    require(msg.sender == feeToSetter, 'NeopinswapFactory: FORBIDDEN');
    feeToSetter = _feeToSetter;
  }
}
