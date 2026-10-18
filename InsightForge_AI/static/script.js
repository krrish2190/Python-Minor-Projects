/* ============================================================
   INSIGHTFORGE AI
   Frontend JavaScript
============================================================ */


/* ============================================================
   GLOBAL STATE
============================================================ */

let allTopics = [];

let selectedTopic = null;

let selectedQuizSize = 10;

let selectedQuizCategory = "All Topics";

let quizQuestions = [];

let currentQuestion = 0;

let userAnswers = {};

let lastQuizResults = null;

let selectedWordLimit = 250;

let recognition = null;

let isListening = false;


/* ============================================================
   INITIALIZATION
============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    initializeNavigation();

    initializeTutor();

    initializeQuiz();

    initializeTopicSearch();

    loadTopics();

    loadTopicOfDay();

    updateStatistics();

    checkAIStatus();

});


/* ============================================================
   NAVIGATION
============================================================ */

function initializeNavigation() {

    document.querySelectorAll(".nav-item").forEach(button => {

        button.addEventListener("click", () => {

            const page = button.dataset.page;

            showPage(page);

        });

    });

}


function showPage(pageId) {

    document.querySelectorAll(".page").forEach(page => {

        page.classList.remove("active");

    });


    const targetPage =
        document.getElementById(pageId);


    if (targetPage) {

        targetPage.classList.add("active");

    }


    document.querySelectorAll(".nav-item").forEach(button => {

        button.classList.remove("active");

        if (button.dataset.page === pageId) {

            button.classList.add("active");

        }

    });


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* ============================================================
   AI STATUS
============================================================ */

async function checkAIStatus() {

    const statusElement =
        document.getElementById("modelStatus");

    try {

        const response =
            await fetch("/api/health");

        const data =
            await response.json();

        if (data.ollama) {

            statusElement.textContent =
                "Ollama • Llama 3.2 • Ready";

        } else {

            statusElement.textContent =
                "Ollama • Start Ollama";

        }

    } catch {

        statusElement.textContent =
            "Ollama • Check connection";

    }

}


/* ============================================================
   TOPICS
============================================================ */

async function loadTopics() {

    try {

        const response =
            await fetch("/api/topics");

        allTopics =
            await response.json();

        renderDashboardTopics();

        renderTopicsLibrary();

    } catch (error) {

        console.error(
            "Unable to load topics:",
            error
        );

    }

}


function renderDashboardTopics() {

    const container =
        document.getElementById(
            "dashboardTopics"
        );

    if (!container) return;


    const topics =
        allTopics.slice(0, 12);


    container.innerHTML =
        topics.map(topic => createTopicCard(topic))
        .join("");

}


function renderTopicsLibrary(
    filterText = ""
) {

    const container =
        document.getElementById(
            "topicsLibrary"
        );

    if (!container) return;


    const search =
        filterText.toLowerCase().trim();


    const filtered =
        allTopics.filter(topic => {

            return (
                topic.title.toLowerCase().includes(search) ||
                topic.category.toLowerCase().includes(search) ||
                topic.description.toLowerCase().includes(search)
            );

        });


    if (filtered.length === 0) {

        container.innerHTML = `
            <div class="info-card">
                <h3>No topics found</h3>
                <p>
                    Try searching for SQL, Excel, Power BI,
                    Python, Statistics or another analytics topic.
                </p>
            </div>
        `;

        return;

    }


    container.innerHTML =
        filtered.map(topic => createTopicCard(topic))
        .join("");

}


function createTopicCard(topic) {

    return `

        <div class="topic-card"
             onclick="openTopic('${topic.id}')">

            <span class="topic-category">
                ${escapeHtml(topic.category)}
            </span>

            <h3>
                ${escapeHtml(topic.title)}
            </h3>

            <p>
                ${escapeHtml(topic.description)}
            </p>

            <span class="topic-level">
                ${escapeHtml(topic.level)}
            </span>

        </div>

    `;

}


async function loadTopicOfDay() {

    const container =
        document.getElementById(
            "topicOfDay"
        );

    if (!container) return;


    try {

        const response =
            await fetch("/api/topic");

        const topic =
            await response.json();


        container.innerHTML = `

            <div class="topic-category">
                ${escapeHtml(topic.category)}
            </div>

            <h3>
                ${escapeHtml(topic.title)}
            </h3>

            <p>
                ${escapeHtml(topic.description)}
            </p>

            <br>

            <button class="primary-button"
                    onclick="openTopic('${topic.id}')">

                Explore Topic
                <span>→</span>

            </button>

        `;

    } catch {

        container.textContent =
            "Unable to load today's topic.";

    }

}


function initializeTopicSearch() {

    const searchInput =
        document.getElementById(
            "topicSearch"
        );

    if (!searchInput) return;


    searchInput.addEventListener(
        "input",
        event => {

            renderTopicsLibrary(
                event.target.value
            );

        }
    );

}


async function openTopic(topicId) {

    try {

        const response =
            await fetch(
                `/api/topics/${topicId}`
            );

        if (!response.ok) return;


        selectedTopic =
            await response.json();


        document.getElementById(
            "modalCategory"
        ).textContent =
            selectedTopic.category;


        document.getElementById(
            "modalTitle"
        ).textContent =
            selectedTopic.title;


        document.getElementById(
            "modalLevel"
        ).textContent =
            selectedTopic.level;


        document.getElementById(
            "modalDescription"
        ).textContent =
            selectedTopic.description;


        document.getElementById(
            "modalDetails"
        ).textContent =
            selectedTopic.details;


        document.getElementById(
            "modalExample"
        ).textContent =
            selectedTopic.example;


        document.getElementById(
            "topicModal"
        ).classList.remove("hidden");

    } catch (error) {

        console.error(
            "Topic error:",
            error
        );

    }

}


function closeTopicModal() {

    document.getElementById(
        "topicModal"
    ).classList.add("hidden");

}


function learnTopicWithAI() {

    if (!selectedTopic) return;


    closeTopicModal();

    showPage("tutor");


    useQuestion(
        `Explain ${selectedTopic.title} with a practical data analytics example`
    );

}


/* ============================================================
   AI TUTOR
============================================================ */

function initializeTutor() {

    const input =
        document.getElementById(
            "tutorInput"
        );


    if (!input) return;


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendTutorMessage();

            }

        }
    );


    input.addEventListener(
        "input",
        () => {

            input.style.height =
                "auto";

            input.style.height =
                Math.min(
                    input.scrollHeight,
                    120
                ) + "px";

        }
    );


    document
        .querySelectorAll(
            ".length-buttons button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            ".length-buttons button"
                        )
                        .forEach(item => {

                            item.classList.remove(
                                "active"
                            );

                        });


                    button.classList.add(
                        "active"
                    );


                    selectedWordLimit =
                        Number(
                            button.dataset.limit
                        );

                }
            );

        });

}


