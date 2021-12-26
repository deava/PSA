from tkinter import Tk, ttk, StringVar
from entities import contract
from logic.chain_analytics_service import chain_analytics_service
from ui.new_transactions_view import NewEventsView
from ui.menu import MenuBar
from ui.saved_contracts_view import ContractsView


class UI:
    def __init__(self, root):
        self._root = root
        self._current_view = None
        self._string_var = StringVar()
        menubar = MenuBar(root, self._show_new_events_view,
                          self._show_contracts_view).menubar
        root.config(menu=menubar)

    def start(self):
        self._show_new_events_view()

    def _create_list_of_transactions(self, wallet_id):
        entry_value = wallet_id
        print(entry_value)
        if entry_value:
            transactions = chain_analytics_service.add_transactions_to_db(
                str(entry_value))
            print("Added", len(transactions),
                  " transactions to database", entry_value)

    def _filter_database_contents(self):
        print(chain_analytics_service.get_transactions_in_db())

    def _show_new_events_view(self):

        self._hide_current_view()

        self._current_view = NewEventsView(
            self._root,
            self._create_list_of_transactions,
            self._filter_database_contents
        )

        self._current_view.pack()

    def _show_contracts_view(self):
        self._hide_current_view()
        self._current_view = ContractsView(self._root)
        self._current_view.pack()

    def _hide_current_view(self):
        if self._current_view:
            self._current_view.destroy()

        self._current_view = None

    def _on_start(self):
        global running
        running = True

    def _on_stop(self):
        global running
        running = False
