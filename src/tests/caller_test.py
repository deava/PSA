import unittest
from api.caller import Caller


class TestCaller(unittest.TestCase):
    def setUp(self):
        self.caller = Caller()

    def test_get_contract_information(self):
        contract_name = self.caller.get_contract_information(
            "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2")[0]
        self.assertEqual(contract_name, "DSToken")

    def test_get_contracts_created_recently(self):
        contracts = self.caller.get_contracts_created_recently(
            2, hex(13673101))
        self.assertEqual(len(contracts), 1)
        self.assertEqual(contracts[0].name, "MiniOozaru")
        self.assertEqual(contracts[0].contract_address,
                         "0x218c5ca2dfc0bb38efa01691dee3519ae206a914")
        self.assertEqual(contracts[0].creator_address,
                         "0x9afe58cf5f3ace494e910174b58e5eb941af87e9")
