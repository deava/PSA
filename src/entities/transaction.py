class Transaction:

    def __init__(self, transaction_hash, to_address, from_address, amount, gas_fee, timestamp):
        self.transaction_hash = transaction_hash
        self.to_address = to_address
        self.from_address = from_address
        self.amount = amount
        self.gas_fee = gas_fee
        self.timestamp = timestamp

    def __str__(self):
        return f"Timestamp: {self.timestamp}, Transaction hash: {self.transaction_hash}, from address: {self.to_address}, to_address {self.to_address}, amount (in Wei) {self.amount}"

    def __repr__(self):
        return f"Timestamp: {self.timestamp}, Transaction hash: {self.transaction_hash}, from address: {self.to_address}, to_address {self.to_address}, amount (in Wei) {self.amount}"
