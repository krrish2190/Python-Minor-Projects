print("===== CALCULATOR =====")

a = float(input("Enter first number: "))
b = float(input("Enter second number: "))

print("1. Addition")
print("2. Subtraction")
print("3. Multiplication")
print("4. Division")

choice = input("Choose operation: ")

if choice == "1":
    result = a + b
    print("Result:", result)

elif choice == "2":
    result = a - b
    print("Result:", result)

elif choice == "3":
    result = a * b
    print("Result:", result)

elif choice == "4":
    if b != 0:
        print("Result:", a / b)
    else:
        print("Cannot divide by zero.")

else:
    print("Invalid choice.")