function detectWordLimit(text) {

    const patterns = [

        /(?:in|within|under|below|max(?:imum)?|limit(?:\s+of)?)\s*(\d{2,4})\s*words?/i,

        /(\d{2,4})\s*words?/i

    ];


    for (
        const pattern of patterns
    ) {

        const match =
            text.match(pattern);


        if (match) {

            const value =
                Number(match[1]);


            if (
                value >= 25 &&
                value <= 2000
            ) {

                return value;

            }

        }

    }


    return null;

}


async function sendTutorMessage() {

    const input =
        document.getElementById(
            "tutorInput"
        );


    const message =
        input.value.trim();


    /* EMPTY MESSAGE */

    if (!message) {

        showPopup();

        input.focus();

        return;

    }


    /* DETECT WORD LIMIT */

    const detectedLimit =
        detectWordLimit(message);


    const wordLimit =
        detectedLimit ||
        selectedWordLimit;


    /* ADD USER MESSAGE */

    addUserMessage(message);


    input.value = "";

    input.style.height =
        "42px";


    /* ADD AI PLACEHOLDER */

    const aiMessage =
        addAIMessage();


    scrollChat();


    try {

        const response =
            await fetch(
                "/api/tutor/stream",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        message: message,

                        word_limit:
                            wordLimit

                    })

                }
            );


        if (!response.ok) {

            const errorData =
                await response.json();

            throw new Error(
                errorData.error ||
                "Unable to get AI response."
            );

        }


        const reader =
            response.body.getReader();


        const decoder =
            new TextDecoder();


        let buffer = "";


        while (true) {

            const {
                value,
                done
            } =
                await reader.read();


            if (done) break;


            buffer +=
                decoder.decode(
                    value,
                    {
                        stream: true
                    }
                );


            const events =
                buffer.split("\n\n");


            buffer =
                events.pop();


            for (
                const event
                of events
            ) {

                if (
                    !event.startsWith("data:")
                ) {

                    continue;

                }


                const jsonText =
                    event.replace(
                        "data:",
                        ""
                    ).trim();


                if (!jsonText) continue;


                const data =
                    JSON.parse(
                        jsonText
                    );


                if (
                    data.type === "chunk"
                ) {

                    updateAIMessage(
                        aiMessage,
                        data.text
                    );

                    scrollChat();

                }


                if (
                    data.type === "error"
                ) {

                    throw new Error(
                        data.error
                    );

                }

            }

        }


        addSpeakButton(
            aiMessage
        );


    } catch (error) {

        updateAIMessage(
            aiMessage,
            `**Unable to generate a response.**\n\n${error.message}`
        );

    }


    scrollChat();

}


