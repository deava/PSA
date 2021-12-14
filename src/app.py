from typing import Text
from api.caller import Caller
from entities.transaction import Transaction
from ui.text_ui import TextUI
from logic.chain_analytics_service import ChainAnalyticsService


def main():
    ui = TextUI()
    ui.start()

if __name__ == "__main__":
    main()
