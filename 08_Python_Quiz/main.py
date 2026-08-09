print("===== PYTHON QUIZ =====")

questions = [
    ("Python file extension?", ".py"),
    ("Function keyword?", "def"),
    ("Output function?", "print"),
    ("Boolean data type?", "bool"),
    ("Comment symbol?", "#")
]

score = 0

for question, answer in questions:
    user = input(question + " ")

    if user.lower() == answer.lower():
        print("Correct!")
        score += 1
    else:
        print("Wrong!")
        print("Answer:", answer)

print("\n===== RESULT =====")
print("Score:", score)
print("Total:", len(questions))
