from tkinter import ttk, Menu


class MenuBar:
    def __init__(self, root, events_view_handler, transactions_view_handler):
        self.menubar = Menu(root)
        self._events_view_handler = events_view_handler
        self._transactions_view_handler = transactions_view_handler
        self._initialize()

    def _initialize(self):
        self.menubar.add_command(
            label="Transaction analyzer", command=lambda: self._events_view_handler())
        self.menubar.add_command(
            label="Contract finder", command=lambda: self._transactions_view_handler())
