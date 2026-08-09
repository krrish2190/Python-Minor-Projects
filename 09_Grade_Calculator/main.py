print("===== GRADE CALCULATOR =====")

name = input("Enter student name: ")

marks = []
for i in range(5):
    mark = float(input("Enter subject marks: "))
    marks.append(mark)

total = sum(marks)
percentage = total / 5

print("\nStudent:", name)
print("Total Marks:", total)
print("Percentage:", percentage)

if percentage >= 90:
    grade = "A+"
elif percentage >= 80:
    grade = "A"
elif percentage >= 70:
    grade = "B"
elif percentage >= 60:
    grade = "C"
elif percentage >= 50:
    grade = "D"
else:
    grade = "F"

print("Grade:", grade)
