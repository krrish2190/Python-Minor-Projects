# Ollama AI Project

A simple AI chatbot project built using Python and Ollama. The project uses the Llama 3.2 model to generate responses to user questions.

## Technologies Used

* Python
* Ollama
* Llama 3.2
* Ollama Python Library

## How It Works

1. The user enters a question in the console.
2. Python sends the question to the Llama 3.2 model through Ollama.
3. The model processes the question.
4. The AI-generated response is displayed in the console.

## Installation

Install the Ollama Python library:

```bash
pip install ollama
```

Make sure Ollama is installed and the Llama 3.2 model is available:

```bash
ollama pull llama3.2
```

## How to Run

Run the Python program:

```bash
python main.py
```

Enter your question when prompted.

## Example

```text
Ask your question: What is Python?

AI Response:
Python is a high-level programming language used for
web development, data analysis, artificial intelligence,
automation, and many other applications.
```

## Project Structure

```text
Ollama_Project/
├── main.py
└── README.md
```

## Purpose

This project demonstrates how Python can interact with a locally running Large Language Model (LLM) using Ollama.
