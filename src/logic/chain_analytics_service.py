from api.caller import Caller
from repository.transaction_repository import transaction_repository
from repository.contract_repository import contract_repository


class ChainAnalyticsService:
    """
    Class which allows us to analyze and work with the data provided by the API caller.

    Attributes:
        caller: API caller class.
        _transaction_repository: Transaction repository, allows us to communicate with the database's transactions table.
        _contract_repository: Contract repository, allows us to communicate with the database's contracts table.
    """

    def __init__(self):
        """
        Constructor for the class.

        Args:
            caller: API caller class.
            _transaction_repository: Transaction repository, allows us to communicate with the database's transactions table.
            _contract_repository: Contract repository, allows us to communicate with the database's contracts table.
        """
        self.caller = Caller()
        self._transaction_repository = transaction_repository
        self._contract_repository = contract_repository
        self._hash_set = set(
            [transaction.transaction_hash for transaction in self._transaction_repository.find_all()])
        self._hash_set.update(
            [contract.transaction_hash for contract in self._contract_repository.find_all()])

    def add_transactions_to_db(self, address):
        """
        Adds all the most recent transactions of a given address to the database.
        Args:
            address: Address of the wallet/smart contract, the transactions of which are to be added.
        """
        transactions = self.caller.get_recent_transactions_of_address(address)
        for transaction in transactions:
            if transaction.transaction_hash not in self._hash_set:
                self._transaction_repository.add(transaction)
                self._hash_set.add(transaction.transaction_hash)
        return transactions

    def add_transaction_to_db(self, transaction_hash):
        """
        Adds transaction from given hash to database
        Args:
            transaction_hash: Hash value of the transaction in the Ethereum blockchain
        """
        transaction = self.caller.get_transaction_information(transaction_hash)
        if transaction:
            self._transaction_repository.add(transaction)

    def get_transactions_in_db(self):
        """
        Gets all the transactions in the database.
        Returns:
            List of all the transactions saved in the database.
        """
        return self._transaction_repository.find_all()

    def add_new_contract_to_db_with_contract_address(self, contract_address):
        """
        Adds a new contract to the database given the address of the contract in the ETH blockchain
        Args:
            contract_address: Ethereum blockchain address of the contract to be added.
        Returns:
            List of contracts created in the block and which were added to the database.
        """
        contract = self.caller.get_contract_information(contract_address)
        if contract:
            self._contract_repository.add(contract)
        return contract

    def add_new_contract_to_db_from_block_number(self, block_number=12774364):
        """
        Adds all contracts created at a given block number to the database

        Args:
            block_number: Number of the ethereum block to start scanning at.
        Returns:
            List of contracts created in the block and which were added to the database.
        """
        contracts = self.caller.get_contract_creation_in_block(
            hex(block_number))
        if contracts:
            for contract in contracts:
                self._contract_repository.add(contract)
        return contracts

    def get_contracts_in_db(self):
        """
        Gets all the contracts in the database.
        Returns:
            List of all the contracts saved in the database.
        """
        return self._contract_repository.find_all()

    def get_current_block_id(self):
        """
        Gets the ordinal value of the most recent block in the ethereum blockchain.
        Returns:
            Most recent block number.
        """
        return self.caller.get_block_number()


chain_analytics_service = ChainAnalyticsService()
