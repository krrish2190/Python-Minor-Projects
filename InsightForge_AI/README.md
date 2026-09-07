# InsightForge AI

## AI-Powered Data Analytics Learning Assistant

InsightForge AI is a Python-based AI learning platform designed to help users learn and practice Data Analytics.

The application combines a local Large Language Model with an interactive web interface to provide AI tutoring, daily learning topics, quizzes, learning statistics and voice interaction.

## Features

### AI Data Analytics Tutor

Users can ask questions about:

- SQL
- Excel
- Power BI
- Python
- Pandas
- Statistics
- Databases
- Data Analysis
- Data Visualization
- Data Cleaning
- ETL
- Business Intelligence

The AI tutor uses Llama 3.2 through the Ollama API.

### Topic of the Day

Every time the application loads, a Data Analytics topic is selected and displayed.

Topics include:

- SQL JOIN
- Primary Keys
- GROUP BY
- Excel VLOOKUP
- Pivot Tables
- Power BI KPIs
- Statistics
- Data Cleaning
- Data Visualization
- ETL

### Quiz System

Users can select:

- 5 questions
- 10 questions
- 15 questions

The system randomly selects questions from the Data Analytics question bank.

After completing the quiz, the application calculates:

- Score
- Percentage
- Performance feedback

### Learning Statistics

The application stores quiz results in browser localStorage and displays:

- Quizzes Taken
- Average Score
- Best Score

### Voice Features

The application supports:

- Voice-to-text input
- Text-to-speech AI responses

These features use the browser's built-in Web Speech API.

## Technologies Used

- Python
- Flask
- Requests
- Ollama
- Llama 3.2
- HTML
- CSS
- JavaScript
- REST API
- Web Speech API
- Browser localStorage

## Architecture

```text
                    USER
                      |
                      v
              WEB FRONTEND
          HTML + CSS + JavaScript
                      |
          +-----------+-----------+
          |           |           |
          v           v           v
       AI Tutor     Quiz      Topic of Day
          |
          v
      Flask API
          |
          v
      Ollama API
          |
          v
      Llama 3.2
          |
          v
      AI Response
          |
          v
       FRONTEND