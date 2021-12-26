from tkinter import Tk
from ui.ui import UI
from ui.menu import MenuBar


def main():
    window = Tk()
    window.title("Ethereum blockchain transaction analyzer")
    ui = UI(window)
    ui.start()

    window.mainloop()


if __name__ == "__main__":
    main()
