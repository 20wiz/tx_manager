// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import '../uniswapV2/libraries/SafeMath.sol';
import '../uniswapV2/libraries/UniswapV2Library.sol';
import '../uniswapV2/libraries/TransferHelper.sol';
import '../uniswapV2/interfaces/IUniswapV2Router02.sol';
import '../uniswapV2/interfaces/IUniswapV2Factory.sol';
import '../uniswapV2/interfaces/IUniswapV2Pair.sol';
import '../uniswapV2/interfaces/IERC20.sol';
import '../uniswapV2/interfaces/IWETH.sol';
import '../farm/interfaces/IMasterChef.sol';
import './interfaces/IERC20Npt.sol';
import './utils/AlpacaMath.sol';

contract EasyRouter is ReentrancyGuard, Pausable, Ownable {
  using SafeMathUniswap for uint256;

  uint256 public constant Fee = 3;
  address public immutable router;
  address public immutable masterChef;
  address public immutable WETH;
  address public immutable NPT;
  uint256 public constant MINIMUM_AMOUNT = 1000;

  constructor(address _router, address _masterChef, address _WETH, address _NPT) {
    router = _router;
    masterChef = _masterChef;
    WETH = _WETH;
    NPT = _NPT;
  }

  function pause() onlyOwner public {
    _pause();
  }

  function unpause() onlyOwner public {
    _unpause();
  }

  receive() external payable {
    assert(msg.sender == WETH || msg.sender == router); // only accept ETH via fallback from the WETH, UniswapV2Router02 contract
  }

  function _approve(address token, address spender, uint256 amount) internal returns (bool) {
    if (token != NPT) {
      TransferHelper.safeApprove(token, spender, amount);
      return true;
    } else {
      return IERC20Npt(token).increaseAllowance(spender, amount);
    }
  }

  function _getPairAddress(address tokenA, address tokenB) internal view returns (address) {
    address factory = IUniswapV2Router02(router).factory();
    return IUniswapV2Factory(factory).getPair(tokenA, tokenB);
  }

  function addLiquidity(
    address tokenA,
    address tokenB,
    uint256 amountADesired,
    uint256 amountBDesired,
    uint256 amountAMin,
    uint256 amountBMin,
    address to,
    uint256 deadline,
    uint256 pid,
    bytes memory _proof
  ) external whenNotPaused nonReentrant virtual returns ( uint256 amountA, uint256 amountB, uint256 liquidity) {
    require(msg.sender == to, "invalid to");

    TransferHelper.safeTransferFrom(tokenA, msg.sender, address(this), amountADesired);
    TransferHelper.safeTransferFrom(tokenB, msg.sender, address(this), amountBDesired);

    amountADesired = IERC20(tokenA).balanceOf(address(this));
    amountBDesired = IERC20(tokenB).balanceOf(address(this));
    require(_approve(tokenA, router, amountADesired) == true, "!approve");
    require(_approve(tokenB, router, amountBDesired) == true, "!approve");
    (amountA, amountB , liquidity) = IUniswapV2Router02(router).addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, address(this), deadline, _proof);

    address pairAddress = _getPairAddress(tokenA, tokenB);
    require(pairAddress != address(0), "!create pair");
    TransferHelper.safeApprove(pairAddress, masterChef, liquidity);
    IMasterChef(masterChef).depositByEasyRouter(pid, liquidity, msg.sender, _proof);

    liquidity = IERC20(pairAddress).balanceOf(address(this));
    require(liquidity == 0, "!deposit fail");

    uint256 change = IERC20(tokenA).balanceOf(address(this));
    if (change > 0) TransferHelper.safeTransfer(tokenA, msg.sender, change);

    change = IERC20(tokenB).balanceOf(address(this));
    if (change > 0) TransferHelper.safeTransfer(tokenB, msg.sender, change);

    require(_approve(tokenA, router, 0) == true, "!approve reset");
    require(_approve(tokenB, router, 0) == true, "!approve reset");
  }

  function addLiquidityETH(
    address token,
    uint256 amountTokenDesired,
    uint256 amountTokenMin,
    uint256 amountETHMin,
    address to,
    uint256 deadline,
    uint256 pid,
    bytes memory _proof
  ) external whenNotPaused nonReentrant payable virtual returns ( uint256 amountToken, uint256 amountETH, uint256 liquidity) {
    require(msg.sender == to, "invalid to");

    TransferHelper.safeTransferFrom(token, msg.sender, address(this), amountTokenDesired);
    amountTokenDesired = IERC20(token).balanceOf(address(this));
    require(_approve(token, router, amountTokenDesired) == true, "!approve");
    (amountToken, amountETH , liquidity) = IUniswapV2Router02(router).addLiquidityETH{value: msg.value}(
      token,
      amountTokenDesired,
      amountTokenMin,
      amountETHMin,
      address(this),
      deadline,
      _proof
    );

    address pairAddress = _getPairAddress(token, WETH);
    require(pairAddress != address(0), "!create pair");
    TransferHelper.safeApprove(pairAddress, masterChef, liquidity);
    IMasterChef(masterChef).depositByEasyRouter(pid, liquidity, msg.sender, _proof);

    liquidity = IERC20(pairAddress).balanceOf(address(this));
    require(liquidity == 0, "!deposit fail");

    uint256 change = IERC20(token).balanceOf(address(this));
    if (change > 0) TransferHelper.safeTransfer(token, msg.sender, change);

    change = _balanceETH();
    if (change > 0) TransferHelper.safeTransferETH(msg.sender, change);

    require(_approve(token, router, 0) == true, "!approve reset");
  }

  function removeLiquidity(
    address tokenA,
    address tokenB,
    uint256 liquidity,
    uint256 amountAMin,
    uint256 amountBMin,
    address to,
    uint256 deadline,
    uint256 pid,
    bytes memory _proof
  ) public whenNotPaused nonReentrant virtual returns (uint256 amountA, uint256 amountB) {
    require(msg.sender == to, "invalid to");
    address pairAddress = _getPairAddress(tokenA, tokenB);
    require(pairAddress != address(0), "!create pair");

    IMasterChef(masterChef).withdrawByEasyRouter(pid, liquidity, msg.sender, _proof);
    TransferHelper.safeApprove(pairAddress, router, liquidity);
    (amountA, amountB) = IUniswapV2Router02(router).removeLiquidity(tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline, _proof);

    liquidity = IERC20(pairAddress).balanceOf(address(this));
    require(liquidity == 0, "!deposit fail");
  }

  function removeLiquidityETH(
    address token,
    uint256 liquidity,
    uint256 amountTokenMin,
    uint256 amountETHMin,
    address to,
    uint256 deadline,
    uint256 pid,
    bytes memory _proof
  ) public whenNotPaused nonReentrant virtual returns (uint256 amountToken, uint256 amountETH) {
    require(msg.sender == to, "invalid to");
    address pairAddress = _getPairAddress(token, WETH);
    require(pairAddress != address(0), "!create pair");

    IMasterChef(masterChef).withdrawByEasyRouter(pid, liquidity, msg.sender, _proof);
    TransferHelper.safeApprove(pairAddress, router, liquidity);
    (amountToken, amountETH) = IUniswapV2Router02(router).removeLiquidityETH(token, liquidity, amountTokenMin, amountETHMin, to, deadline, _proof);

    liquidity = IERC20(pairAddress).balanceOf(address(this));
    require(liquidity == 0, "!deposit fail");
  }

  function removeLiquidityETHSupportingFeeOnTransferTokens(
    address token,
    uint256 liquidity,
    uint256 amountTokenMin,
    uint256 amountETHMin,
    address to,
    uint256 deadline,
    uint256 pid,
    bytes memory _proof
  ) public whenNotPaused nonReentrant virtual returns (uint256 amountETH) {
    require(msg.sender == to, "invalid to");
    address pairAddress = _getPairAddress(token, WETH);
    require(pairAddress != address(0), "!create pair");

    IMasterChef(masterChef).withdrawByEasyRouter(pid, liquidity, msg.sender, _proof);
    TransferHelper.safeApprove(pairAddress, router, liquidity);
    amountETH = IUniswapV2Router02(router).removeLiquidityETHSupportingFeeOnTransferTokens(token, liquidity, amountTokenMin, amountETHMin, to, deadline, _proof);

    liquidity = IERC20(pairAddress).balanceOf(address(this));
    require(liquidity == 0, "!deposit fail");
  }

  function addLiquiditySingle(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountSwapOutMin,
    uint256 pid,
    bytes memory _proof
  ) external whenNotPaused nonReentrant virtual returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
    require(amountIn >= MINIMUM_AMOUNT, "amountIn too low");
    address pairAddress = _getPairAddress(tokenIn, tokenOut);
    require(pairAddress != address(0), "!create pair");

    TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);
    amountIn = IERC20(tokenIn).balanceOf(address(this));

    uint256[3] memory amountInSwapOutMinPid;
    amountInSwapOutMinPid[0] = amountIn;
    amountInSwapOutMinPid[1] = amountSwapOutMin;
    amountInSwapOutMinPid[2] = pid;

    (amountA, amountB, liquidity) = _addLiquiditySingle(tokenIn, tokenOut, amountInSwapOutMinPid, pairAddress, _proof);
  }

  function _addLiquiditySingle(address tokenIn, address tokenOut, uint256[3] memory amountInSwapOutMinPid, address pairAddress, bytes memory _proof)
    internal
    returns (uint256 amountA, uint256 amountB, uint256 liquidity) {

    (uint256 r0, uint256 r1, ) = IUniswapV2Pair(pairAddress).getReserves();
    require((r0 >= MINIMUM_AMOUNT) && (r1 >= MINIMUM_AMOUNT), "Reserves too low");
    {
      uint256 rIn = IUniswapV2Pair(pairAddress).token0() == tokenIn ? r0 : r1;
      uint256 swapIn = _calculateSwapIn(Fee, rIn, amountInSwapOutMinPid[0]);
      {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        require(_approve(tokenIn, router, swapIn) == true, "!approve");
        IUniswapV2Router02(router).swapExactTokensForTokensSupportingFeeOnTransferTokens(swapIn, amountInSwapOutMinPid[1], path, address(this), block.timestamp, _proof);

        amountA = IERC20(tokenIn).balanceOf(address(this));
        amountB = IERC20(tokenOut).balanceOf(address(this));
        require(_approve(tokenIn, router, amountA) == true, "!approve");
        require(_approve(tokenOut, router, amountB) == true, "!approve");
      }
    }
    {
      (,,liquidity) = IUniswapV2Router02(router).addLiquidity(tokenIn, tokenOut, amountA, amountB, 1, 1, address(this), block.timestamp, _proof);

      TransferHelper.safeApprove(pairAddress, masterChef, liquidity);
      IMasterChef(masterChef).depositByEasyRouter(amountInSwapOutMinPid[2], liquidity, msg.sender, _proof);

      liquidity = IERC20(pairAddress).balanceOf(address(this));
      require( liquidity == 0, "!deposit fail");
      uint256 change = IERC20(tokenIn).balanceOf(address(this));
      if (change > 0) TransferHelper.safeTransfer(tokenIn, msg.sender, change);
      change = IERC20(tokenOut).balanceOf(address(this));
      if (change > 0) TransferHelper.safeTransfer(tokenOut, msg.sender, change);
    }

    require(_approve(tokenIn, router, 0) == true, "!approve reset");
    require(_approve(tokenOut, router, 0) == true, "!approve reset");
  }

  function addLiquidityETHSingle(
    address token,
    uint256 amountIn,
    uint256 amountSwapOutMin,
    uint256 pid,
    bytes memory _proof
  ) external whenNotPaused nonReentrant payable virtual returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
    address pairAddress = _getPairAddress(token, WETH);
    require(pairAddress != address(0), "!create pair");

    TransferHelper.safeTransferFrom(token, msg.sender, address(this), amountIn);
    amountIn = IERC20(token).balanceOf(address(this));

    uint256[3] memory amountInSwapOutMinPid;
    amountInSwapOutMinPid[0] = amountIn;
    amountInSwapOutMinPid[1] = amountSwapOutMin;
    amountInSwapOutMinPid[2] = pid;

    (amountToken, amountETH, liquidity) = _addLiquidityETHSingle(token, amountInSwapOutMinPid, pairAddress, _proof);
  }

  function _addLiquidityETHSingle(address token, uint256[3] memory amountInSwapOutMinPid, address pairAddress, bytes memory _proof)
    internal
    returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
    (uint256 r0, uint256 r1, ) = IUniswapV2Pair(pairAddress).getReserves();
    require((r0 >= MINIMUM_AMOUNT) && (r1 >= MINIMUM_AMOUNT), "Reserves too low");
    address[] memory path = new address[](2);
    if (amountInSwapOutMinPid[0] > 0) {
      require(msg.value == 0, 'eth must zero');
      uint256 rIn = IUniswapV2Pair(pairAddress).token0() == token ? r0 : r1;
      uint256 swapIn = _calculateSwapIn(Fee, rIn, amountInSwapOutMinPid[0]);
      path[0] = token;
      path[1] = WETH;
      require(_approve(token, router, swapIn) == true, "!approve");
      IUniswapV2Router02(router).swapExactTokensForETHSupportingFeeOnTransferTokens(swapIn, amountInSwapOutMinPid[1], path, address(this), block.timestamp, _proof);
    } else {
      require(msg.value > 0, "eth must not zero");
      uint256 rIn = IUniswapV2Pair(pairAddress).token0() == WETH ? r0 : r1;
      uint256 swapIn = _calculateSwapIn(Fee, rIn, msg.value);
      path[0] = WETH;
      path[1] = token;
      IUniswapV2Router02(router).swapExactETHForTokensSupportingFeeOnTransferTokens{value: swapIn}(amountInSwapOutMinPid[1], path, address(this), block.timestamp, _proof);
    }

    amountToken = IERC20(token).balanceOf(address(this));
    amountETH = _balanceETH();
    require(_approve(token, router, amountToken) == true, "!approve");
    (amountToken, amountETH , liquidity) = IUniswapV2Router02(router).addLiquidityETH{value: amountETH}(
      token,
      amountToken,
      1,
      1,
      address(this),
      block.timestamp,
      _proof
    );

    TransferHelper.safeApprove(pairAddress, masterChef, liquidity);
    IMasterChef(masterChef).depositByEasyRouter(amountInSwapOutMinPid[2], liquidity, msg.sender, _proof);

    liquidity = IERC20(pairAddress).balanceOf(address(this));
    require(liquidity == 0, "!deposit fail");

    uint256 change = IERC20(token).balanceOf(address(this));
    if (change > 0) TransferHelper.safeTransfer(token, msg.sender, change);
    change = _balanceETH();
    if (change > 0) TransferHelper.safeTransferETH(msg.sender, change);

    require(_approve(token, router, 0) == true, "!approve reset");
  }

  function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) external view returns (uint256 amountOut) {
    return IUniswapV2Router02(router).getAmountOut(amountIn, reserveIn, reserveOut);
  }

  function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) external view returns (uint256 amountIn) {
    return IUniswapV2Router02(router).getAmountIn(amountOut, reserveIn, reserveOut);
  }

  function calculateSwapIn(uint256 fee, uint256 reserveIn, uint256 amountIn) external pure returns (uint256) {
    return _calculateSwapIn(fee, reserveIn, amountIn);
  }

  function _calculateSwapIn(uint256 fee, uint256 rIn, uint256 balance) internal pure returns (uint256) {
    uint256 feeDenom = 1000; // uniswap use 1000 fee denomination
    uint256 feeConstantA = feeDenom.mul(2).sub(fee); // 2-f
    uint256 feeConstantB = feeDenom.sub(fee).mul(4).mul(feeDenom); // 4(1-f)
    uint256 feeConstantC = feeConstantA**2; // (2-f)^2
    uint256 nominator = AlpacaMath.sqrt(rIn.mul(balance.mul(feeConstantB).add(rIn.mul(feeConstantC)))).sub(
      rIn.mul(feeConstantA)
    );
    uint256 denominator = feeDenom.sub(fee).mul(2); // 1-f
    return nominator / denominator;
  }

  function _balanceETH() internal view returns (uint256){
    return payable(address(this)).balance;
  }

}
