from logic.chain_analytics_service import ChainAnalyticsService

COMMANDS = {
    "x": "x lopeta",
    "1": "1 Get all contracts in database",
    "2": "2 Get all transactions in the database",
    "3": "3 Add a new contract to the database",
    "4": "4 Add a new transaction to the database"

}


class TextUI:
    def __init__(self):
        self._service = ChainAnalyticsService()

    def start(self):
        print("Input commands:")
        print(COMMANDS)

        while True:
            command = input("Input command ")
            if not command in COMMANDS:
                print("Wrong command, try again")
                continue

            if command == "x":
                break
            if command == "1":
                print(self._service.get_contracts_in_db())
            if command == "2":
                print(self._service.get_transactions_in_db())
            if command == "3":
                address = input("Give contract address:")
                print(
                    self._service.add_new_contract_to_db_with_contract_address(address))
            if command == "4":
                hash = input("Give transaction hash:")
                print(self._service.add_transaction_to_db(hash))
