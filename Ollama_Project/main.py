import ollama

print("=== Ollama AI Project ===")

question = input("Ask your question: ")

response = ollama.chat(
    model="llama3.2",
    messages=[
        {"role": "user", "content": question}
    ]
)

print("\nAI Response:")
print(response["message"]["content"])