function addUserMessage(message) {

    const chatBox =
        document.getElementById(
            "chatBox"
        );


    const element =
        document.createElement(
            "div"
        );


    element.className =
        "chat-message user-message";


    element.innerHTML = `

        <div class="message-avatar">
            YOU
        </div>

        <div class="message-content">

            <div class="message-name">
                You
            </div>

            <div class="ai-text">
                ${escapeHtml(message)}
            </div>

        </div>

    `;


    chatBox.appendChild(
        element
    );

}


function addAIMessage() {

    const chatBox =
        document.getElementById(
            "chatBox"
        );


    const element =
        document.createElement(
            "div"
        );


    element.className =
        "chat-message ai-message";


    element.innerHTML = `

        <div class="message-avatar">
            IF
        </div>

        <div class="message-content">

            <div class="message-name">
                InsightForge AI
            </div>

            <div class="ai-text">
                <span class="typing">
                    Thinking...
                </span>
            </div>

        </div>

    `;


    chatBox.appendChild(
        element
    );


    return element;

}


function updateAIMessage(
    element,
    text
) {

    const textContainer =
        element.querySelector(
            ".ai-text"
        );


    const existing =
        textContainer.dataset.raw ||
        "";


    const combined =
        existing + text;


    textContainer.dataset.raw =
        combined;


    textContainer.innerHTML =
        formatResponse(
            combined
        );

}


function addSpeakButton(
    element
) {

    const content =
        element.querySelector(
            ".message-content"
        );


    if (
        content.querySelector(
            ".speak-button"
        )
    ) {

        return;

    }


    const button =
        document.createElement(
            "button"
        );


    button.className =
        "speak-button";

    button.textContent =
        "🔊 Read aloud";

    button.style.marginTop =
        "10px";

    button.style.border =
        "1px solid #e5e5ed";

    button.style.background =
        "white";

    button.style.padding =
        "6px 9px";

    button.style.borderRadius =
        "7px";

    button.style.cursor =
        "pointer";

    button.style.fontSize =
        "10px";


    button.onclick = () => {

        const text =
            element.querySelector(
                ".ai-text"
            ).innerText;


        speakText(text);

    };


    content.appendChild(
        button
    );

}


function scrollChat() {

    const chatBox =
        document.getElementById(
            "chatBox"
        );


    if (!chatBox) return;


    chatBox.scrollTop =
        chatBox.scrollHeight;

}


function useQuestion(question) {

    showPage("tutor");


    const input =
        document.getElementById(
            "tutorInput"
        );


    input.value =
        question;


    input.focus();

}


