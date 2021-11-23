from api.caller import Caller
from ui.ui import UI

def main():

    caller = Caller()
    print("Getting last 100 created tokens on the Ethereum blockchain")

    contracts = caller.get_contracts_created_recently(2,hex(13673101))
    for contract in contracts:
        print(contract.name,contract.address,contract.creator_address)


if __name__ == "__main__":
    main()