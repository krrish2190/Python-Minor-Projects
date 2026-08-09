import random

while True:

    print("\n===== DICE ROLLER =====")
    print("1. Roll Dice")
    print("2. Exit")

    choice = input("Enter choice: ")

    if choice == "1":
        dice = random.randint(1, 6)
        print("You rolled:", dice)

    elif choice == "2":
        print("Game ended.")
        break

    else:
        print("Invalid choice.")
