from tkinter import ttk, constants, Menu
from logic.chain_analytics_service import chain_analytics_service


class NewEventsView:
    def __init__(self, root, transactions_handler, filter_handler):
        self._root = root
        self._transactions_handler = transactions_handler
        self._filter_handler = filter_handler
        self._frame = None
        self._contract_list = None
        self._intitialize()

    def pack(self):
        self._frame.pack(fill=constants.X)

    def destroy(self):
        self._frame.destroy()

    def _intitialize(self):
        self._frame = ttk.Frame(master=self._root)

        label = ttk.Label(master=self._frame, text="Hashed address:")

        self._wallet_id = ttk.Entry(master=self._frame)

        button_start = ttk.Button(
            master=self._frame,
            text="Find transactions",
            command=lambda: self._transactions_handler(
                str(self._wallet_id.get()))
        )

        button_database = ttk.Button(
            master=self._frame,
            text="Get everything in database",
            command=lambda: self._get_all_transactions_db()
        )

        button_filter_by_to = ttk.Button(
            master=self._frame,
            text="Filter by from address",
            command=lambda: self._get_all_transactions_db("to")
        )

        button_filter_by_from = ttk.Button(
            master=self._frame,
            text="Filter by to address",
            command=lambda: self._get_all_transactions_db("from")
        )

        label.grid(row=1, column=0)
        button_start.grid(row=0, column=0)
        button_database.grid(row=1, column=1)
        button_filter_by_to.grid(row=1, column=2)
        button_filter_by_from.grid(row=1, column=3)

        self._wallet_id.grid(row=2)

        frame_contracts = ttk.Frame(master=self._frame)
        frame_contracts.grid(row=3)
        columns = ["Timestamp", "Transaction hash",
                   "To address", "From address", "Amount", "Gas fee"]
        self._contract_list = ttk.Treeview(
            master=frame_contracts, columns=columns, show="headings")
        self._contract_list.grid(row=0, column=0)
        self._contract_list.bind('<Button-3>', self.clipboard)
        for col in columns[0:]:
            self._contract_list.column(col, width=120)
            self._contract_list.heading(col, text=col)

    def _get_all_transactions_db(self, filter=None):
        transactions = chain_analytics_service.get_transactions_in_db()
        transactions_filtered = []
        if filter:
            for transaction in transactions:
                if filter == "to" and transaction.to_address == self._wallet_id.get():
                    transactions_filtered.append(transaction)
                elif filter == "from" and transaction.from_address == self._wallet_id.get():
                    transactions_filtered.append(transaction)
        else:
            transactions_filtered = transactions

        for i in self._contract_list.get_children():
            self._contract_list.delete(i)
        for transaction in transactions_filtered:
            self._contract_list.insert('', 'end', values=(transaction.timestamp, transaction.transaction_hash,
                                       transaction.to_address, transaction.from_address, transaction.amount, transaction.gas_fee))

    def clipboard(self, event):
        tree = self._contract_list
        cur_item = tree.item(tree.focus())
        col = tree.identify_column(event.x)
        if col == '#3':
            self._frame.clipboard_clear()
            print(cur_item)
            self._frame.clipboard_append(cur_item["values"][2])
        if col == '#4':
            self._frame.clipboard_clear()
            print(cur_item)
            self._frame.clipboard_append(cur_item["values"][3])
