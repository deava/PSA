import unittest
from api.caller import Caller

class TestCaller(unittest.TestCase):
    def setUp(self):
        self.caller = Caller()
