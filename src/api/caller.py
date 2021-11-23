from etherscan import Etherscan
from config import API

class Caller:
    def __init__(self):
        self.eth = Etherscan(API)
    
    def get_block_number(self):
        return self.eth.get_proxy_block_number()

    def get_transaction_information(self,hash):
        return self.eth.get_proxy_transaction_by_hash(hash)

    def get_contract_creation_in_block(self,block_number):
        """
        Checks whether there has been a contract created in a block.
        """

        txInBlock = int(self.eth.get_proxy_block_transaction_count_by_number(block_number),0)
        contract_addresses = []

        transactions = self.eth.get_proxy_block_by_number(block_number)["transactions"]
        for transaction in transactions:
            if transaction["to"] == None:
                contract_addresses.append(self.eth.get_proxy_transaction_receipt(transaction["hash"])["contractAddress"])

        return contract_addresses

    def get_contract_information(self,address):
        """
        Returns information about the token, such as name based on the contract address given.

        Workaround to get token name without PRO API access
        """
        return self.eth.get_erc20_token_transfer_events_by_contract_address_paginated(address,1,0,"desc")[0]

    def get_name_of_contracts_created_recently(self,count):
        """
        Get contracts in the x most recent blocks of the ethereum blockchain.
        
        """
        contracts = []
        for i in range(0,count):
            hex_block_number= hex(int(self.get_block_number(),0)-i)
            contract_addresses = self.get_contract_creation_in_block(hex_block_number)
            for contract in contract_addresses:
                contractInfo = self.get_contract_information(contract)
                contracts.append((contractInfo["tokenName"],contractInfo["tokenSymbol"]))
        return contracts
        