function formatResponse(text) {

    if (!text) return "";


    let escaped =
        escapeHtml(text);


    /* CODE BLOCKS */

    const codeBlocks = [];


    escaped =
        escaped.replace(
            /```([\s\S]*?)```/g,
            function(match, code) {

                const index =
                    codeBlocks.length;


                codeBlocks.push(
                    `<pre><code>${code.trim()}</code></pre>`
                );


                return `@@CODE${index}@@`;

            }
        );


    /* HEADINGS */

    escaped =
        escaped.replace(
            /^###\s+(.+)$/gm,
            "<h3>$1</h3>"
        );


    escaped =
        escaped.replace(
            /^##\s+(.+)$/gm,
            "<h2>$1</h2>"
        );


    escaped =
        escaped.replace(
            /^#\s+(.+)$/gm,
            "<h1>$1</h1>"
        );


    /* BOLD */

    escaped =
        escaped.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );


    /* INLINE CODE */

    escaped =
        escaped.replace(
            /`([^`]+)`/g,
            "<code>$1</code>"
        );


    /* BULLETS */

    escaped =
        escaped.replace(
            /^\s*[-*]\s+(.+)$/gm,
            "<li>$1</li>"
        );


    escaped =
        escaped.replace(
            /(<li>.*?<\/li>\n?)+/gs,
            function(match) {

                return `<ul>${match}</ul>`;

            }
        );


    /* NUMBERED LIST */

    escaped =
        escaped.replace(
            /^\s*\d+\.\s+(.+)$/gm,
            "<li>$1</li>"
        );


    /* PARAGRAPHS */

    const lines =
        escaped.split("\n");


    let output = "";


    for (
        const line
        of lines
    ) {

        const trimmed =
            line.trim();


        if (!trimmed) {

            continue;

        }


        if (
            trimmed.startsWith("<h") ||
            trimmed.startsWith("<ul") ||
            trimmed.startsWith("</ul") ||
            trimmed.startsWith("<li>") ||
            trimmed.startsWith("@@CODE")
        ) {

            output +=
                trimmed;

        } else {

            output +=
                `<p>${trimmed}</p>`;

        }

    }


    /* RESTORE CODE BLOCKS */

    codeBlocks.forEach(
        (block, index) => {

            output =
                output.replace(
                    `@@CODE${index}@@`,
                    block
                );

        }
    );


    return output;

}


function escapeHtml(text) {

    return String(text)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* ============================================================
   MICROPHONE / VOICE INPUT
============================================================ */

function startVoiceInput() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        showVoiceStatus(
            "Voice input is not supported in this browser."
        );

        return;

    }


    if (isListening) {

        if (recognition) {

            recognition.stop();

        }

        return;

    }


    recognition =
        new SpeechRecognition();


    recognition.lang =
        "en-US";


    recognition.interimResults =
        true;


    recognition.continuous =
        false;


    recognition.maxAlternatives =
        1;


    recognition.onstart = () => {

        isListening = true;


        const button =
            document.getElementById(
                "micButton"
            );


        button.classList.add(
            "listening"
        );


        button.textContent =
            "⏹";


        showVoiceStatus(
            "Listening... speak your question."
        );

    };


    recognition.onresult =
        event => {

            let transcript = "";


            for (
                let i =
                    event.resultIndex;
                i <
                    event.results.length;
                i++
            ) {

                transcript +=
                    event.results[i][0].transcript;

            }


            const input =
                document.getElementById(
                    "tutorInput"
                );


            input.value =
                transcript;


            input.dispatchEvent(
                new Event("input")
            );

        };


    recognition.onerror =
        event => {

            console.error(
                "Voice recognition error:",
                event.error
            );


            if (
                event.error ===
                "not-allowed"
            ) {

                showVoiceStatus(
                    "Microphone permission was denied."
                );

            } else {

                showVoiceStatus(
                    "Unable to recognize speech. Please try again."
                );

            }

        };


    recognition.onend = () => {

        isListening = false;


        const button =
            document.getElementById(
                "micButton"
            );


        button.classList.remove(
            "listening"
        );


        button.textContent =
            "🎙";


        setTimeout(
            () => {

                showVoiceStatus("");

            },
            2500
        );

    };


    recognition.start();

}


function showVoiceStatus(message) {

    const status =
        document.getElementById(
            "voiceStatus"
        );


    if (status) {

        status.textContent =
            message;

    }

}


function speakText(text) {

    if (
        !("speechSynthesis" in window)
    ) {

        return;

    }


    window.speechSynthesis.cancel();


    const cleanText =
        text
            .replace(
                /[#*_`]/g,
                ""
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    const utterance =
        new SpeechSynthesisUtterance(
            cleanText
        );


    utterance.lang =
        "en-US";


    utterance.rate =
        0.95;


    window.speechSynthesis.speak(
        utterance
    );

}


