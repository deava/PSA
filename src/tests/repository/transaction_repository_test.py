import unittest
from repository.transaction_repository import transaction_repository


class TestTransactionRepository(unittest.TestCase):
    def setUp(self):
        self.transaction_repository = transaction_repository
