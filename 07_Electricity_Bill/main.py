print("===== ELECTRICITY BILL =====")

name = input("Enter customer name: ")
units = float(input("Enter units consumed: "))

if units <= 100:
    bill = units * 3
elif units <= 200:
    bill = (100 * 3) + (units - 100) * 5
elif units <= 300:
    bill = (100 * 3) + (100 * 5) + (units - 200) * 7
else:
    bill = (100 * 3) + (100 * 5) + (100 * 7)
    bill += (units - 300) * 10

surcharge = bill * 0.05
total = bill + surcharge

print("\nCustomer:", name)
print("Units:", units)
print("Bill:", bill)
print("Surcharge:", surcharge)
print("Total Bill:", total)
