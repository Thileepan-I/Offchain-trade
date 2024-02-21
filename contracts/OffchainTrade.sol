// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

    enum OrderStatus{
      Listed,
      Released
    }

    error OrderIdNotExist();
    error InsufficientFunds();
    error AllowanceCheckFailed();
    error InvalidAmount();
    error AlreadyListed();
    error AlreadyReleased();
    error AlreadyRegistered();
    error BuyerNotRegistered();
    error NotSeller();
    error TransactionFailed();
    error WrongSellerAddress();
    error SellersCantRegister();    

contract OffchainTrade is ReentrancyGuard {

    event OrderListed(address indexed seller , uint256 indexed amount , address indexed token , OrderStatus state);
    event RegisterAsBuyer(address indexed buyer , uint256 indexed orderId);
    event FundsReleased(address indexed buyer, uint256 orderId);

    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    
    struct Order {
     uint256 amount;
     address seller;
     address token;
     OrderStatus state;
     address[] buyers;
     uint256[] messages;
   }

    uint256 private orderId;
    mapping(uint256 => Order) private orders;
    mapping(uint256 => mapping(address => bool)) public isBuyerRegistered;
    mapping(uint256 => mapping(address => uint256)) private orderBuyerMessages;

    function listOrderAsSeller(uint256 _amount, address _token) external payable nonReentrant {

        if (_amount == 0) revert InvalidAmount();
        Order storage order = orders[++orderId];
        order.seller = msg.sender;

        if (_token == address(0)) {
            if (_amount != msg.value / 10**18) revert InsufficientFunds();
            order.amount = _amount;
        } else {
            if (IERC20(_token).balanceOf(msg.sender) < _amount || IERC20(_token).allowance(msg.sender, address(this)) != _amount) revert AllowanceCheckFailed();
            order.amount = _amount;
        }
        order.token = _token;
        order.state = OrderStatus.Listed;

        emit OrderListed(msg.sender, _amount, _token, OrderStatus.Listed);
    }

    function registerAsBuyer(uint256 _orderId, uint256 _message) external nonReentrant {
        
        if (orderId < _orderId) revert OrderIdNotExist();
        Order memory order = orders[_orderId];
        if (order.seller == msg.sender) revert SellersCantRegister();
        if (isBuyerRegistered[_orderId][msg.sender]) revert AlreadyRegistered(); 
        if (order.state != OrderStatus.Listed) revert AlreadyReleased();

        isBuyerRegistered[_orderId][msg.sender] = true;
        orderBuyerMessages[_orderId][msg.sender] = _message;

        emit RegisterAsBuyer(msg.sender, _orderId);
}

    function releaseFunds(uint256 _orderId, bytes memory _sign, address _buyer) external nonReentrant {
        Order storage order = orders[_orderId]; 
        if (order.state != OrderStatus.Listed) revert AlreadyReleased();
        if (msg.sender != order.seller) revert NotSeller();
        if (!isBuyerRegistered[_orderId][_buyer]) revert BuyerNotRegistered(); 

        order.state = OrderStatus.Released; 

        uint256 _message = orderBuyerMessages[_orderId][_buyer]; 
        bytes32 messageHash = keccak256(abi.encodePacked(_buyer, _message)); 
        address recoveredAddress = recoverSignedAddress(messageHash, _sign);
        if (recoveredAddress != order.seller) revert WrongSellerAddress();

        if (order.token != address(0)) {
        IERC20 token = IERC20(order.token);
        token.safeTransfer(_buyer, order.amount); 
        } else {
            (bool ok, ) = payable(_buyer).call{value: order.amount * 10**18}("");
            if (!ok) revert TransactionFailed();
        }

        emit FundsReleased(_buyer, _orderId);
}


    function getOrderDetails(uint256 _orderId) external view returns (Order memory order) {
        return orders[_orderId];
    }

    function recoverSignedAddress(bytes32 _hash, bytes memory _sign) public pure returns (address recoveredAddress) {
        bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash));
        recoveredAddress = messageHash.recover(_sign);
    }

    function getMessages(uint256 _orderId, address _buyer) external view returns (uint256 _message) {
        if (msg.sender != orders[_orderId].seller) revert NotSeller();
        return orderBuyerMessages[_orderId][_buyer];
    }

    function totalOrders() external view returns (uint256) {
        return orderId;
    }
}