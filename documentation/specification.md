# Tool specification

## Tool purpose

This tool allows a user to analyze recently created smart contracts and transactions preceding a smart contracts creation on the ethereum blockchain.

There are multiple possible use-cases for this tool. One of th emost interesting being the possibility to analyze DeFi tokens for the purpose of investing.
By mapping out transactions preceding a smart contracts creation we can filter out projects with links to scams or market manipulation when given a list of such projects.

## User roles

In the initial version there will be only one user role. In the future it might be relevant to add an admin role or premium/paying customer functionality.

## Initial version functionality

The initial version will update the list of most recently created contracts in the ethereum blockchain by calling the Ethscan API. Using the same API the program will then map relevant transactions of the ethereum smart contract creator wallet.
The tool will visualize the different transactions and their respective wallet addresses as a graph with the wallet creating the contract as the root. 
The graph edges will also include the sizes (# of ETH) of each transaction included on the graph. 

## Ideas for future development

After compelting the initial version of the program, time permitting the aim is to implement some of the following ideas:

- Users can save certain coins to their favourites/watchlist.
- Connecting to decentralized exchanges to automatically buy a token if the contract passes certain red flag checks
- Collecting information on the price of a token and plotting the price as a time-series. (Using dextools api for example)
- Implementing differentiated features for paying/non-paying customers.
- Manual filtering of the transactions/wallets shown on the graph (by date/size of transaction, wallet criteria (holds x amount of y) 


