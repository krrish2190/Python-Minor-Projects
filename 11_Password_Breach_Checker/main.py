import hashlib
import getpass
import requests

print("=" * 40)
print("       PASSWORD BREACH CHECKER")
print("=" * 40)

password = getpass.getpass("Enter password: ")

sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()

prefix = sha1[:5]
suffix = sha1[5:]

url = f"https://api.pwnedpasswords.com/range/{prefix}"

headers = {
    "Add-Padding": "true",
    "User-Agent": "Password-Breach-Checker"
}

try:
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()

    found = False

    for line in response.text.splitlines():
        hash_suffix, count = line.split(":")

        if hash_suffix == suffix:
            found = True

            print("\n⚠️ PASSWORD EXPOSED!")
            print("Times seen in breaches:", count)
            break

    if not found:
        print("\n✅ PASSWORD NOT FOUND!")
        print("This password was not found in known breaches.")

except requests.exceptions.RequestException:
    print("\n❌ Unable to connect to the API.")
