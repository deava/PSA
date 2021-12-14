from database_connection import get_database_connection


class ContractRepository:
    def __init__(self,connection):
        self._connection = connection
    
    def add(self, contract):
        """
        Saves contract into the database.
        """

        cursor = self._connection.cursor()

        cursor.execute('insert into contracts values (?, ?, ?, ?, ?)', (contract.creation_timestamp, contract.transaction_hash, contract.creator_address, contract.contract_address, contract.name))

        self._connection.commit()

    def find_all(self):
        """
        Finds all transactions
        """

        cursor = self._connection.cursor()

        cursor.execute('select * from contracts')

        contracts = cursor.fetchall()

        return contracts


contract_repository = ContractRepository(get_database_connection())
