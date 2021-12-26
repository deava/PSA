class Contract:
    """Defines a contract data object.
    Attributes: 
        contract_address: Address of the contract in the Ethereum blockchain.
        transaction_hash: Identifier for the transaction in the Ethereum blockchain.
        creator_address: Ethereum blockchain address of the wallet that created the smart contract.
        timestamp: Time that the contract was created.
        name: Name of the smart contract, if available.
    """
    def __init__(self, contract_address, transaction_hash, creator_address, timestamp, name=None):
        """Constructor of the class. Creates a Contract entity.
        Args: 
            contract_address: Address of the contract in the Ethereum blockchain.
            transaction_hash: Identifier for the transaction in the Ethereum blockchain.
            creator_address: Ethereum blockchain address of the wallet that created the smart contract.
            timestamp: Time that the contract was created.
            name: Name of the smart contract, if available.
        """
        self.contract_address = contract_address
        self.transaction_hash = transaction_hash
        self.creator_address = creator_address
        self.creation_timestamp = timestamp
        self.name = name