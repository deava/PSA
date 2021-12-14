# Architecture of the app

# Package and class architecture

The program is structured in a three-layer architecture. 
The first layer is the user interface-layer handled by package ui.
The second layer is the logic layer handled by packages api and logic
The third layer is the data layer handled by the repositories package.
The entities package contains the definitions of the data-objects the app uses.

Below you can see package and class diagram of the app.
![Architecture](./photos/architecture.png)

# UI

Implementation of the UI is separated into its own package.
# App Logic

ChainAnalyticsService from the package logic and Caller from the package api are responsible for handling the functionality of the app. 

ChainAnalyticsService is responsible for the implementation of the functionality analyzing and saving the data gathered from the api. It communicates with the database using the repository classes in the repository package.

Class Caller is responsible for communication between the app and the Etherscan API. It is responsible for wrangling the API calls into usable form. The data is then passed onto the ChainAnalyticsService class which performs some functionalities with the given data. 

The reason for the separation of the API and it's analysis into Caller and ChainAnalyticsService classes respectively, is so that we can use other data sources for the app without changing the implementation of the whole app. 
# Data saving and retrieval

Classes TransactionRepository and ContractRepository from the repository package handle saving data into a database. Both repository classes save data into tables in a SQLite database. Transactions are saved into a table called transactions and Contracts in to a table named contracts

The database is initialized with the following schema:
```SQL
create table transactions (date text, hash text, from_address text, to_address text, amount real, gas real)
```
```SQL
create table contracts (date text, hash text, creator_address text, contract_address text, name text)
```

# Main features of the app

Here we describe some of the main functionalities of the program using sequence diagrams.
## Scanning for a new smart contract in the most recent block
One of the main functionalities of the app is to allow the user to scan for smart contracts created in the most recent block of the Ethereum blockchain. 

![Architecture](./photos/sequence1.png)

The event handler for the button "Get contracts in recent block" calls the function to add any recently created contracts from the most recent block to the database, which is implemented by the ChainAnalyticsService class of the logic package. The ChainAnalyticsClass then uses the Caller to call the Etherscan API to scan for any contract creations in the most recent block. If there are any, the app then creates instances of the Contract class and saves these to the database using the ContractRepository class. The UI then shows the most recently created contracts. 
