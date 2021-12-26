from datetime import datetime
from etherscan import Etherscan
from config import API
from entities.contract import Contract
from entities.transaction import Transaction


class Caller:
    """
    Class that connects to the Etherscan API and parses the API calls results to a usable form.

    Attributes:
        eth: Connection to the Etherscan API
    """

    def __init__(self):
        self.eth = Etherscan(API)

    def get_block_number(self):
        return self.eth.get_proxy_block_number()

    def get_transaction_information(self, transaction_hash):
        transaction_information = self.eth.get_proxy_transaction_by_hash(transaction_hash)
        print(transaction_information)
        return Transaction(transaction_hash,
                           transaction_information["to"],
                           transaction_information["from"],
                           int(transaction_information["value"],16),
                           int(transaction_information["gas"],16),
                           int(transaction_information["blockNumber"],16))

    def get_contract_creation_in_block(self, block_number):
        """
        Checks whether there has been a contract created
        in a block and creates a Contract entity
        and appends it to the returnable contracts list.
        Args:
            block_number: the number (in hex) of the block in the
            Ethereum blockchain to scan for a smart contract.
        Returns:
            Contracts found, if any, in the block in question.
        """
        contracts = []
        transactions = self.eth.get_proxy_block_by_number(block_number)[
            "transactions"]
        for transaction in transactions:
            if transaction["to"] is None:
                transaction_info = self.eth.get_proxy_transaction_receipt(
                    transaction["hash"])
                token_name = self.get_contract_information(
                    transaction_info["contractAddress"]).name
                contracts.append(Contract(
                    transaction_info["contractAddress"],
                    transaction["hash"],
                    transaction_info["from"],
                    int(transaction_info["blockNumber"], 16),
                    token_name
                ))
        return contracts

    def get_contract_information(self, address):
        """
        Returns information about the token, such as name
        based on the contract address given.
        Workaround to get token name without PRO API access
            Args:
            address: address of the contract in the Ethereum blockchain.
        Returns:
            Contract object representing the contract found in the
            Ethereum blockchain in the address given as argument.
        """

        contract_source_code = self.eth.get_contract_source_code(address)
        name = contract_source_code[0]["ContractName"]
        first_transaction = self.eth.get_erc20_token_transfer_events_by_contract_address_paginated(
            address, 0, 100, "asc")[0]

        return Contract(address,
        first_transaction["hash"],
        first_transaction["from"],
        first_transaction["timeStamp"],
        name)

    def get_contracts_created_recently(self, count, starting_block=None):
        """
        Get contracts in the x most recent blocks of the ethereum blockchain.

        Args:
            count: defines how many blocks back from the starting point we go
            starting_block: if defined, the block to start the contract scanning
            from, otherwise default to most recent block
        Returns:
            List of the contracts created recently, as defined by the starting
            block and amount of blocks that we scanned back.
        """
        contracts = []

        if not starting_block:
            starting_block = self.get_block_number()

        for i in range(0, count):
            hex_block_number = hex(int(starting_block, 0)-i)
            contracts.extend(
                self.get_contract_creation_in_block(hex_block_number))

        return contracts

    def get_recent_transactions_of_address(self, address_hash, transaction_count=100):
        """
        Gives the most recent transactions from a certain address.
        Args:
            address_hash: The address to scan transactions from
            transaction_count: How many transactions at most to include in the return
            (returns fewer transactions than transaction_count implies if fewer available).
        """
        max_block = 99999999
        recent_transactions = self.eth.get_normal_txs_by_address(
            address_hash, 0, max_block, "desc")[0:transaction_count]
        transactions = []
        for transaction in recent_transactions:
            timestamp = datetime.utcfromtimestamp(
                int(transaction["timeStamp"])).strftime('%Y-%m-%d %H:%M:%S')
            transactions.append(Transaction(transaction["hash"],
            transaction["to"],
            transaction["from"],
            int(transaction["value"]),
            int(transaction["gas"]),
            timestamp))
        return transactions
