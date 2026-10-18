from flask import Flask, render_template, request, jsonify, Response, stream_with_context
import requests
import json
import random
import re

app = Flask(__name__)

# ============================================================
# CONFIGURATION
# ============================================================

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_TAGS_URL = "http://localhost:11434/api/tags"

MODEL = "llama3.2"

OLLAMA_TIMEOUT = 300

DEFAULT_WORD_LIMIT = 250
MIN_WORD_LIMIT = 25
MAX_WORD_LIMIT = 2000


# ============================================================
# DATA ANALYTICS TOPICS
# ============================================================

TOPICS = [

    {
        "id": "sql-basics",
        "title": "SQL Basics",
        "category": "SQL",
        "level": "Beginner",
        "description": "Learn SELECT, WHERE, ORDER BY and basic SQL queries.",
        "details": "SQL is used to retrieve and manipulate structured data stored in relational databases. Important commands include SELECT, FROM, WHERE, ORDER BY and LIMIT.",
        "example": "SELECT name, salary FROM employees WHERE salary > 50000 ORDER BY salary DESC;"
    },

    {
        "id": "sql-joins",
        "title": "SQL JOINs",
        "category": "SQL",
        "level": "Intermediate",
        "description": "Understand INNER JOIN, LEFT JOIN, RIGHT JOIN and FULL JOIN.",
        "details": "JOINs combine information from multiple database tables using related columns.",
        "example": "SELECT employees.name, departments.department_name FROM employees INNER JOIN departments ON employees.department_id = departments.id;"
    },

    {
        "id": "sql-group-by",
        "title": "SQL GROUP BY",
        "category": "SQL",
        "level": "Intermediate",
        "description": "Group records and calculate summaries using aggregate functions.",
        "details": "GROUP BY groups rows that share common values. It is commonly used with COUNT, SUM, AVG, MIN and MAX.",
        "example": "SELECT department, AVG(salary) FROM employees GROUP BY department;"
    },

    {
        "id": "sql-having",
        "title": "SQL HAVING",
        "category": "SQL",
        "level": "Intermediate",
        "description": "Filter grouped results after aggregation.",
        "details": "HAVING is used to filter groups created using GROUP BY, while WHERE filters individual rows before grouping.",
        "example": "SELECT department, COUNT(*) FROM employees GROUP BY department HAVING COUNT(*) > 10;"
    },

    {
        "id": "primary-keys",
        "title": "Primary Keys",
        "category": "Database",
        "level": "Beginner",
        "description": "Understand unique identifiers in relational databases.",
        "details": "A primary key uniquely identifies each row in a database table. It should contain unique and non-null values.",
        "example": "CREATE TABLE employees (employee_id INT PRIMARY KEY, name VARCHAR(100));"
    },

    {
        "id": "foreign-keys",
        "title": "Foreign Keys",
        "category": "Database",
        "level": "Beginner",
        "description": "Understand relationships between database tables.",
        "details": "A foreign key references a primary key or unique key in another table and helps maintain referential integrity.",
        "example": "FOREIGN KEY (department_id) REFERENCES departments(id);"
    },

    {
        "id": "database-normalization",
        "title": "Database Normalization",
        "category": "Database",
        "level": "Intermediate",
        "description": "Organize relational data to reduce redundancy.",
        "details": "Normalization divides data into related tables to reduce duplication and improve data integrity.",
        "example": "Separating customer details and customer orders into related tables."
    },

    {
        "id": "excel-formulas",
        "title": "Excel Formulas",
        "category": "Excel",
        "level": "Beginner",
        "description": "Use formulas to perform calculations and analyze data.",
        "details": "Excel formulas can calculate totals, averages, percentages and conditional results.",
        "example": "=SUM(B2:B20)"
    },

    {
        "id": "excel-vlookup",
        "title": "Excel VLOOKUP",
        "category": "Excel",
        "level": "Intermediate",
        "description": "Find related information from a table using VLOOKUP.",
        "details": "VLOOKUP searches the first column of a range and returns a value from another column in the same row.",
        "example": "=VLOOKUP(A2,Employees!A:D,4,FALSE)"
    },

    {
        "id": "excel-xlookup",
        "title": "Excel XLOOKUP",
        "category": "Excel",
        "level": "Intermediate",
        "description": "Use the modern XLOOKUP function for flexible lookups.",
        "details": "XLOOKUP searches a range and returns a corresponding value from another range.",
        "example": "=XLOOKUP(A2,A:A,D:D,\"Not Found\")"
    },

    {
        "id": "pivot-tables",
        "title": "Excel Pivot Tables",
        "category": "Excel",
        "level": "Intermediate",
        "description": "Summarize large datasets quickly using Pivot Tables.",
        "details": "Pivot Tables allow analysts to group, summarize and compare large datasets without manually writing many formulas.",
        "example": "Use Department as Rows and Salary as Values to calculate total salary by department."
    },

    {
        "id": "power-query",
        "title": "Power Query",
        "category": "Excel",
        "level": "Intermediate",
        "description": "Clean, transform and combine data using Power Query.",
        "details": "Power Query is an ETL tool used to extract, transform and load data from different sources.",
        "example": "Import CSV files, remove duplicates, change data types and load the cleaned dataset into Excel."
    },

    {
        "id": "power-bi",
        "title": "Power BI",
        "category": "Power BI",
        "level": "Intermediate",
        "description": "Build interactive dashboards and business intelligence reports.",
        "details": "Power BI connects to data sources and provides interactive visualizations, dashboards and analytical reports.",
        "example": "Create a sales dashboard showing revenue, profit, regional performance and monthly trends."
    },

    {
        "id": "power-bi-dax",
        "title": "Power BI DAX",
        "category": "Power BI",
        "level": "Advanced",
        "description": "Create calculated measures and analytical expressions using DAX.",
        "details": "DAX is a formula language used in Power BI for calculations, measures and calculated columns.",
        "example": "Total Sales = SUM(Sales[Amount])"
    },

    {
        "id": "kpis",
        "title": "Key Performance Indicators",
        "category": "Business Analytics",
        "level": "Beginner",
        "description": "Understand KPIs and how businesses measure performance.",
        "details": "KPIs are measurable values used to evaluate whether a business, team or process is achieving its objectives.",
        "example": "Revenue growth, customer retention rate and conversion rate are common KPIs."
    },

    {
        "id": "data-cleaning",
        "title": "Data Cleaning",
        "category": "Data Preparation",
        "level": "Beginner",
        "description": "Prepare raw datasets for reliable analysis.",
        "details": "Data cleaning involves correcting inconsistent values, removing duplicates, handling missing values and fixing incorrect data types.",
        "example": "Convert dates to a standard format and remove duplicate customer records."
    },

    {
        "id": "missing-values",
        "title": "Missing Values",
        "category": "Data Preparation",
        "level": "Beginner",
        "description": "Identify and handle missing data.",
        "details": "Missing values can be handled by deletion, replacement, imputation or domain-specific methods depending on the dataset.",
        "example": "Replace missing numerical values with the median when appropriate."
    },

    {
        "id": "outliers",
        "title": "Outlier Analysis",
        "category": "Statistics",
        "level": "Intermediate",
        "description": "Identify unusual observations in a dataset.",
        "details": "Outliers are observations that differ substantially from other observations. They can be detected using methods such as IQR and z-scores.",
        "example": "A salary value far above the normal salary range may be investigated as a potential outlier."
    },

    {
        "id": "mean-median-mode",
        "title": "Mean, Median & Mode",
        "category": "Statistics",
        "level": "Beginner",
        "description": "Understand common measures of central tendency.",
        "details": "Mean is the arithmetic average, median is the middle value after sorting, and mode is the most frequently occurring value.",
        "example": "For 2, 3, 3, 5, 7: mean = 4, median = 3, mode = 3."
    },

    {
        "id": "standard-deviation",
        "title": "Standard Deviation",
        "category": "Statistics",
        "level": "Intermediate",
        "description": "Measure the spread or variability of numerical data.",
        "details": "Standard deviation indicates how much observations typically differ from the mean.",
        "example": "A lower standard deviation indicates that observations are more closely grouped around the mean."
    },

    {
        "id": "correlation",
        "title": "Correlation",
        "category": "Statistics",
        "level": "Intermediate",
        "description": "Measure the relationship between two variables.",
        "details": "Correlation measures the strength and direction of a linear relationship between variables.",
        "example": "A correlation close to +1 indicates a strong positive linear relationship."
    },

    {
        "id": "regression",
        "title": "Regression Analysis",
        "category": "Statistics",
        "level": "Advanced",
        "description": "Model relationships between dependent and independent variables.",
        "details": "Regression analysis estimates how changes in one or more independent variables are associated with changes in a dependent variable.",
        "example": "Predict sales based on advertising expenditure."
    },

    {
        "id": "data-visualization",
        "title": "Data Visualization",
        "category": "Data Visualization",
        "level": "Beginner",
        "description": "Present data using charts and visual representations.",
        "details": "Visualization makes patterns, trends, comparisons and distributions easier to understand.",
        "example": "Use a line chart to show monthly sales trends."
    },

    {
        "id": "dashboards",
        "title": "Analytics Dashboards",
        "category": "Business Analytics",
        "level": "Intermediate",
        "description": "Design dashboards for monitoring business performance.",
        "details": "Dashboards combine KPIs, charts, filters and tables into an interactive analytical interface.",
        "example": "A management dashboard can display revenue, profit, customer count and regional performance."
    },

    {
        "id": "python-data-analysis",
        "title": "Python for Data Analysis",
        "category": "Python",
        "level": "Beginner",
        "description": "Use Python to automate data analysis tasks.",
        "details": "Python is widely used for data cleaning, analysis, visualization and automation.",
        "example": "Use Python with Pandas to read a CSV file and calculate summary statistics."
    },

    {
        "id": "pandas",
        "title": "Pandas",
        "category": "Python",
        "level": "Intermediate",
        "description": "Analyze structured data using Python Pandas.",
        "details": "Pandas provides DataFrame and Series structures and many functions for filtering, grouping, joining and transforming data.",
        "example": "df.groupby('department')['salary'].mean()"
    },

    {
        "id": "numpy",
        "title": "NumPy",
        "category": "Python",
        "level": "Intermediate",
        "description": "Perform numerical computations using NumPy arrays.",
        "details": "NumPy provides efficient multidimensional arrays and mathematical operations.",
        "example": "np.mean(values)"
    },

    {
        "id": "etl",
        "title": "ETL",
        "category": "Data Engineering",
        "level": "Intermediate",
        "description": "Understand Extract, Transform and Load processes.",
        "details": "ETL collects data from sources, transforms it into a usable format and loads it into a target system.",
        "example": "Extract sales data from CSV files, clean it and load it into a data warehouse."
    },

    {
        "id": "data-types",
        "title": "Data Types",
        "category": "Data Fundamentals",
        "level": "Beginner",
        "description": "Understand numerical, categorical, text and date data.",
        "details": "Correctly identifying data types helps analysts select appropriate calculations and visualizations.",
        "example": "Age is numerical, while department is categorical."
    },

    {
        "id": "categorical-data",
        "title": "Categorical Data",
        "category": "Data Fundamentals",
        "level": "Beginner",
        "description": "Understand nominal and ordinal categorical variables.",
        "details": "Categorical data represents groups or labels rather than continuous numerical measurements.",
        "example": "Department, country and product category are categorical variables."
    },

    {
        "id": "data-distribution",
        "title": "Data Distribution",
        "category": "Statistics",
        "level": "Intermediate",
        "description": "Understand how values are distributed across a dataset.",
        "details": "Distribution describes the pattern of values, including center, spread, skewness and shape.",
        "example": "A histogram can show whether values are symmetric or skewed."
    },

    {
        "id": "descriptive-statistics",
        "title": "Descriptive Statistics",
        "category": "Statistics",
        "level": "Beginner",
        "description": "Summarize important characteristics of a dataset.",
        "details": "Descriptive statistics include measures such as mean, median, standard deviation, minimum, maximum and quartiles.",
        "example": "Use describe() in Pandas to obtain several summary statistics."
    },

    {
        "id": "data-storytelling",
        "title": "Data Storytelling",
        "category": "Business Analytics",
        "level": "Intermediate",
        "description": "Communicate analytical findings clearly.",
        "details": "Data storytelling combines analysis, visualizations and narrative to communicate meaningful insights to an audience.",
        "example": "Explain why sales declined by combining a sales trend chart with regional performance data."
    }
]


