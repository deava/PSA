from tkinter import Tk, ttk, constants
from logic.chain_analytics_service import chain_analytics_service

class ContractsView:
    def __init__(self,root):
        self._root = root
        self._frame = None
        self._block_id = None
        self._current_block_id = chain_analytics_service.get_current_block_id()
        self._intitialize()
    
    def pack(self):
        self._frame.pack(fill=constants.X)

    def destroy(self):
        self._frame.destroy()

    def _intitialize(self):
        self._frame = ttk.Frame(master = self._root)
        
        addressLabel = ttk.Label(master = self._frame, text = "Contract address")
        blockLabel = ttk.Label(master = self._frame, text = "BlockId to start from")
        self._address_hash = ttk.Entry(master=self._frame)
        self._block_id = ttk.Entry(master=self._frame)

        button_find = ttk.Button(
          master=self._frame,
          text="Find contracts created in the last 10 blocks",
          command=lambda: self._contract_finder(str(self._block_id.get()))
        )

        button_database = ttk.Button(
          master=self._frame,
          text="Get everything in database",
          command=lambda: self._show_all_contracts()
        )
        addressLabel.grid(row=0,column=0)
        button_find.grid(row=0,column=1)
        blockLabel.grid(row=1,column=0)
        self._block_id.grid(row=1,column=1)
        button_database.grid(row=0,column=2)
        
        frame_contracts = ttk.Frame(master = self._frame)
        frame_contracts.grid(row=3)
        columns = ["Timestamp","Name","Transaction hash","Contract address","Creator address"]
        self._contract_list = ttk.Treeview(master = frame_contracts,columns = columns,show="headings")
        self._contract_list.grid(row=1,column=0)
        self._contract_list.bind('<Button-3>', self.clipboard)
        for col in columns[0:]:
            self._contract_list.column(col, width=120)
            self._contract_list.heading(col, text=col)

    def _show_all_contracts(self):
        contracts_found = chain_analytics_service.get_contracts_in_db()
        for i in self._contract_list.get_children():
            self._contract_list.delete(i)
        for contract in contracts_found:
            self._contract_list.insert('','end',values=(contract.creation_timestamp,contract.name,contract.transaction_hash,contract.contract_address,contract.creator_address))


    def _contract_finder(self):
        contracts_found = chain_analytics_service.add_new_contract_to_db_from_block_number(self._block_id.get())
        self._show_all_contracts()

    def clipboard(self,event):
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