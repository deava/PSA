from api.caller import Caller
from entities.transaction import Transaction
from ui.ui import UI
from logic.chain_analytics_service import ChainAnalyticsService

def main():
    caller = Caller()
    analytics = ChainAnalyticsService()
    print("Alert when new contracts created")
    creator = caller.get_contract_information("0xf613D5E51450bfAbCB59d8c31A3f4BD9A0358Ee7")[1]
    analytics.add_transactions_to_db(creator)
    for transaction in analytics.get_transactions_in_db():
        print(*transaction)


if __name__ == "__main__":
    main()
