# Password Breach Checker

A Python-based security tool that checks whether a password has appeared in known data breaches.

## Features

- Checks passwords against known data breaches
- Uses the Have I Been Pwned Passwords API
- Uses SHA-1 hashing
- Only sends the first 5 characters of the hash to the API
- Shows the number of times a password has appeared in breaches
- Keeps the password hidden during input
- Handles API connection errors

## Technologies Used

- Python
- Requests Library
- Have I Been Pwned API
- SHA-1 Hashing

## How It Works

1. The user enters a password.
2. The password is converted into a SHA-1 hash.
3. Only the first 5 characters of the hash are sent to the API.
4. The API returns matching hash suffixes.
5. The program checks whether the password has appeared in a known breach.
6. The result and breach count are displayed.

## Installation

Install the required library:

```bash
pip install requests