/* ============================================================
   QUIZ
============================================================ */

function initializeQuiz() {

    /* QUIZ SIZE */

    document
        .querySelectorAll(
            ".quiz-size-buttons button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            ".quiz-size-buttons button"
                        )
                        .forEach(item => {

                            item.classList.remove(
                                "active"
                            );

                        });


                    button.classList.add(
                        "active"
                    );


                    selectedQuizSize =
                        Number(
                            button.dataset.size
                        );

                }
            );

        });


    /* QUIZ CATEGORY */

    const categorySelect =
        document.getElementById(
            "quizCategory"
        );


    if (categorySelect) {

        categorySelect.addEventListener(
            "change",
            event => {

                selectedQuizCategory =
                    event.target.value;

            }
        );

    }

}


async function startQuiz() {

    selectedQuizCategory =
        document.getElementById(
            "quizCategory"
        ).value;


    const setup =
        document.getElementById(
            "quizSetup"
        );


    const container =
        document.getElementById(
            "quizContainer"
        );


    const result =
        document.getElementById(
            "quizResult"
        );


    try {

        const response =
            await fetch(
                "/api/quiz",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        count:
                            selectedQuizSize,

                        category:
                            selectedQuizCategory

                    })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Unable to create quiz."
            );

        }


        quizQuestions =
            data.questions;


        currentQuestion =
            0;


        userAnswers =
            {};


        setup.classList.add(
            "hidden"
        );


        result.classList.add(
            "hidden"
        );


        container.classList.remove(
            "hidden"
        );


        document.getElementById(
            "quizCategoryLabel"
        ).textContent =
            data.category;


        showQuestion();

    } catch (error) {

        alert(
            error.message
        );

    }

}


function showQuestion() {

    if (
        !quizQuestions.length
    ) {

        return;

    }


    const question =
        quizQuestions[
            currentQuestion
        ];


    const total =
        quizQuestions.length;


    document.getElementById(
        "questionNumber"
    ).textContent =
        `Question ${currentQuestion + 1}`;


    document.getElementById(
        "quizProgress"
    ).textContent =
        `Question ${currentQuestion + 1} of ${total}`;


    document.getElementById(
        "questionText"
    ).textContent =
        question.question;


    const progress =
        ((currentQuestion + 1) /
            total) *
        100;


    document.getElementById(
        "quizProgressFill"
    ).style.width =
        `${progress}%`;


    const options =
        document.getElementById(
            "answerOptions"
        );


    options.innerHTML =
        "";


    const letters =
        [
            "A",
            "B",
            "C",
            "D"
        ];


    question.options.forEach(
        (option, index) => {

            const button =
                document.createElement(
                    "button"
                );


            button.className =
                "answer-option";


            if (
                userAnswers[
                    question.id
                ] === option
            ) {

                button.classList.add(
                    "selected"
                );

            }


            button.innerHTML = `

                <span class="option-letter">
                    ${letters[index]}
                </span>

                <span>
                    ${escapeHtml(option)}
                </span>

            `;


            button.onclick = () => {

                selectAnswer(
                    option,
                    button
                );

            };


            options.appendChild(
                button
            );

        }
    );


    const nextButton =
        document.getElementById(
            "nextQuestionButton"
        );


    if (
        currentQuestion ===
        total - 1
    ) {

        nextButton.innerHTML =
            "Finish Quiz <span>✓</span>";

    } else {

        nextButton.innerHTML =
            "Next Question <span>→</span>";

    }

}


function selectAnswer(
    answer,
    clickedButton
) {

    const question =
        quizQuestions[
            currentQuestion
        ];


    userAnswers[
        question.id
    ] = answer;


    document
        .querySelectorAll(
            ".answer-option"
        )
        .forEach(button => {

            button.classList.remove(
                "selected"
            );

        });


    clickedButton.classList.add(
        "selected"
    );

}