# ============================================================
# QUIZ QUESTIONS
# ============================================================

QUIZ_QUESTIONS = [

    {
        "id": "q001",
        "question": "Which SQL command is primarily used to retrieve data from a table?",
        "options": [
            "SELECT",
            "DELETE",
            "DROP",
            "UPDATE"
        ],
        "answer": "SELECT",
        "topic": "SQL"
    },

    {
        "id": "q002",
        "question": "Which SQL clause is used to combine rows from two related tables?",
        "options": [
            "JOIN",
            "ORDER BY",
            "GROUP BY",
            "LIMIT"
        ],
        "answer": "JOIN",
        "topic": "SQL"
    },

    {
        "id": "q003",
        "question": "Which SQL clause filters grouped results?",
        "options": [
            "HAVING",
            "WHERE",
            "ORDER BY",
            "SELECT"
        ],
        "answer": "HAVING",
        "topic": "SQL"
    },

    {
        "id": "q004",
        "question": "Which key uniquely identifies each record in a relational table?",
        "options": [
            "Primary Key",
            "Foreign Key",
            "Composite Index",
            "View"
        ],
        "answer": "Primary Key",
        "topic": "Database"
    },

    {
        "id": "q005",
        "question": "What is the primary purpose of database normalization?",
        "options": [
            "Reduce data redundancy",
            "Increase duplicate records",
            "Remove all relationships",
            "Convert tables into charts"
        ],
        "answer": "Reduce data redundancy",
        "topic": "Database"
    },

    {
        "id": "q006",
        "question": "Which Excel feature is especially useful for summarizing large datasets?",
        "options": [
            "Pivot Table",
            "Text Box",
            "Page Layout",
            "WordArt"
        ],
        "answer": "Pivot Table",
        "topic": "Excel"
    },

    {
        "id": "q007",
        "question": "Which Excel function is designed for flexible lookup operations in modern Excel?",
        "options": [
            "XLOOKUP",
            "COUNT",
            "ROUND",
            "LEN"
        ],
        "answer": "XLOOKUP",
        "topic": "Excel"
    },

    {
        "id": "q008",
        "question": "What is Power Query mainly used for?",
        "options": [
            "Data extraction and transformation",
            "Creating operating systems",
            "Writing HTML pages",
            "Managing computer hardware"
        ],
        "answer": "Data extraction and transformation",
        "topic": "Excel"
    },

    {
        "id": "q009",
        "question": "Which Microsoft tool is primarily used for interactive business intelligence dashboards?",
        "options": [
            "Power BI",
            "Notepad",
            "Paint",
            "Calculator"
        ],
        "answer": "Power BI",
        "topic": "Power BI"
    },

    {
        "id": "q010",
        "question": "What does DAX stand for in Power BI?",
        "options": [
            "Data Analysis Expressions",
            "Data Access Extension",
            "Database Analytics XML",
            "Dynamic Application Execution"
        ],
        "answer": "Data Analysis Expressions",
        "topic": "Power BI"
    },

    {
        "id": "q011",
        "question": "Which measure represents the arithmetic average?",
        "options": [
            "Mean",
            "Median",
            "Mode",
            "Range"
        ],
        "answer": "Mean",
        "topic": "Statistics"
    },

    {
        "id": "q012",
        "question": "Which measure identifies the middle value of an ordered dataset?",
        "options": [
            "Median",
            "Mean",
            "Variance",
            "Range"
        ],
        "answer": "Median",
        "topic": "Statistics"
    },

    {
        "id": "q013",
        "question": "What does standard deviation primarily measure?",
        "options": [
            "Data variability",
            "Number of columns",
            "Database size",
            "Number of categories"
        ],
        "answer": "Data variability",
        "topic": "Statistics"
    },

    {
        "id": "q014",
        "question": "A correlation coefficient close to +1 indicates what?",
        "options": [
            "Strong positive linear relationship",
            "Strong negative linear relationship",
            "No linear relationship",
            "A guaranteed causal relationship"
        ],
        "answer": "Strong positive linear relationship",
        "topic": "Statistics"
    },

    {
        "id": "q015",
        "question": "Which Python library is widely used for tabular data analysis?",
        "options": [
            "Pandas",
            "Flask",
            "Requests",
            "Tkinter"
        ],
        "answer": "Pandas",
        "topic": "Python"
    },

    {
        "id": "q016",
        "question": "Which Pandas structure is commonly used to represent tabular data?",
        "options": [
            "DataFrame",
            "Canvas",
            "Socket",
            "Thread"
        ],
        "answer": "DataFrame",
        "topic": "Python"
    },

    {
        "id": "q017",
        "question": "What is the first stage of the ETL process?",
        "options": [
            "Extract",
            "Transform",
            "Load",
            "Visualize"
        ],
        "answer": "Extract",
        "topic": "Data Engineering"
    },

    {
        "id": "q018",
        "question": "Which chart is generally suitable for showing a trend over time?",
        "options": [
            "Line chart",
            "Pie chart",
            "Treemap",
            "Scatter-free table"
        ],
        "answer": "Line chart",
        "topic": "Data Visualization"
    },

    {
        "id": "q019",
        "question": "Which technique can be used to identify potential outliers using quartiles?",
        "options": [
            "IQR method",
            "VLOOKUP",
            "JOIN",
            "ETL"
        ],
        "answer": "IQR method",
        "topic": "Statistics"
    },

    {
        "id": "q020",
        "question": "What is a KPI primarily used for?",
        "options": [
            "Measuring performance against objectives",
            "Replacing a database",
            "Formatting source code",
            "Installing software"
        ],
        "answer": "Measuring performance against objectives",
        "topic": "Business Analytics"
    },

    {
        "id": "q021",
        "question": "Which SQL clause is used to sort query results?",
        "options": [
            "ORDER BY",
            "GROUP BY",
            "HAVING",
            "WHERE"
        ],
        "answer": "ORDER BY",
        "topic": "SQL"
    },

    {
        "id": "q022",
        "question": "Which SQL aggregate function calculates the average of numeric values?",
        "options": [
            "AVG",
            "COUNT",
            "SUM",
            "MAX"
        ],
        "answer": "AVG",
        "topic": "SQL"
    },

    {
        "id": "q023",
        "question": "Which database key establishes a relationship to another table?",
        "options": [
            "Foreign Key",
            "Primary Key",
            "Sort Key",
            "Display Key"
        ],
        "answer": "Foreign Key",
        "topic": "Database"
    },

    {
        "id": "q024",
        "question": "Which Excel function returns a matching value from a lookup range?",
        "options": [
            "XLOOKUP",
            "SUM",
            "AVERAGE",
            "COUNTIF"
        ],
        "answer": "XLOOKUP",
        "topic": "Excel"
    },

    {
        "id": "q025",
        "question": "Which Power BI language is commonly used to create measures?",
        "options": [
            "DAX",
            "HTML",
            "CSS",
            "SQL Server Agent"
        ],
        "answer": "DAX",
        "topic": "Power BI"
    },

    {
        "id": "q026",
        "question": "Which statistical measure is least affected by extreme values?",
        "options": [
            "Median",
            "Mean",
            "Sum",
            "Maximum"
        ],
        "answer": "Median",
        "topic": "Statistics"
    },

    {
        "id": "q027",
        "question": "Which Pandas function is commonly used to load a CSV file?",
        "options": [
            "read_csv",
            "load_excel",
            "open_csv",
            "import_table"
        ],
        "answer": "read_csv",
        "topic": "Python"
    },

    {
        "id": "q028",
        "question": "Which visualization is commonly used to examine the distribution of numerical data?",
        "options": [
            "Histogram",
            "Logo",
            "Flowchart",
            "Text box"
        ],
        "answer": "Histogram",
        "topic": "Data Visualization"
    },

    {
        "id": "q029",
        "question": "What is a common objective of data cleaning?",
        "options": [
            "Improve data quality",
            "Increase duplicate records",
            "Remove all numerical data",
            "Convert every value into text"
        ],
        "answer": "Improve data quality",
        "topic": "Data Preparation"
    },

    {
        "id": "q030",
        "question": "What does ETL stand for?",
        "options": [
            "Extract, Transform, Load",
            "Evaluate, Test, Learn",
            "Export, Transfer, Link",
            "Encode, Transform, List"
        ],
        "answer": "Extract, Transform, Load",
        "topic": "Data Engineering"
    }

]


