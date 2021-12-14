class Transaction:
    """
    Defines a transaction data object
    Attributes: 
        transaction_hash: Identifier for the transaction in the Ethereum blockchain.
        from_address: Ethereum blockchain address of the wallet that created the transaction
        to_address: Ethereum blockchain address of the wallet received the transaction.
        amount: Size of the transaction.
        gas_fee: Fee deduced from the wallet of the transaction creator.
        timestamp: Time that the contract was created.
    """
    def __init__(self, transaction_hash, to_address, from_address, amount, gas_fee, timestamp):
        """Constructor of the class.
        Args: 
            transaction_hash: Identifier for the transaction in the Ethereum blockchain.
            from_address: Ethereum blockchain address of the wallet that created the transaction
            to_address: Ethereum blockchain address of the wallet received the transaction.
            amount: Size of the transaction.
            gas_fee: Fee deduced from the wallet of the transaction creator.
            timestamp: Time that the contract was created.
        """
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