function nextQuestion() {

    const question =
        quizQuestions[
            currentQuestion
        ];


    if (
        !userAnswers[
            question.id
        ]
    ) {

        alert(
            "Please select an answer before continuing."
        );

        return;

    }


    if (
        currentQuestion <
        quizQuestions.length - 1
    ) {

        currentQuestion++;

        showQuestion();

    } else {

        submitQuiz();

    }

}


async function submitQuiz() {

    try {

        const questionIds =
            quizQuestions.map(
                question =>
                    question.id
            );


        const response =
            await fetch(
                "/api/quiz/submit",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        question_ids:
                            questionIds,

                        answers:
                            userAnswers

                    })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Unable to submit quiz."
            );

        }


        lastQuizResults =
            data;


        document.getElementById(
            "quizContainer"
        ).classList.add(
            "hidden"
        );


        document.getElementById(
            "quizResult"
        ).classList.remove(
            "hidden"
        );


        document.getElementById(
            "resultScore"
        ).textContent =
            `${data.score}/${data.total}`;


        document.getElementById(
            "resultPercentage"
        ).textContent =
            `${data.percentage}%`;


        document.getElementById(
            "resultFeedback"
        ).textContent =
            data.feedback;


        showQuizReview(
            data.review
        );


        saveQuizResult(
            data.percentage
        );


    } catch (error) {

        alert(
            error.message
        );

    }

}


function showQuizReview(review) {

    const container =
        document.getElementById(
            "quizReview"
        );


    container.innerHTML =
        review.map(
            (item, index) => {

                const className =
                    item.is_correct
                        ? "correct"
                        : "incorrect";


                return `

                    <div class="review-card ${className}">

                        <strong>
                            ${index + 1}.
                            ${escapeHtml(item.question)}
                        </strong>

                        <div class="review-answer">

                            <b>Your answer:</b>
                            ${escapeHtml(item.selected)}

                            <br>

                            <b>Correct answer:</b>
                            ${escapeHtml(item.correct_text)}

                            <br>

                            <b>Topic:</b>
                            ${escapeHtml(item.topic)}

                        </div>

                    </div>

                `;

            }
        ).join("");

}


function resetQuiz() {

    quizQuestions =
        [];

    currentQuestion =
        0;

    userAnswers =
        {};

    document.getElementById(
        "quizContainer"
    ).classList.add(
        "hidden"
    );


    document.getElementById(
        "quizResult"
    ).classList.add(
        "hidden"
    );


    document.getElementById(
        "quizSetup"
    ).classList.remove(
        "hidden"
    );

}


/* ============================================================
   STATISTICS
============================================================ */

function saveQuizResult(
    percentage
) {

    let history = [];


    try {

        history =
            JSON.parse(
                localStorage.getItem(
                    "insightforge_history"
                )
            ) || [];

    } catch {

        history =
            [];

    }


    history.push(
        percentage
    );


    localStorage.setItem(
        "insightforge_history",
        JSON.stringify(history)
    );


    updateStatistics();

}


function updateStatistics() {

    let history = [];


    try {

        history =
            JSON.parse(
                localStorage.getItem(
                    "insightforge_history"
                )
            ) || [];

    } catch {

        history =
            [];

    }


    const taken =
        history.length;


    const average =
        taken
            ? Math.round(
                history.reduce(
                    (a, b) =>
                        a + b,
                    0
                ) / taken
            )
            : 0;


    const best =
        taken
            ? Math.max(...history)
            : 0;


    const quizTaken =
        document.getElementById(
            "quizTaken"
        );


    const averageScore =
        document.getElementById(
            "averageScore"
        );


    const bestScore =
        document.getElementById(
            "bestScore"
        );


    if (quizTaken) {

        quizTaken.textContent =
            taken;

    }


    if (averageScore) {

        averageScore.textContent =
            `${average}%`;

    }


    if (bestScore) {

        bestScore.textContent =
            `${best}%`;

    }

}


/* ============================================================
   POPUP
============================================================ */

function showPopup() {

    document.getElementById(
        "messagePopup"
    ).classList.remove(
        "hidden"
    );

}


function closePopup() {

    document.getElementById(
        "messagePopup"
    ).classList.add(
        "hidden"
    );

}


/* ============================================================
   ESCAPE KEY
============================================================ */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {

            closeTopicModal();

            closePopup();

        }

    }
);