class Contract:
    def __init__(self, contract_address, transaction_hash, creator_address, timestamp, name=None):
        self.contract_address = contract_address
        self.transaction_hash = transaction_hash
        self.creator_address = creator_address
        self.creation_timestamp = timestamp
        self.name = name

    def __str__(self):
        return f"{self.creation_timestamp},{self.name},{self.contract_address},{self.creator_address},{self.transaction_hash}"
