from etherscan import Etherscan
from config import API

class Caller:
    def __init__(self):
        self.eth = Etherscan(API)
    
    def get_block_number(self):
        return int(self.eth.get_proxy_block_number(),0)

    def get_recent_contracts(self):
        print(self.get_block_number())

    

