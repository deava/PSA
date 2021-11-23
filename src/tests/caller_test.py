import unittest
from api.caller import Caller

class TestCaller(unittest.TestCase):
    def setUp(self):
        self.caller = Caller()

    def test_get_contract_information(self):
        contract_name = self.caller.get_contract_information("0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2")["tokenName"]
        self.assertEqual(contract_name,"Maker")