# ============================================================
# DATA ANALYTICS KEYWORDS
# ============================================================

DATA_KEYWORDS = [
    "data",
    "analytics",
    "analysis",
    "analyst",
    "sql",
    "database",
    "excel",
    "vlookup",
    "xlookup",
    "pivot",
    "power bi",
    "dax",
    "tableau",
    "python",
    "pandas",
    "numpy",
    "statistics",
    "mean",
    "median",
    "mode",
    "standard deviation",
    "variance",
    "correlation",
    "regression",
    "visualization",
    "dashboard",
    "kpi",
    "etl",
    "data cleaning",
    "missing values",
    "outlier",
    "dataset",
    "query",
    "join",
    "group by",
    "having",
    "chart",
    "graph",
    "report",
    "business intelligence",
    "machine learning",
    "forecast",
    "trend"
]


# ============================================================
# SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """
You are InsightForge AI, a specialized Data Analytics tutor.

You must answer questions related to:
SQL, databases, Excel, Power BI, DAX, Python, Pandas, NumPy,
statistics, data cleaning, data visualization, ETL, dashboards,
KPIs, business analytics and related data analytics concepts.

Do not behave like a general-purpose assistant.

Explain concepts in a clear academic and practical manner.

Structure responses using Markdown where appropriate.

