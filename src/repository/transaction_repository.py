from database_connection import get_database_connection
from entities.transaction import Transaction

class TransactionRepository:

    def __init__(self, connection):
        self._connection = connection

    def add(self, transaction):
        """
        Saves transaction into the database.
        """

        cursor = self._connection.cursor()

        cursor.execute('insert into transactions values (?, ?, ?, ?, ?, ?)', (transaction.timestamp, transaction.transaction_hash,
                       transaction.from_address, transaction.to_address, transaction.amount, transaction.gas_fee))

        self._connection.commit()

    def find_all(self):
        """
        Finds all transactions.
        
        Returns:
            Transactions found in the database.
        """

        cursor = self._connection.cursor()

        cursor.execute('select * from transactions')

        transactions = cursor.fetchall()

        transactions = [Transaction(transaction[1],transaction[3],transaction[2],transaction[4],transaction[5],transaction[0]) for transaction in transactions]

        return transactions


transaction_repository = TransactionRepository(get_database_connection())
