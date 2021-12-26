import unittest
from api.caller import Caller
from logic.chain_analytics_service import ChainAnalyticsService
from initialize_database import initialize_database


class TestChainAnalyticsRepository(unittest.TestCase):
    def setUp(self):
        self.analytics = ChainAnalyticsService()
        initialize_database()
        caller = Caller()
        self.creator = caller.get_contract_information(
            "0xf613D5E51450bfAbCB59d8c31A3f4BD9A0358Ee7").creator_address

    def test_get_transactions_in_db(self):
        self.analytics.add_transactions_to_db(self.creator)
        transactions = self.analytics.get_transactions_in_db()
        self.assertEqual(len(transactions), 18)

    def test_add_new_contract_to_db_from_block_number(self):
        self.analytics.add_new_contract_to_db_from_block_number(13660022)
        first_contract = self.analytics.get_contracts_in_db()[0]
        self.assertEqual(first_contract.name, "oozaruinu")

    def test_get_contracts_in_db(self):
        self.analytics.add_new_contract_to_db_from_block_number(13660022)
        contracts = self.analytics.get_contracts_in_db()
        self.assertEqual(len(contracts), 1)