Preferred structure:

## Short Answer

Give the direct answer.

## Explanation

Explain the concept clearly.

## How It Works

Explain the process or logic.

## Practical Example

Give a realistic data analytics example.

## Example / Code

Provide code or formulas when useful.

## Key Takeaways

Give a few concise points.

Do not unnecessarily repeat the question.

Respect the requested maximum word limit.
"""


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def extract_word_limit(message):
    """
    Detect word limits such as:
    'Explain SQL in 100 words'
    'under 200 words'
    'within 150 words'
    """

    patterns = [
        r"\b(?:in|within|under|below|max(?:imum)?(?:\s+of)?|limit(?:\s+of)?)\s*(\d{2,4})\s*words?\b",
        r"\b(\d{2,4})\s*words?\b"
    ]

    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)

        if match:
            try:
                value = int(match.group(1))

                if MIN_WORD_LIMIT <= value <= MAX_WORD_LIMIT:
                    return value
            except ValueError:
                pass

    return None


def clean_word_limit_instruction(message):
    """
    Remove word-limit phrases from the actual question
    before sending it to Ollama.
    """

    cleaned = re.sub(
        r"\b(?:in|within|under|below|max(?:imum)?(?:\s+of)?|limit(?:\s+of)?)\s*\d{2,4}\s*words?\b",
        "",
        message,
        flags=re.IGNORECASE
    )

    cleaned = re.sub(
        r"\b\d{2,4}\s*words?\b",
        "",
        cleaned,
        flags=re.IGNORECASE
    )

    return cleaned.strip()


def count_words(text):
    return len(re.findall(r"\S+", text))


def trim_to_word_limit(text, limit):
    words = text.split()

    if len(words) <= limit:
        return text

    return " ".join(words[:limit]).rstrip() + "..."


def is_data_question(message):
    """
    Basic domain check to keep the tutor focused on
    data analytics.
    """

    message_lower = message.lower()

    return any(keyword in message_lower for keyword in DATA_KEYWORDS)


def build_prompt(message, word_limit):
    clean_message = clean_word_limit_instruction(message)

    return f"""
{SYSTEM_PROMPT}

