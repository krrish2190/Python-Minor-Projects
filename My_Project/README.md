InsightForge AI
InsightForge AI is a Data Analytics learning platform built with Flask and powered by a locally hosted Qwen3:8B model through the Ollama API.

The application combines a web frontend with a Flask backend and provides Data Analytics learning, practice, quizzes, dataset analysis, personalized study planning, projects, interview preparation, notes, progress tracking, authentication, and AI tutoring.
Features
- AI Data Analytics Tutor powered by Qwen3:8B through Ollama
- Data Analytics-focused responses for:
  - SQL and databases
  - Excel and Power Query
  - Power BI and DAX
  - Python, Pandas and NumPy
  - Statistics
  - Data cleaning and preparation
  - ETL
  - Data visualization
  - Business analytics
- AI-generated and curated quizzes
- Quiz scoring, explanations and topic-wise performance
- Personalized learning roadmap
- Personalized study plan generation
- Practice questions by topic and difficulty
- Dataset analysis for CSV and Excel files
- Data Analytics project guides
- AI interview preparation and answer evaluation
- Interview history and performance tracking
- Notes and tutor history
- Guest mode and registered-user authentication
- SQLite database for local persistence
- CSRF protection and security headers
- Streaming tutor responses
- Health endpoint for checking Ollama/model availability
Technology Stack
- Backend: Python, Flask
- AI Runtime: Ollama
- AI Model: Qwen3:8B
- AI Communication: Ollama HTTP API
- Database: SQLite
- Data Analysis: Pandas
- Excel Support: OpenPyXL, xlrd
- HTTP Client: Requests
- Production Server: Gunicorn
- Frontend: HTML/CSS/JavaScript served through Flask templates and static files
How the AI Works
The application communicates directly with the local Ollama HTTP API.
User
  ↓
Web Frontend
  ↓
Flask Backend
  ↓
Ollama HTTP API
  ↓
Qwen3:8B
  ↓
AI Response
  ↓
Flask
  ↓
Web Frontend
The application is configured in main.py to use:
Ollama URL: http://localhost:11434/api/generate
Model: qwen3:8b
The backend sends the prompt to Ollama using an HTTP POST request and receives the generated response as JSON.
Prerequisites
Install:
1. Python 3.10+
2. Ollama
3. Qwen3:8B model
Pull the model with:
ollama pull qwen3:8b
Make sure Ollama is running and verify the model:
ollama list
Installation
Clone the repository:
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <YOUR_PROJECT_FOLDER>
Create and activate a virtual environment if desired:
Windows
python -m venv venv
venv\Scripts\activate
macOS / Linux
python3 -m venv venv
source venv/bin/activate
Install dependencies:
pip install -r requirements.txt
Run Locally
Make sure Ollama is running and qwen3:8b is installed.

Then start the Flask application:
python main.py
The application runs on:
http://127.0.0.1:5000
Open that address in your browser.
Environment Variables
For production, set a stable Flask secret key:
INSIGHTFORGE_SECRET_KEY=your-secure-secret-key
When the application is served through HTTPS, also set:
INSIGHTFORGE_HTTPS=1
The application can create a local .insightforge_secret file when no secret key environment variable is supplied. For production, using INSIGHTFORGE_SECRET_KEY is recommended.
Project Structure
A typical project structure is:
InsightForge/
├── main.py
├── requirements.txt
├── README.md
├── templates/
│   └── index.html
├── static/
│   ├── ...
├── insightforge.db
└── .insightforge_secret
The exact contents of static/ may vary depending on the frontend files in the project.
Important Files
main.py
Contains:
- Flask application
- Ollama/Qwen3:8B integration
- Authentication
- SQLite database initialization
- API endpoints
- Quiz logic
- Study-plan logic
- Dataset analysis
- Project guides
- Interview preparation and evaluation
- Tutor functionality
- Security configuration
templates/
Contains the HTML frontend served by Flask.
static/
Contains frontend assets such as JavaScript, CSS, images and other static resources.
insightforge.db
SQLite database used by the application for users, quiz results, progress, tutor history, notes, interview results, study plans, feedback and active sessions.
Main API Areas
The backend exposes API endpoints for:
- Health and Ollama status
- Authentication
- CSRF token handling
- Topics and topic details
- User progress
- Notes
- Feedback
- AI tutor
- Tutor streaming/history
- Quizzes and quiz submission
- Roadmaps
- Study plans
- Weakness analysis
- Practice questions
- Projects and project details
- Achievements
- Dataset analysis
- Interview preparation, evaluation and history
Dataset Analysis
The dataset analyzer accepts:
- .csv
- .xlsx
- .xls
It checks the uploaded dataset and returns information such as:
- Number of rows and columns
- Column names
- Data types
- Missing values
- Duplicate rows
- Numeric summaries
- Dataset preview
- Whether the dataset appears related to Data Analytics
The application limits uploaded files to 6 MB at the Flask request level and performs an additional 5 MB dataset check.
Interview Preparation
The Interview Prep feature uses Qwen3:8B to:
1. Generate an interview question.
2. Accept the candidate's answer.
3. Evaluate relevance.
4. Score correctness, technical understanding, completeness, communication and confidence.
5. Provide feedback and an ideal answer.
6. Generate a follow-up question.
7. Calculate an overall interview score and readiness level.
The evaluation logic is designed to use one AI evaluation round trip to also obtain the next question when possible.
Production / Render Deployment Note
The current application is configured to communicate with:
http://localhost:11434/api/generate
This means Ollama and the Qwen3:8B model must be reachable from the machine running the Flask application.

Therefore, deploying only the Flask application to Render is not sufficient for the current architecture. A Render instance cannot use the Ollama service running on your personal computer through localhost.

For a public cloud deployment, the AI backend must also be made available to the deployed application. Possible architectures include:
Browser
   ↓
Render Flask App
   ↓
Cloud-hosted Ollama/Qwen3:8B
or another compatible hosted AI endpoint.

Do not commit private API keys, passwords or production secrets to GitHub.
Production Server
For a production deployment, Gunicorn can run the Flask application:
gunicorn main:app
On Render, the service should bind to the port supplied by the platform. If the application is deployed there, the Flask development server command in main.py should not be used as the production server.
Security Notes
The application includes:
- Password hashing using Werkzeug
- CSRF protection for state-changing requests
- Session cookies with HTTP-only and SameSite settings
- Optional secure cookies for HTTPS deployments
- Security response headers
- Login attempt throttling
- File upload size/type checks
- API JSON error handling
Keep .insightforge_secret and other private credentials out of public repositories when they contain production secrets.
Project Purpose
InsightForge AI is designed as an interactive learning environment for students preparing for Data Analytics roles. It combines structured learning content with an AI tutor, practical exercises, quizzes, dataset analysis and interview practice in one web application.
License
Add your preferred license here if the project is intended for public distribution.