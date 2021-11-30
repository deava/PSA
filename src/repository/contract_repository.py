from database_connection import get_database_connection


class ContractRepository:
    def __init__(self,connection):
        self._connection = connection

