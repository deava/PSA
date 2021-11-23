from etherscan import Etherscan
from config import API
from entities.contract import Contract

class Caller:
    def __init__(self):
        self.eth = Etherscan(API)
    
    def get_block_number(self):
        return self.eth.get_proxy_block_number()

    def get_transaction_information(self,hash):
        return self.eth.get_proxy_transaction_by_hash(hash)

    def get_contract_creation_in_block(self,block_number):
        """
        Checks whether there has been a contract created in a block and saves that contract to a
        """
        contracts = []
        transactions = self.eth.get_proxy_block_by_number(block_number)["transactions"]
        for transaction in transactions:
            if transaction["to"] == None:
                transaction_info = self.eth.get_proxy_transaction_receipt(transaction["hash"])
                token_name =  self.get_contract_information(transaction_info["contractAddress"])
                contracts.append(Contract(transaction_info["contractAddress"],transaction_info["from"],token_name))
        return contracts

    def get_contract_information(self,address):
        """
        Returns information about the token, such as name based on the contract address given.

        Workaround to get token name without PRO API access
        """
        contract_source_code = self.eth.get_contract_source_code(address)
        return contract_source_code[0]["ContractName"]

    def get_contracts_created_recently(self,count,starting_block = None):
        """
        Get contracts in the x most recent blocks of the ethereum blockchain.
        """
        contracts = []

        if not starting_block:
            starting_block = self.get_block_number()

        for i in range(0,count):
            hex_block_number= hex(int(starting_block,0)-i)
            contracts.extend(self.get_contract_creation_in_block(hex_block_number))

        return contracts
        

