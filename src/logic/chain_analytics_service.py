from api.caller import Caller
from repository.transaction_repository import transaction_repository


class ChainAnalyticsService:
    def __init__(self):
        self.caller = Caller()
        self._transaction_repository = transaction_repository
    
    def get_sorted_transaction_list_by_amount(self,transactions):
        pass

    def add_transactions_to_db(self,address):
        transactions = self.caller.get_recent_transactions_of_address(address)
        for transaction in transactions:
            self._transaction_repository.add(transaction)
    
    def get_transactions_in_db(self):
        return self._transaction_repository.find_all()