from api.caller import Caller
from ui.ui import UI

def main():
    caller = Caller()
    print(caller.get_contract_information("0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2"))
    caller.get_name_of_contracts_created_recently(20)

if __name__ == "__main__":
    main()