from api.caller import Caller
from ui.ui import UI


def main():

    caller = Caller()
    print("Alert when new contracts created")
    creator = caller.get_contract_information("0xf613D5E51450bfAbCB59d8c31A3f4BD9A0358Ee7")[1]
    print(creator)
    print(caller.get_recent_transactions_of_address(creator))


if __name__ == "__main__":
    main()
