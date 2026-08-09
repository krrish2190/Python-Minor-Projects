import tkinter as tk
from time import strftime

print("===== DIGITAL CLOCK ====")

root = tk.Tk()
root.title("Digital Clock")

def time():
    string = strftime('%H:%M:%S %p\n%d-%B-%y')
    label.config(text = string)
    label.after(1000,time)

label = tk.Label(root, font=('calibri', 50, 'bold'), background = 'white', foreground = 'black')
label.pack(anchor = 'center')

time()

root.mainloop()
