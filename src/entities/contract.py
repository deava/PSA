class Contract:
    def __init__(self,contract_address,creator_address,name = None):
        self.address = contract_address
        self.creator_address = creator_address
        self.name = name
