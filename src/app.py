from api.caller import Caller
from ui.ui import UI

def main():
    caller = Caller()
    print(caller.get_block_number())

if __name__ == "__main__":
    main()