from tkinter import Tk, ttk, StringVar
from entities import contract
from logic.chain_analytics_service import chain_analytics_service
class UI:
    def __init__(self, root):
        self._root = root
        self._string_var = StringVar()
        self._str_var = StringVar()
        self._str_var.set("0")



    def start(self):
        label = ttk.Label(master=self._root, text="Scan new contracts in the ethereum blockchain")

        button_start = ttk.Button(
          master=self._root,
          text="Start scanning",
          command=self._create_list_of_contracts()
        )

        button_stop = ttk.Button(
          master=self._root,
          text="Stop scanning",
          command=self._on_stop()
        )

        contract_list = ttk.Label(master = self._root, textvariable= self._string_var)
        iterator_debug = ttk.Label(master = self._root, textvariable= self._str_var)
        label.grid(row=0)
        button_start.grid(row=1,column=0)
        button_stop.grid(row=1,column=1)
        contract_list.grid(row=2)
        iterator_debug.grid(row=3)

    def _create_list_of_contracts(self):
        print("checking")
        self._str_var.set(self._str_var.get()+"\n"+"1")
        
    def _create_list_of_contracts_continuous(self):
        print(running)
        if running:
            print("checking")
            chain_analytics_service.add_new_contract_to_db_from_most_recent_block()
            contracts = chain_analytics_service.get_contracts_in_db()
            self._string_var.set("\n".join(contracts))
        self._root.after(1000,self._create_list_of_contracts_continuous)

    def _on_start(self):
        global running
        running = True

    def _on_stop(self):
        global running
        running = False


window = Tk()
window.title("TkInter example")

ui = UI(window)
ui.start()

window.mainloop()
