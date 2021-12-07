from time import time, sleep
from etherscan import Etherscan
from config import API
from entities.contract import Contract
from entities.transaction import Transaction
from datetime import datetime


class Caller:
    def __init__(self):
        self.eth = Etherscan(API)

    def get_block_number(self):
        return self.eth.get_proxy_block_number()

    def get_transaction_information(self, hash):
        return self.eth.get_proxy_transaction_by_hash(hash)

    def run_continuous_scan(self):
        """
        Every 5 seconds calls the get_contract_creation_in_block to see if there has
        been a contract created in the recent block
        """
        while True:
            sleep(3 - time() % 3)
            block_number = self.get_block_number()
            print(int(block_number, 0))
            contracts = self.get_contract_creation_in_block(block_number)
            if len(contracts) != 0:
                print(int(block_number, 0), [str(x) for x in contracts])

    def get_contract_creation_in_block(self, block_number):
        """
        Checks whether there has been a contract created in a block and saves that contract to a
        """
        contracts = []
        transactions = self.eth.get_proxy_block_by_number(block_number)[
            "transactions"]
        for transaction in transactions:
            if transaction["to"] is None:
                transaction_info = self.eth.get_proxy_transaction_receipt(
                    transaction["hash"])
                token_name = self.get_contract_information(
                    transaction_info["contractAddress"])[0]
                contracts.append(Contract(
                    transaction_info["contractAddress"],transaction["hash"], transaction_info["from"], int(transaction_info["blockNumber"],16), token_name))
        return contracts

    def get_contract_information(self, address):
        """
        Returns information about the token, such as name based on the contract address given.

        Workaround to get token name without PRO API access
        """
        contract_source_code = self.eth.get_contract_source_code(address)
        name = contract_source_code[0]["ContractName"]
        creator_address = self.eth.get_erc20_token_transfer_events_by_contract_address_paginated(
            address, 0, 100, "asc")[0]["from"]
        return [name, creator_address]

    def get_contracts_created_recently(self, count, starting_block=None):
        """
        Get contracts in the x most recent blocks of the ethereum blockchain.
        """
        contracts = []

        if not starting_block:
            starting_block = self.get_block_number()

        for i in range(0, count):
            print(i)
            hex_block_number = hex(int(starting_block, 0)-i)
            contracts.extend(
                self.get_contract_creation_in_block(hex_block_number))

        return contracts

    def get_recent_transactions_of_address(self, address_hash, n=10000):
        """
        Gives the most recent transactions from a certain address.
        """
        MAX_BLOCK = 99999999
        recent_transactions = self.eth.get_normal_txs_by_address(
            address_hash, 0, MAX_BLOCK, "desc")[0:n]
        transactions = []
        for transaction in recent_transactions:
            timestamp = datetime.utcfromtimestamp(
                int(transaction["timeStamp"])).strftime('%Y-%m-%d %H:%M:%S')
            transactions.append(Transaction(transaction["hash"], transaction["to"], transaction["from"], int(
                transaction["value"]), int(transaction["gas"]), timestamp))
        return transactions
