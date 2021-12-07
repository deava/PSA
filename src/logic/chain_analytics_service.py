from api.caller import Caller
from entities import contract
from repository.transaction_repository import transaction_repository
from repository.contract_repository import contract_repository


class ChainAnalyticsService:
    def __init__(self):
        self.caller = Caller()
        self._transaction_repository = transaction_repository
        self._contract_repository = contract_repository

    def get_sorted_transaction_list_by_amount(self, transactions):
        pass

    def add_transactions_to_db(self, address):
        transactions = self.caller.get_recent_transactions_of_address(address)
        for transaction in transactions:
            self._transaction_repository.add(transaction)

    def get_transactions_in_db(self):
        return self._transaction_repository.find_all()

    def add_new_contract_to_db_from_block_number(self,block_number = 12774364):
        contracts = self.caller.get_contract_creation_in_block(hex(block_number))
        if contracts:
            for contract in contracts:
                self._contract_repository.add(contract)
        return contracts

    def get_contracts_in_db(self):
        return self._contract_repository.find_all()

chain_analytics_service = ChainAnalyticsService()