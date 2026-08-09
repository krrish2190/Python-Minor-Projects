import random

print("===== ROCK PAPER SCISSOR =====")

choices = ["rock", "paper", "scissor"]

user = input("Enter rock, paper or scissor: ").lower()
computer = random.choice(choices)

print("Computer chose:", computer)

if user == computer:
    print("It's a Draw!")

elif user == "rock" and computer == "scissor":
    print("You Win!")

elif user == "paper" and computer == "rock":
    print("You Win!")

elif user == "scissor" and computer == "paper":
    print("You Win!")

elif user in choices:
    print("You Lose!")

else:
    print("Invalid choice!")
