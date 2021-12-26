# Tool specification

## Tool purpose

This tool allows a user to analyze recently created smart contracts and transactions preceding a smart contracts creation on the ethereum blockchain.

There are multiple possible use-cases for this tool. One of the most interesting being the possibility to analyze DeFi tokens for the purpose of investing.
By mapping out transactions preceding a smart contracts' creation we can filter out projects with links to scams or market manipulation.

## User roles

In the initial version there will be only one user role. In the future it might be relevant to add an admin role or premium/paying customer functionality.

## Initial version functionality

- User can see updated the list of most recently created contracts in the ethereum blockchain [x]
- User can select a smart contract from a list [x]
- User can see a visualisation of relevant transactions (including size) to and from the selected ethereum smart contract creator wallet. [x]
- User can input a different wallet to be the root node and the program will visualize transactions to and from that new wallet input [x]

## Ideas for future development

After compelting the initial version of the program, time permitting the aim is to implement some of the following ideas:

- Users can save certain coins to their favourites/watchlist.
- Database of Ethereum wallets which have created tokens that have turned out to be scams or otherwise manipulated.  
- Connecting to decentralized exchanges to automatically buy a token if the contract passes certain red flag checks
- Collecting information on the price of a token and plotting the price as a time-series. (Using dextools api for example)
- Implementing differentiated features for paying/non-paying customers.
- Manual filtering of the transactions/wallets shown on the graph (by date/size of transaction, wallet criteria (holds x amount of y) 