Maximum response length: {word_limit} words.

User question:
{clean_message}

Answer the user's question now.
"""


def ask_ollama(prompt):
    """
    Non-streaming Ollama request.
    """

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False
        },
        timeout=OLLAMA_TIMEOUT
    )

    response.raise_for_status()

    data = response.json()

    return data.get("response", "").strip()


def ollama_available():
    try:
        response = requests.get(
            OLLAMA_TAGS_URL,
            timeout=5
        )

        if response.status_code != 200:
            return False

        models = response.json().get("models", [])

        for model in models:
            model_name = model.get("name", "")

            if model_name.startswith(MODEL):
                return True

        return False

    except Exception:
        return False


# ============================================================
# MAIN PAGE
# ============================================================

@app.route("/")
def index():
    return render_template("index.html")


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/api/health")
def health():

    available = ollama_available()

    return jsonify({
        "ollama": available,
        "model": MODEL,
        "status": "ready" if available else "offline"
    })


# ============================================================
# TOPICS API
# ============================================================

@app.route("/api/topics")
def get_topics():
    return jsonify(TOPICS)


@app.route("/api/topics/<topic_id>")
def get_topic(topic_id):

    topic = next(
        (item for item in TOPICS if item["id"] == topic_id),
        None
    )

    if not topic:
        return jsonify({
            "error": "Topic not found"
        }), 404

    return jsonify(topic)


@app.route("/api/topic")
def random_topic():

    topic = random.choice(TOPICS)

    return jsonify(topic)


# ============================================================
# AI TUTOR
# ============================================================

@app.route("/api/tutor", methods=["POST"])
def tutor():

    data = request.get_json(silent=True) or {}

    message = str(data.get("message", "")).strip()

    requested_limit = data.get("word_limit")

    if not message:
        return jsonify({
            "error": "Please enter a message or question."
        }), 400

    # Detect limit from message
    detected_limit = extract_word_limit(message)

    if detected_limit:
        word_limit = detected_limit

    else:
        try:
            word_limit = int(requested_limit)
        except (TypeError, ValueError):
            word_limit = DEFAULT_WORD_LIMIT

        word_limit = max(
            MIN_WORD_LIMIT,
            min(MAX_WORD_LIMIT, word_limit)
        )

    # Domain validation
    if not is_data_question(message):

        return jsonify({
            "error": (
                "InsightForge AI is focused on data analytics. "
                "Please ask a question related to SQL, databases, "
                "Excel, Power BI, statistics, Python, data cleaning, "
                "visualization or another data analytics topic."
            )
        }), 400

    try:

        prompt = build_prompt(
            message,
            word_limit
        )

        answer = ask_ollama(prompt)

        answer = trim_to_word_limit(
            answer,
            word_limit
        )

        return jsonify({
            "answer": answer,
            "word_limit": word_limit,
            "word_count": count_words(answer)
        })

    except requests.exceptions.ConnectionError:

        return jsonify({
            "error": (
                "Ollama is not running. "
                "Please start Ollama and make sure llama3.2 is installed."
            )
        }), 503

    except requests.exceptions.Timeout:

        return jsonify({
            "error": (
                "AI response timed out. "
                "Please try a shorter question."
            )
        }), 504

    except Exception as e:

        return jsonify({
            "error": f"Unable to generate AI response: {str(e)}"
        }), 500


# ============================================================
# STREAMING AI TUTOR
# ============================================================

@app.route("/api/tutor/stream", methods=["POST"])
def tutor_stream():

    data = request.get_json(silent=True) or {}

    message = str(data.get("message", "")).strip()

    requested_limit = data.get("word_limit")

    if not message:

        return jsonify({
            "error": "Please enter a message or question."
        }), 400

    detected_limit = extract_word_limit(message)

    if detected_limit:

        word_limit = detected_limit

    else:

        try:
            word_limit = int(requested_limit)

        except (TypeError, ValueError):

            word_limit = DEFAULT_WORD_LIMIT

        word_limit = max(
            MIN_WORD_LIMIT,
            min(MAX_WORD_LIMIT, word_limit)
        )

    if not is_data_question(message):

        return jsonify({
            "error": (
                "InsightForge AI is focused on data analytics. "
                "Please ask a question related to SQL, databases, "
                "Excel, Power BI, statistics, Python, data cleaning, "
                "visualization or another data analytics topic."
            )
        }), 400

    prompt = build_prompt(
        message,
        word_limit
    )

    def generate():

        collected = ""

        try:

            with requests.post(
                OLLAMA_URL,
                json={
                    "model": MODEL,
                    "prompt": prompt,
                    "stream": True
                },
                stream=True,
                timeout=OLLAMA_TIMEOUT
            ) as response:

                response.raise_for_status()

                for line in response.iter_lines():

                    if not line:
                        continue

                    try:

                        data = json.loads(
                            line.decode("utf-8")
                        )

                    except json.JSONDecodeError:

                        continue

                    chunk = data.get(
                        "response",
                        ""
                    )

                    if chunk:

                        collected += chunk

                        if count_words(collected) <= word_limit:

                            yield (
                                "data: "
                                + json.dumps({
                                    "type": "chunk",
                                    "text": chunk
                                })
                                + "\n\n"
                            )

                    if data.get("done"):

                        final_text = trim_to_word_limit(
                            collected,
                            word_limit
                        )

                        yield (
                            "data: "
                            + json.dumps({
                                "type": "done",
                                "word_count": count_words(final_text),
                                "word_limit": word_limit
                            })
                            + "\n\n"
                        )

        except Exception as e:

            yield (
                "data: "
                + json.dumps({
                    "type": "error",
                    "error": str(e)
                })
                + "\n\n"
            )

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream"
    )


# ============================================================
# QUIZ API
# ============================================================

@app.route("/api/quiz", methods=["POST"])
def create_quiz():

    data = request.get_json(silent=True) or {}

    try:
        count = int(data.get("count", 10))
    except (TypeError, ValueError):
        count = 10

    if count not in [5, 10, 15]:
        count = 10

    # --------------------------------------------------------
    # New Feature:
    # User can select a quiz field/category.
    #
    # Default = All Topics
    # --------------------------------------------------------

    category = str(
        data.get("category", "All Topics")
    ).strip()

    if not category:
        category = "All Topics"

    if category.lower() == "all topics":

        available_questions = QUIZ_QUESTIONS

    else:

        available_questions = [
            question
            for question in QUIZ_QUESTIONS
            if question["topic"].lower() == category.lower()
        ]

    # If selected category has fewer questions than requested,
    # use all available questions in that category.

    actual_count = min(
        count,
        len(available_questions)
    )

    if actual_count == 0:

        return jsonify({
            "error": "No quiz questions are available for this field."
        }), 404

    selected_questions = random.sample(
        available_questions,
        actual_count
    )

    public_questions = []

    for question in selected_questions:

        shuffled_options = question["options"].copy()

        random.shuffle(shuffled_options)

        public_questions.append({

            "id": question["id"],

            "question": question["question"],

            "options": shuffled_options,

            "topic": question["topic"]

        })

    return jsonify({
        "questions": public_questions,
        "category": category,
        "count": actual_count
    })


# ============================================================
# QUIZ SUBMISSION
# ============================================================

@app.route("/api/quiz/submit", methods=["POST"])
def submit_quiz():

    data = request.get_json(silent=True) or {}

    question_ids = data.get(
        "question_ids",
        []
    )

    answers = data.get(
        "answers",
        {}
    )

    if not isinstance(question_ids, list):

        return jsonify({
            "error": "Invalid question list."
        }), 400

    if not isinstance(answers, dict):

        return jsonify({
            "error": "Invalid answer data."
        }), 400

    question_map = {
        question["id"]: question
        for question in QUIZ_QUESTIONS
    }

    score = 0
    review = []

    for question_id in question_ids:

        question = question_map.get(
            question_id
        )

        if not question:
            continue

        selected = answers.get(
            question_id,
            ""
        )

        correct = question["answer"]

        is_correct = (
            selected == correct
        )

        if is_correct:
            score += 1

        review.append({

            "id": question_id,

            "question": question["question"],

            "selected": selected
            if selected
            else "Not answered",

            "correct": correct,

            "correct_text": correct,

            "is_correct": is_correct,

            "topic": question["topic"]

        })

    total = len(review)

    percentage = (
        round((score / total) * 100)
        if total
        else 0
    )

    if percentage >= 80:

        feedback = "Excellent work! You have a strong understanding of the selected topics."

    elif percentage >= 60:

        feedback = "Good job! Review the incorrect answers and strengthen the weaker areas."

    elif percentage >= 40:

        feedback = "You have a basic understanding. More practice will help improve your score."

    else:

        feedback = "Keep practicing. Review the topic explanations and try the quiz again."

    return jsonify({

        "score": score,

        "total": total,

        "percentage": percentage,

        "feedback": feedback,

        "review": review

    })


# ============================================================
# RUN APPLICATION
# ============================================================

if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )