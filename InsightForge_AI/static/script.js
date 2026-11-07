
const nativeFetch = window.fetch.bind(window);
const csrfMeta = document.querySelector('meta[name="csrf-token"]');
let csrfToken = csrfMeta?.content || "";
let csrfRequest = null;

function setCsrfToken(token) {
    csrfToken = String(token || "");
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) meta.setAttribute("content", csrfToken);
}

async function getCsrfToken(forceRefresh = false) {
    if (csrfToken && !forceRefresh) return csrfToken;
    if (csrfRequest && !forceRefresh) return csrfRequest;

    csrfRequest = (async () => {
        const response = await nativeFetch(`/api/csrf?_=${Date.now()}`, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" }
        });
        if (!response.ok) {
            throw new Error("Unable to initialize the security token. Please refresh the page.");
        }
        const data = await response.json();
        if (!data.csrf_token) {
            throw new Error("Security token was not returned by Flask. Please refresh the page.");
        }
        setCsrfToken(data.csrf_token);
        return csrfToken;
    })();

    try {
        return await csrfRequest;
    } finally {
        csrfRequest = null;
    }
}

function isStateChangingMethod(method) {
    return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}

window.fetch = async function(input, init = {}) {
    const options = { ...init };
    const method = String(options.method || "GET").toUpperCase();
    options.credentials = options.credentials || "same-origin";

    if (!isStateChangingMethod(method)) {
        return nativeFetch(input, options);
    }

    let token = await getCsrfToken();
    options.headers = new Headers(options.headers || {});
    options.headers.set("X-CSRF-Token", token);

    let response = await nativeFetch(input, options);

    // Authentication can rotate the session token, and a stale browser tab
    // can also hold an old token. Refresh it once and retry the request.
    if (response.status === 403) {
        let errorData = null;
        try { errorData = await response.clone().json(); } catch (_) {}
        const errorText = String(errorData?.error || "").toLowerCase();
        if (errorText.includes("security token") || errorText.includes("csrf")) {
            csrfToken = "";
            token = await getCsrfToken(true);
            options.headers.set("X-CSRF-Token", token);
            response = await nativeFetch(input, options);
        }
    }

    if (response.status === 403) {
        csrfToken = "";
    }
    return response;
};

async function parseJsonResponse(response) {
    const text = await response.text();
    try {
        return text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`Server returned an unexpected response (${response.status}). Please restart Flask and refresh the page.`);
    }
}

/* ============================================================
   INSIGHTFORGE AI — FINAL FRONTEND
   Qwen3 8B + Flask + Ollama
   ============================================================ */

let allTopics = [];
let selectedTopic = null;
let selectedQuizSize = 10;
let selectedQuizCategory = "All Topics";
let selectedWordLimit = 250;
let selectedTutorDifficulty = "Intermediate";
let quizQuestions = [];
let currentQuestion = 0;
let userAnswers = {};
let lastQuizResults = null;
let currentUser = { logged_in: false, guest: true, email: null };
let lastAIText = "";
let lastUserQuestion = "";

/* Camera / attention state */
let attentionEnabled = false;
let attentionStream = null;
let attentionVideo = null;
let attentionFaceMesh = null;
let attentionLoopId = null;
let lastFaceCheck = 0;
let awaySince = null;
let focusedSince = null;
let attentionWarningShown = false;

/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
    try { await getCsrfToken(); } catch (error) { console.warn(error); }
    initializeNavigation();
    initializeTutor();
    initializeQuiz();
    initializeTopicSearch();
    initializeGlobalKeyboard();
    initializeSectionFeedback();
    initializeStudyGoals();
    await loadTopics();
    await loadTopicOfDay();
    await checkAIStatus();
    await refreshAuthState();
    await refreshDashboard();
    await loadStudyPlan();
    await loadProjects();
    await loadPracticeQuestion();
    await loadInterviewHistory();
});

function initializeStudyGoals() {
    const additionalGoals = ["Marketing Analyst", "Product Analyst", "Financial Analyst", "Operations Analyst", "Data Engineer", "Python Data Analyst", "Power BI Developer"];
    document.querySelectorAll("#studyGoal, #roadmapGoal").forEach(select => {
        additionalGoals.forEach(goal => {
            if (![...select.options].some(option => option.value === goal)) {
                select.add(new Option(goal, goal));
            }
        });
    });
}

function initializeNavigation() {
    document.querySelectorAll(".nav-item").forEach(button => {
        button.addEventListener("click", () => showPage(button.dataset.page));
    });
}

function showPage(pageId) {
    if (interviewState?.active && pageId !== "interview") {
        alert("The camera must stay on until you finish or exit the interview.");
        return;
    }
    document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
    document.getElementById(pageId)?.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(button => {
        button.classList.toggle("active", button.dataset.page === pageId);
    });

    if (!["quiz", "interview"].includes(pageId) && attentionEnabled) {
        stopAttentionMode();
    }

    if (pageId === "dashboard") refreshDashboard();
    if (pageId === "topics") renderTopicsLibrary();
}

function initializeGlobalKeyboard() {
    const input = document.getElementById("tutorInput");
    if (!input) return;
    input.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendTutorMessage();
        }
    });
}

/* ============================================================
   AUTH / ACCOUNT
   ============================================================ */

async function refreshAuthState() {
    try {
        const response = await fetch("/api/auth/me");
        currentUser = await response.json();
        updateAccountUI();
    } catch {
        currentUser = { logged_in: false, guest: true, email: null };
        updateAccountUI();
    }
}

function updateAccountUI() {
    const badge = document.getElementById("accountBadge");
    const button = document.getElementById("accountButton");
    if (!badge || !button) return;

    if (currentUser.logged_in) {
        badge.textContent = currentUser.email;
        button.textContent = "My Account";
    } else {
        badge.textContent = "Guest Mode";
        button.textContent = "Sign In / Create Account";
    }

    const panel = document.getElementById("loggedInPanel");
    const email = document.getElementById("loggedAccountEmail");
    if (panel) panel.classList.toggle("hidden", !currentUser.logged_in);
    if (email) email.textContent = currentUser.email || "";
    if (document.getElementById("projectWorkspace")?.dataset.projectId) syncOpenProjectForAccount();
}

function openAccountModal() {
    document.getElementById("accountError").textContent = "";
    document.getElementById("accountModal")?.classList.remove("hidden");
    if (currentUser.logged_in) {
        document.getElementById("loginForm")?.classList.add("hidden");
        document.getElementById("registerForm")?.classList.add("hidden");
        document.getElementById("loginTab")?.classList.remove("active");
        document.getElementById("registerTab")?.classList.remove("active");
    } else {
        switchAccountTab("login");
    }
    updateAccountUI();
}

function closeAccountModal() {
    document.getElementById("accountModal")?.classList.add("hidden");
}

function switchAccountTab(mode) {
    if (currentUser.logged_in) return;
    document.getElementById("loginTab")?.classList.toggle("active", mode === "login");
    document.getElementById("registerTab")?.classList.toggle("active", mode === "register");
    document.getElementById("loginForm")?.classList.toggle("hidden", mode !== "login");
    document.getElementById("registerForm")?.classList.toggle("hidden", mode !== "register");
    document.getElementById("accountError").textContent = "";
}

async function submitAccount(event, mode) {
    event.preventDefault();
    const errorBox = document.getElementById("accountError");
    errorBox.textContent = "";

    const email = mode === "login"
        ? document.getElementById("loginEmail").value.trim()
        : document.getElementById("registerEmail").value.trim();
    const password = mode === "login"
        ? document.getElementById("loginPassword").value
        : document.getElementById("registerPassword").value;

    try {
        const response = await fetch(`/api/auth/${mode}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to continue.");
        if (data.csrf_token) setCsrfToken(data.csrf_token);
        await refreshAuthState();
        closeAccountModal();
        await refreshDashboard();
    } catch (error) {
        errorBox.textContent = error.message;
    }
}

async function continueAsGuest() {
    try {
        const response = await fetch("/api/auth/guest", { method: "POST" });
        const data = await response.json();
        if (data.csrf_token) setCsrfToken(data.csrf_token);
        await refreshAuthState();
        closeAccountModal();
        await refreshDashboard();
    } catch {
        document.getElementById("accountError").textContent = "Unable to start Guest Mode.";
    }
}

async function logoutAccount() {
    const workspace=document.getElementById("projectWorkspace");
    const projectId=workspace?.dataset.projectId;
    if(projectId&&projectSaveTimers.has(projectId)){
        clearTimeout(projectSaveTimers.get(projectId));
        projectSaveTimers.delete(projectId);
        await persistProjectProgress(projectId,projectSavedState(projectId));
    }
    await fetch("/api/auth/logout", { method: "POST" });
    setCsrfToken("");
    await getCsrfToken(true);
    await refreshAuthState();
    closeAccountModal();
    await refreshDashboard();
}

/* ============================================================
   DASHBOARD / PROGRESS
   ============================================================ */

async function refreshDashboard() {
    try {
        const response = await fetch("/api/progress");
        const data = await response.json();

        document.getElementById("quizTaken").textContent = data.quiz_taken || 0;
        document.getElementById("averageScore").textContent = `${data.average_score || 0}%`;
        document.getElementById("bestScore").textContent = `${data.best_score || 0}%`;

        renderLearningPath(data.learning_path || []);
        renderRecentActivity(data.recent_quizzes || [], data.history || []);
        renderSavedNotes(data.notes || []);
        loadRoadmap();
        loadWeaknesses();
        loadAchievements();
    } catch (error) {
        console.warn("Dashboard refresh failed", error);
    }
}

function renderLearningPath(path) {
    const container = document.getElementById("learningPath");
    if (!container) return;
    if (!path.length) {
        container.innerHTML = '<p class="muted-text">Start learning to build your personalized path.</p>';
        return;
    }
    container.innerHTML = path.map(item => `
        <div class="path-row">
            <div class="path-label">
                <strong>${escapeHtml(item.name)}</strong>
                <span>${item.completed}/${item.total}</span>
            </div>
            <div class="path-track"><div class="path-fill" style="width:${item.percent}%"></div></div>
        </div>
    `).join("");
}

function renderRecentActivity(quizzes, history) {
    const container = document.getElementById("recentActivity");
    if (!container) return;
    const items = [];
    quizzes.slice(0, 5).forEach(q => items.push(`Quiz • ${q.percentage}% • ${escapeHtml(q.category)}`));
    history.slice(0, 3).forEach(h => items.push(`AI Tutor • ${escapeHtml(h.user_message.slice(0, 70))}`));
    container.innerHTML = items.length
        ? items.map(item => `<div class="activity-row">${item}</div>`).join("")
        : '<p class="muted-text">No activity yet.</p>';
}

function renderSavedNotes(notes) {
    const container = document.getElementById("savedNotes");
    if (!container) return;
    if (!currentUser.logged_in) {
        container.innerHTML = '<p class="muted-text">Sign in to permanently save AI Tutor notes.</p>';
        return;
    }
    container.innerHTML = notes.length
        ? notes.slice(0, 6).map(note => `
            <div class="note-row">
                <div><strong>${escapeHtml(note.title)}</strong><p>${escapeHtml(note.content.slice(0, 180))}${note.content.length > 180 ? "…" : ""}</p></div>
                <button onclick="deleteNote(${note.id})" title="Delete note">×</button>
            </div>
        `).join("")
        : '<p class="muted-text">No saved notes yet. Use Save Note on an AI answer.</p>';
}

async function deleteNote(id) {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    refreshDashboard();
}

/* ============================================================
   PERSONALIZED LEARNING / PRACTICE / DATASET / PROJECTS
   ============================================================ */
async function loadRoadmap(){const box=document.getElementById("roadmapGoal");if(!box)return;try{const r=await fetch("/api/roadmap");const d=await r.json();box.value=d.goal;const list=document.getElementById("roadmapSteps");if(list)list.innerHTML=d.steps.map((x,i)=>`<div class="roadmap-step"><span>${i+1}</span><strong>${escapeHtml(x)}</strong></div>`).join("");}catch(e){}}
async function saveRoadmapGoal(){const goal=document.getElementById("roadmapGoal")?.value||"Data Analyst";await fetch("/api/roadmap",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({goal})});loadRoadmap();generateStudyPlan();}
async function loadWeaknesses(){const box=document.getElementById("weaknessList");if(!box)return;try{const r=await fetch("/api/weaknesses");const d=await r.json();box.innerHTML=(d.weak||[]).length?(d.weak||[]).map(x=>`<div class="weakness-row"><span>${escapeHtml(x.topic)}</span><strong>${x.score}%</strong></div>`).join(""):"<p class='muted-text'>Complete quizzes to detect weak areas.</p>";const rec=document.getElementById("weakRecommendations");if(rec)rec.innerHTML=(d.recommendations||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join("");}catch(e){}}
async function loadAchievements(){const box=document.getElementById("achievementList");if(!box)return;try{const r=await fetch("/api/achievements");const d=await r.json();box.innerHTML=(d.badges||[]).map(b=>`<div class="badge-card ${b.unlocked?'unlocked':''}"><span>${b.unlocked?'🏆':'🔒'}</span><strong>${escapeHtml(b.title)}</strong></div>`).join("");}catch(e){}}
async function generateStudyPlan(){const button=document.querySelector("#study .start-quiz-button");const goal=document.getElementById("studyGoal")?.value||document.getElementById("roadmapGoal")?.value||"Data Analyst";const days=Number(document.getElementById("studyDays")?.value||20);if(button){button.disabled=true;button.textContent="Generating plan…";}try{const r=await fetch("/api/study-plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({goal,days})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to generate your study plan.");renderStudyPlan(d.plan||[]);}catch(e){alert(e.message||"Unable to generate your study plan.");}finally{if(button){button.disabled=false;button.innerHTML="Generate Study Plan →";}}}
async function loadStudyPlan(){try{const r=await fetch("/api/study-plan");const d=await r.json();renderStudyPlan(d.plan||[]);}catch(e){}}
function renderStudyPlan(plan){
    const dashboardMarkup=plan.length?plan.map(x=>`<div class="study-day"><strong>Day ${x.day}</strong><span>${escapeHtml(x.topic)}</span><small>${escapeHtml(x.task)} • ${x.minutes} min</small></div>`).join(""):"<p class='muted-text'>Generate a plan for your next goal.</p>";
    const studyBox=document.getElementById("studyPlanList");
    if(studyBox){
        if(!plan.length){
            studyBox.innerHTML="<div class='study-empty'><strong>Your plan will appear here</strong><span>Choose your goal and study duration, then generate your personalized day-by-day plan.</span></div>";
        }else{
            const totalMinutes=plan.reduce((sum,x)=>sum+Number(x.minutes||0),0);
            const weeks=Math.ceil(plan.length/7);
            studyBox.innerHTML=`<div class="study-plan-summary"><div><span>Learning goal</span><strong>${escapeHtml(document.getElementById("studyGoal")?.value||"Data Analyst")}</strong></div><div><span>Plan length</span><strong>${plan.length} days</strong></div><div><span>Estimated time</span><strong>${totalMinutes} min</strong></div><div><span>Weekly rhythm</span><strong>${weeks} week${weeks===1?"":"s"}</strong></div></div><div class="study-plan-tip"><strong>How to use this plan</strong><span>Complete each day's objective, do the practical activity, and use the checkpoint to reflect before moving on.</span></div>${plan.map(x=>`<article class="study-day study-day-detailed"><div class="study-day-number">Day ${x.day}<small>Week ${x.week||Math.ceil(x.day/7)}</small></div><div class="study-day-content"><div class="study-day-heading"><div><span class="study-day-topic">${escapeHtml(x.topic)}</span><h3>${escapeHtml(x.objective||x.task)}</h3></div><span class="study-time">${x.minutes} min</span></div><p class="study-day-task">${escapeHtml(x.task)}</p><ul>${(x.activities||[]).map(activity=>`<li>${escapeHtml(activity)}</li>`).join("")}</ul><div class="study-outcome"><strong>By the end of this day</strong><span>${escapeHtml(x.outcome||"Apply what you studied in a practical exercise.")}</span></div><small class="study-checkpoint">${escapeHtml(x.checkpoint||"Review your notes before continuing.")}</small></div></article>`).join("")}`;
        }
    }
    const dashboard=document.getElementById("studyPlanDashboard");
    if(dashboard)dashboard.innerHTML=dashboardMarkup;
}
async function loadProjects(){const box=document.getElementById("projectGrid");if(!box)return;try{const r=await fetch("/api/projects");const data=await parseJsonResponse(r);if(!r.ok)throw new Error(data.error||"Unable to load projects.");if(!Array.isArray(data))throw new Error("The project list returned an invalid response.");box.innerHTML=data.map(p=>`<div class="project-card"><span class="eyebrow">${escapeHtml(p.level)}</span><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.description)}</p><div class="project-skills">${(p.skills||[]).map(s=>`<span>${escapeHtml(s)}</span>`).join("")}</div><button class="primary-button" onclick="openProject('${escapeHtml(p.id)}')">Start Project →</button></div>`).join("")||"<p class='muted-text'>No projects are available right now.</p>";}catch(e){box.innerHTML=`<p class='muted-text'>${escapeHtml(e.message||"Unable to load projects.")}</p>`;}}
const projectSaveTimers = new Map();
function projectStorageKey(id){return currentUser?.logged_in?`insightforge-project-user-${encodeURIComponent(currentUser.email||"account")}-${id}`:`insightforge-project-${id}`;}
function projectSavedState(id){try{return JSON.parse(localStorage.getItem(projectStorageKey(id))||"{}");}catch(e){return {};}}
function storeProjectSavedState(id,state){try{localStorage.setItem(projectStorageKey(id),JSON.stringify(state));}catch(e){}}
async function persistProjectProgress(id,state){
    if(!currentUser?.logged_in)return;
    const timer=projectSaveTimers.get(id);
    if(timer){clearTimeout(timer);projectSaveTimers.delete(id);}
    const status=document.getElementById("projectSaveStatus");
    if(status)status.textContent="Saving to your account…";
    try{
        const response=await fetch(`/api/project/${encodeURIComponent(id)}/progress`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({completed:state.completed||[],notes:state.notes||""})});
        const data=await parseJsonResponse(response);
        if(!response.ok)throw new Error(data.error||"Unable to sync project progress.");
        const latest=projectSavedState(id);
        if((Date.parse(latest.updatedAt||0)||0)>(Date.parse(state.updatedAt||0)||0)){
            latest.syncedAt=data.updated_at;storeProjectSavedState(id,latest);
            if(status)status.textContent="Changes saved here; syncing to your account…";
        }else{
            const saved={...state,updatedAt:data.updated_at,syncedAt:data.updated_at};storeProjectSavedState(id,saved);
            if(status)status.textContent="Saved to your account";
        }
    }catch(error){if(status)status.textContent="Saved on this device; account sync failed. Try again when online.";}
}
function scheduleProjectProgressSave(id,state){
    if(!currentUser?.logged_in)return;
    clearTimeout(projectSaveTimers.get(id));
    const timer=setTimeout(()=>{projectSaveTimers.delete(id);persistProjectProgress(id,projectSavedState(id));},450);
    projectSaveTimers.set(id,timer);
}
function mergeProjectProgress(local,remote){
    const localTime=Date.parse(local.updatedAt||0)||0,remoteTime=Date.parse(remote.updated_at||0)||0;
    const hasUnsyncedLocal=localTime>(Date.parse(local.syncedAt||0)||0);
    if(!hasUnsyncedLocal||localTime<=remoteTime)return {completed:remote.completed||[],notes:remote.notes||"",updatedAt:remote.updated_at||null,syncedAt:remote.updated_at||null};
    const completed=[...new Set([...(local.completed||[]),...(remote.completed||[])])].sort((a,b)=>a-b);
    return {completed,notes:localTime>remoteTime?local.notes||"":remote.notes||"",updatedAt:local.updatedAt,syncedAt:local.syncedAt||remote.updated_at||null};
}
async function syncOpenProjectForAccount(){
    const workspace=document.getElementById("projectWorkspace");
    if(workspace?.dataset.projectId&&!workspace.classList.contains("hidden"))await openProject(workspace.dataset.projectId);
}
async function openProject(id){
    const workspace=document.getElementById("projectWorkspace");if(!workspace)return;
    workspace.dataset.projectId=id;workspace.classList.remove("hidden");workspace.innerHTML="<p class='muted-text'>Loading project…</p>";
    try{
        const response=await fetch(`/api/project/${encodeURIComponent(id)}`);const project=await parseJsonResponse(response);
        if(!response.ok)throw new Error(project.error||"Unable to open this project.");
        const tasks=Array.isArray(project.tasks)?project.tasks:[];let saved=projectSavedState(id);
        if(currentUser?.logged_in){
            const progressResponse=await fetch(`/api/project/${encodeURIComponent(id)}/progress`);const remote=await parseJsonResponse(progressResponse);
            if(!progressResponse.ok)throw new Error(remote.error||"Unable to load your saved project progress.");
            saved=mergeProjectProgress(saved,remote);storeProjectSavedState(id,saved);
            if(JSON.stringify(saved.completed)!==JSON.stringify(remote.completed||[])||saved.notes!==(remote.notes||""))await persistProjectProgress(id,saved);
        }
        const safeId=escapeHtml(project.id);
        workspace.innerHTML=`<div class="project-workspace-head"><div><p class="eyebrow">PROJECT WORKSPACE</p><h2>${escapeHtml(project.title)}</h2><p>${escapeHtml(project.description)}</p></div><button class="secondary-control" onclick="closeProjectWorkspace()">Close</button></div><div class="project-skills">${(project.skills||[]).map(skill=>`<span>${escapeHtml(skill)}</span>`).join("")}</div><h3>Project steps <small id="projectProgressLabel"></small></h3><div class="project-task-list">${tasks.map((task,index)=>`<label class="project-task"><input type="checkbox" ${saved.completed?.includes(index)?"checked":""} onchange="toggleProjectTask('${safeId}',${index},this.checked)"><span>${escapeHtml(task)}</span></label>`).join("")}</div><div class="evaluation-section"><h3>Deliverable</h3><p>${escapeHtml(project.deliverable||"A short analysis report or dashboard with evidence-based insights.")}</p></div><label class="project-notes-label" for="projectNotes">Your project notes</label><textarea id="projectNotes" rows="5" placeholder="Record observations, decisions and findings as you work…" oninput="saveProjectNotes('${safeId}',this.value)" onblur="persistProjectProgress('${safeId}',projectSavedState('${safeId}'))">${escapeHtml(saved.notes||"")}</textarea><p id="projectSaveStatus" class="muted-text project-save-status">${currentUser?.logged_in?"Saved to your account":"Saved on this device"}</p>`;
        updateProjectProgress(id,tasks.length);workspace.scrollIntoView({behavior:"smooth",block:"start"});
    }catch(error){workspace.innerHTML=`<p class='muted-text'>${escapeHtml(error.message||"Unable to open this project.")}</p><button class="secondary-control" onclick="closeProjectWorkspace()">Close</button>`;}
}
function updateProjectProgress(id,total){const saved=projectSavedState(id);const done=(saved.completed||[]).length;const label=document.getElementById("projectProgressLabel");if(label)label.textContent=`${done} of ${total} complete`;}
function toggleProjectTask(id,index,checked){const saved=projectSavedState(id);const completed=new Set(saved.completed||[]);if(checked)completed.add(index);else completed.delete(index);saved.completed=[...completed].sort((a,b)=>a-b);saved.updatedAt=new Date().toISOString();storeProjectSavedState(id,saved);updateProjectProgress(id,document.querySelectorAll("#projectWorkspace .project-task").length);if(currentUser?.logged_in){const status=document.getElementById("projectSaveStatus");if(status)status.textContent="Changes saved here; syncing to your account…";scheduleProjectProgressSave(id,saved);}else{const status=document.getElementById("projectSaveStatus");if(status)status.textContent="Saved on this device";}}
function saveProjectNotes(id,notes){const saved=projectSavedState(id);saved.notes=notes;saved.updatedAt=new Date().toISOString();storeProjectSavedState(id,saved);const status=document.getElementById("projectSaveStatus");if(status)status.textContent=currentUser?.logged_in?"Changes saved here; syncing to your account…":"Saved on this device";scheduleProjectProgressSave(id,saved);}
function closeProjectWorkspace(){const workspace=document.getElementById("projectWorkspace");if(workspace){const id=workspace.dataset.projectId;const timer=projectSaveTimers.get(id);if(timer){clearTimeout(timer);projectSaveTimers.delete(id);if(currentUser?.logged_in)persistProjectProgress(id,projectSavedState(id));}workspace.classList.add("hidden");workspace.replaceChildren();delete workspace.dataset.projectId;}}
let practiceQuestionData=null;
let practiceQuestionHistory={};
function updatePracticeDifficultyLabel(){const label=document.getElementById("practiceQuestionNumber");const difficulty=document.getElementById("practiceDifficulty")?.value||"Intermediate";if(label)label.textContent=`PRACTICE • ${difficulty.toUpperCase()}`;}
function practiceSeenKey(topic){return `insightforge-practice-seen-${topic.toLowerCase()}`;}
function getSeenPracticeQuestions(topic){let saved=[];try{const value=JSON.parse(localStorage.getItem(practiceSeenKey(topic))||"[]");if(Array.isArray(value))saved=value.filter(x=>typeof x==="string");}catch(e){}return [...new Set([...(practiceQuestionHistory[topic]||[]),...saved])];}
async function loadPracticeQuestion(){const topic=document.getElementById("practiceTopic")?.value||"SQL";const difficulty=document.getElementById("practiceDifficulty")?.value||"Intermediate";const question=document.getElementById("practiceQuestion");const options=document.getElementById("practiceOptions");const explanation=document.getElementById("practiceExplanation");const button=document.querySelector("#practice .quiz-setup .start-quiz-button");updatePracticeDifficultyLabel();if(button){button.disabled=true;button.textContent=`Loading ${difficulty} question…`;}if(question)question.textContent="Preparing a new question…";if(options)options.replaceChildren();explanation?.classList.add("hidden");try{const seen=getSeenPracticeQuestions(topic);const r=await fetch("/api/practice",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,difficulty,seen})});const d=await parseJsonResponse(r);if(!r.ok)throw new Error(d.error||"Unable to load a practice question.");practiceQuestionData=d;if(question)question.textContent=d.question;if(options)options.innerHTML=d.options.map((x,i)=>`<button class="answer-option" onclick="answerPracticeIndex(${i})"><span class="option-letter">${String.fromCharCode(65+i)}</span><span>${escapeHtml(x)}</span></button>`).join("");seen.push(d.question);practiceQuestionHistory[topic]=seen;try{localStorage.setItem(practiceSeenKey(topic),JSON.stringify(seen));}catch(e){}}catch(e){practiceQuestionData=null;if(question)question.textContent=e.message||"Unable to load a practice question. Please try again.";}finally{if(button){button.disabled=false;button.textContent="New Practice Question →";}}}
function answerPracticeIndex(index){if(practiceQuestionData?.options?.[index]!==undefined)answerPractice(practiceQuestionData.options[index]);}
function answerPractice(answer){if(!practiceQuestionData)return;const ok=answer===practiceQuestionData.answer;const box=document.getElementById("practiceExplanation");if(!box)return;box.innerHTML=`<strong>${ok?"Correct ✓":"Not quite."}</strong><p>Correct answer: ${escapeHtml(practiceQuestionData.answer)}</p><p>${escapeHtml(practiceQuestionData.explanation)}</p>`;box.classList.remove("hidden");}
async function analyzeDataset(event){event?.preventDefault();const input=document.getElementById("datasetFile");const status=document.getElementById("datasetStatus");const button=document.querySelector("#datalab form button[type=submit]");if(!input?.files?.[0]){if(status)status.textContent="Choose a CSV or Excel file first.";return;}const fd=new FormData();fd.append("file",input.files[0]);document.getElementById("datasetResults")?.classList.add("hidden");if(status)status.textContent="Checking and analyzing the uploaded file…";if(button){button.disabled=true;button.textContent="Analyzing…";}try{const r=await fetch("/api/dataset/analyze",{method:"POST",body:fd});const d=await parseJsonResponse(r);if(!r.ok)throw new Error(d.error||"Dataset analysis failed.");const results=document.getElementById("datasetResults");results?.classList.remove("hidden");document.getElementById("datasetRelevance").textContent=d.relevance_message||"Dataset analyzed.";document.getElementById("datasetSummary").innerHTML=`<div class="dataset-stat"><strong>${d.rows}</strong><span>Rows</span></div><div class="dataset-stat"><strong>${d.columns}</strong><span>Columns</span></div><div class="dataset-stat"><strong>${d.duplicates}</strong><span>Duplicates</span></div>`;document.getElementById("datasetColumns").textContent=(d.column_names||[]).join(", ");document.getElementById("datasetMissing").innerHTML=d.missing_values?.length?d.missing_values.map(x=>`<li>${escapeHtml(x.column)}: ${x.count}</li>`).join(""):"<li>No missing values detected.</li>";document.getElementById("datasetNumeric").innerHTML=(d.numeric_summary||[]).map(x=>`<div><strong>${escapeHtml(x.column)}</strong><span>Mean ${x.mean??'—'} • Median ${x.median??'—'} • Min ${x.min??'—'} • Max ${x.max??'—'}</span></div>`).join("")||"<p class='muted-text'>No numeric columns found; use the column and missing-value checks for this dataset.</p>";if(status)status.textContent="Analysis complete.";}catch(e){if(status)status.textContent=e.message||"Dataset analysis failed. Check that the file is a valid CSV or Excel table.";}finally{if(button){button.disabled=false;button.textContent="Analyze Dataset →";}}}

/* ============================================================
   AI STATUS / TOPICS
   ============================================================ */

async function checkAIStatus() {
    const status = document.getElementById("modelStatus");
    const dot = document.querySelector(".status-dot");
    try {
        const response = await fetch("/api/health");
        const data = await response.json();
        if (status) status.textContent = data.ollama ? `Ollama • ${data.model}` : `Ollama • Offline`;
        if (dot) dot.classList.toggle("offline", !data.ollama);
    } catch {
        if (status) status.textContent = "Ollama • Offline";
        if (dot) dot.classList.add("offline");
    }
}

async function loadTopics() {
    try {
        const response = await fetch("/api/topics");
        allTopics = await response.json();
        renderDashboardTopics();
        renderTopicsLibrary();
        populateQuizCategories();
    } catch (error) {
        console.error("Topic loading failed", error);
    }
}

function renderDashboardTopics() {
    const container = document.getElementById("dashboardTopics");
    if (!container) return;
    container.innerHTML = allTopics.slice(0, 6).map(createTopicCard).join("");
}

function renderTopicsLibrary(filter = "") {
    const container = document.getElementById("topicsLibrary");
    if (!container) return;
    const query = filter.toLowerCase().trim();
    const topics = allTopics.filter(topic =>
        !query || `${topic.title} ${topic.category} ${topic.description}`.toLowerCase().includes(query)
    );
    container.innerHTML = topics.length
        ? topics.map(createTopicCard).join("")
        : '<p class="muted-text">No matching topics found.</p>';
}

function createTopicCard(topic) {
    return `
        <button class="topic-card" onclick="openTopic('${escapeHtml(topic.id)}')">
            <span class="topic-category">${escapeHtml(topic.category)}</span>
            <strong>${escapeHtml(topic.title)}</strong>
            <span>${escapeHtml(topic.description)}</span>
            <small>${escapeHtml(topic.level)} →</small>
        </button>
    `;
}

async function loadTopicOfDay() {
    const container = document.getElementById("topicOfDay");
    if (!container) return;
    try {
        const response = await fetch("/api/topic");
        const topic = await response.json();
        container.innerHTML = `
            <div>
                <span class="topic-category">${escapeHtml(topic.category)}</span>
                <h3>${escapeHtml(topic.title)}</h3>
                <p>${escapeHtml(topic.description)}</p>
            </div>
            <button class="primary-button" onclick="openTopic('${escapeHtml(topic.id)}')">Explore <span>→</span></button>
        `;
    } catch {
        container.textContent = "Unable to load today's topic.";
    }
}

function initializeTopicSearch() {
    const search = document.getElementById("topicSearch");
    if (search) search.addEventListener("input", () => renderTopicsLibrary(search.value));
}

async function openTopic(topicId) {
    try {
        const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}`);
        const topic = await response.json();
        if (!response.ok) throw new Error(topic.error || "Topic not found.");
        selectedTopic = topic;
        document.getElementById("modalCategory").textContent = topic.category;
        document.getElementById("modalTitle").textContent = topic.title;
        document.getElementById("modalLevel").textContent = topic.level;
        document.getElementById("modalDescription").textContent = topic.description;
        document.getElementById("modalDetails").textContent = topic.details;
        document.getElementById("modalExample").textContent = topic.example;
        document.getElementById("topicModal")?.classList.remove("hidden");
        await fetch(`/api/progress/topic/${encodeURIComponent(topicId)}`, { method: "POST" });
        refreshDashboard();
    } catch (error) {
        alert(error.message);
    }
}

function closeTopicModal() {
    document.getElementById("topicModal")?.classList.add("hidden");
}

function learnTopicWithAI() {
    if (!selectedTopic) return;
    closeTopicModal();
    showPage("tutor");
    const input = document.getElementById("tutorInput");
    input.value = `Explain ${selectedTopic.title} with a practical Data Analytics example.`;
    input.focus();
}

function populateQuizCategories() {
    const select = document.getElementById("quizCategory");
    if (!select) return;
    const categories = [...new Set(allTopics.map(t => t.category))];
    const current = select.value || "All Topics";
    select.innerHTML = '<option value="All Topics">All Topics</option>' +
        categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
    select.value = categories.includes(current) ? current : "All Topics";
}

/* ============================================================
   AI TUTOR
   ============================================================ */

function initializeTutor() {
    document.querySelectorAll(".length-buttons button").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".length-buttons button").forEach(item => item.classList.remove("active"));
            button.classList.add("active");
            selectedWordLimit = Number(button.dataset.limit);
        });
    });

    const difficulty = document.getElementById("tutorDifficulty");
    if (difficulty) difficulty.addEventListener("change", e => selectedTutorDifficulty = e.target.value);
}

function detectWordLimit(text) {
    const patterns = [
        /(?:in|within|under|below|max(?:imum)?|limit(?:\s+of)?)\s*(\d{2,4})\s*words?/i,
        /(\d{2,4})\s*words?/i
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const value = Number(match[1]);
            if ([50,100,250,500,1000].includes(value)) return value;
        }
    }
    return null;
}

async function sendTutorMessage(customMessage = null, followup = null) {
    const input = document.getElementById("tutorInput");
    const message = (customMessage ?? input.value).trim();
    if (!message) {
        showPopup();
        input.focus();
        return;
    }

    const detectedLimit = detectWordLimit(message);
    const wordLimit = detectedLimit || selectedWordLimit;
    lastUserQuestion = message;

    addUserMessage(message);
    if (customMessage === null) {
        input.value = "";
        input.style.height = "42px";
    }

    const aiMessage = addAIMessage();
    scrollChat();

    try {
        const response = await fetch("/api/tutor/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message,
                word_limit: wordLimit,
                difficulty: selectedTutorDifficulty,
                followup
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Unable to get AI response.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop();

            for (const event of events) {
                if (!event.startsWith("data:")) continue;
                try {
                    const data = JSON.parse(event.slice(5).trim());
                    if (data.type === "chunk") {
                        fullText += data.text;
                        updateAIMessage(aiMessage, fullText);
                        scrollChat();
                    } else if (data.type === "error") {
                        throw new Error(data.error);
                    }
                } catch (parseError) {
                    if (parseError.message && !parseError.message.includes("Unexpected token")) throw parseError;
                }
            }
        }

        lastAIText = fullText.trim();
        finalizeAIMessage(aiMessage, lastAIText, message);
        refreshDashboard();
    } catch (error) {
        aiMessage.querySelector(".ai-text").innerHTML = `<p class="error-text">${escapeHtml(error.message)}</p>`;
    }
}

function addUserMessage(message) {
    const chat = document.getElementById("chatBox");
    const div = document.createElement("div");
    div.className = "chat-message user-message";
    div.innerHTML = `
        <div class="message-avatar">You</div>
        <div class="message-content">
            <div class="message-name">You</div>
            <div class="ai-text">${escapeHtml(message)}</div>
        </div>`;
    chat.appendChild(div);
}

function addAIMessage() {
    const chat = document.getElementById("chatBox");
    const div = document.createElement("div");
    div.className = "chat-message ai-message";
    div.innerHTML = `
        <div class="message-avatar">IF</div>
        <div class="message-content">
            <div class="message-name">InsightForge AI</div>
            <div class="ai-text"><span class="typing-indicator">Thinking…</span></div>
        </div>`;
    chat.appendChild(div);
    return div;
}

function updateAIMessage(messageElement, text) {
    const target = messageElement.querySelector(".ai-text");
    if (target) target.innerHTML = formatResponse(text);
}

function finalizeAIMessage(messageElement, text, userQuestion) {
    const target = messageElement.querySelector(".message-content");
    const textBox = messageElement.querySelector(".ai-text");
    if (textBox) textBox.innerHTML = formatResponse(text);

    const actions = document.createElement("div");
    actions.className = "ai-actions";
    actions.innerHTML = `
        <button onclick="sendTutorFollowup('Explain it more simply')">Explain Simpler</button>
        <button onclick="sendTutorFollowup('Give a practical example')">Give Example</button>
        <button onclick="sendTutorFollowup('Give a real-world Data Analytics use case')">Real-world Use</button>
        <button onclick="useQuestion('Quiz me on ${escapeHtml(userQuestion.slice(0, 80))}')">Quiz Me</button>
        <button onclick="saveCurrentNote()">Save Note</button>
        <button onclick="speakText(lastAIText)">🔊 Listen</button>
    `;
    target.appendChild(actions);
}

async function sendTutorFollowup(instruction) {
    const combined = `${lastUserQuestion}\n\n${instruction}.`;
    await sendTutorMessage(combined, instruction);
}

async function saveCurrentNote() {
    if (!currentUser.logged_in) {
        openAccountModal();
        document.getElementById("accountError").textContent = "Sign in to permanently save this note.";
        return;
    }
    if (!lastAIText) return;
    const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: lastUserQuestion.slice(0, 100) || "AI Tutor Note", content: lastAIText })
    });
    const data = await response.json();
    if (!response.ok) alert(data.error || "Unable to save note.");
    else refreshDashboard();
}

function useQuestion(question) {
    showPage("tutor");
    const input = document.getElementById("tutorInput");
    input.value = question;
    input.focus();
}

function formatResponse(text) {
    let escaped = escapeHtml(text || "");
    escaped = escaped.replace(/```([\s\S]*?)```/g, (_, code) => `<pre class="code-block">${code.trim()}</pre>`);
    escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
    escaped = escaped.replace(/^###\s+(.+)$/gm, "<h4>$1</h4>");
    escaped = escaped.replace(/^##\s+(.+)$/gm, "<h3>$1</h3>");
    escaped = escaped.replace(/^#\s+(.+)$/gm, "<h3>$1</h3>");
    escaped = escaped.replace(/^\s*[-*]\s+(.+)$/gm, "<li>$1</li>");
    escaped = escaped.replace(/((?:<li>.*?<\/li>\s*)+)/gs, "<ul>$1</ul>");
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\n\n/g, "</p><p>");
    escaped = escaped.replace(/\n/g, "<br>");
    return `<p>${escaped}</p>`;
}

function escapeHtml(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function scrollChat() {
    const chat = document.getElementById("chatBox");
    if (chat) chat.scrollTop = chat.scrollHeight;
}

/* ============================================================
   VOICE
   ============================================================ */

let recognition = null;

function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Speech recognition is not supported by this browser.");
        return;
    }
    if (recognition) {
        recognition.stop();
        recognition = null;
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    const status = document.getElementById("voiceStatus");
    status.textContent = "Listening…";
    recognition.onresult = event => {
        document.getElementById("tutorInput").value = event.results[0][0].transcript;
        status.textContent = "Voice captured.";
    };
    recognition.onerror = () => status.textContent = "Voice input unavailable.";
    recognition.onend = () => { recognition = null; setTimeout(() => status.textContent = "", 1500); };
    recognition.start();
}

function speakText(text) {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[#*`]/g, ""));
    window.speechSynthesis.speak(utterance);
}

/* ============================================================
   QUIZ
   ============================================================ */

function initializeQuiz() {
    document.querySelectorAll(".quiz-size-buttons button").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".quiz-size-buttons button").forEach(item => item.classList.remove("active"));
            button.classList.add("active");
            selectedQuizSize = Number(button.dataset.size);
        });
    });
    const categorySelect = document.getElementById("quizCategory");
    if (categorySelect) categorySelect.addEventListener("change", e => selectedQuizCategory = e.target.value);
}

async function startQuiz() {
    selectedQuizCategory = document.getElementById("quizCategory").value;
    const mode = document.getElementById("aiQuizToggle")?.checked ? "ai" : "fixed";
    const difficulty = document.getElementById("quizDifficulty")?.value || "Intermediate";

    try {
        if (!attentionEnabled) {
            await toggleAttentionMode();
            if (!attentionEnabled) throw new Error("Camera access is required to start a quiz.");
        }
        const response = await fetch("/api/quiz", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ count: selectedQuizSize, category: selectedQuizCategory, mode, difficulty })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to create quiz.");

        if (!Array.isArray(data.questions) || data.questions.length !== Number(selectedQuizSize)) {
            throw new Error(`Quiz setup returned ${data.questions?.length || 0} questions instead of ${selectedQuizSize}. Please start the quiz again.`);
        }
        quizQuestions = data.questions;
        currentQuestion = 0;
        userAnswers = {};
        document.getElementById("quizSetup").classList.remove("hidden");
        document.getElementById("quizSetup").classList.add("session-running");
        document.getElementById("quizResult").classList.add("hidden");
        document.getElementById("quizContainer").classList.remove("hidden");
        const quizCategoryLabel = document.getElementById("quizCategoryLabel");
        if (quizCategoryLabel) {
            quizCategoryLabel.textContent = `${data.category} • ${data.mode === "ai" ? "AI Generated" : "Curated"}`;
        }
        showQuestion();
    } catch (error) {
        alert(error.message);
    }
}

function showQuestion() {
    const question = quizQuestions[currentQuestion];
    if (!question) return;
    const total = quizQuestions.length;
    document.getElementById("questionNumber").textContent = `Question ${currentQuestion + 1}`;
    document.getElementById("quizProgress").textContent = `Question ${currentQuestion + 1} of ${total}`;
    document.getElementById("questionText").textContent = question.question;
    document.getElementById("quizProgressFill").style.width = `${((currentQuestion + 1) / total) * 100}%`;

    const options = document.getElementById("answerOptions");
    options.innerHTML = "";
    ["A", "B", "C", "D"].forEach((letter, index) => {
        const option = question.options[index];
        const button = document.createElement("button");
        button.className = "answer-option";
        if (userAnswers[question.id] === option) button.classList.add("selected");
        button.innerHTML = `<span class="option-letter">${letter}</span><span>${escapeHtml(option)}</span>`;
        button.onclick = () => selectAnswer(option, button);
        options.appendChild(button);
    });

    const next = document.getElementById("nextQuestionButton");
    next.innerHTML = currentQuestion === total - 1 ? "Finish Quiz <span>✓</span>" : "Next Question <span>→</span>";
    updateAttentionLock();
}

function selectAnswer(answer, clickedButton) {
    if (attentionWarningShown) { alert("Please look at the screen before answering."); return; }
    const question = quizQuestions[currentQuestion];
    userAnswers[question.id] = answer;
    document.querySelectorAll(".answer-option").forEach(button => button.classList.remove("selected"));
    clickedButton.classList.add("selected");
}

function nextQuestion() {
    if (attentionWarningShown) { alert("Please look at the screen before continuing."); return; }
    const question = quizQuestions[currentQuestion];
    if (!userAnswers[question.id]) {
        alert("Please select an answer before continuing.");
        return;
    }
    if (currentQuestion < quizQuestions.length - 1) {
        currentQuestion++;
        showQuestion();
    } else {
        submitQuiz();
    }
}

async function submitQuiz() {
    try {
        const response = await fetch("/api/quiz/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question_ids: quizQuestions.map(q => q.id), answers: userAnswers, category: selectedQuizCategory })
        });
        const data = await parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || "Unable to submit quiz.");
        lastQuizResults = data;

        document.getElementById("quizContainer").classList.add("hidden");
        document.getElementById("quizSetup").classList.remove("session-running");
        document.getElementById("quizResult").classList.remove("hidden");
        document.getElementById("resultScore").textContent = `${data.score}/${data.total}`;
        document.getElementById("resultPercentage").textContent = `${data.percentage}%`;
        document.getElementById("resultFeedback").textContent = data.feedback;
        document.getElementById("quizAnalysis").textContent = data.analysis || "Review the topic breakdown and explanations below.";
        showQuizReview(data.review);
        refreshDashboard();
    } catch (error) {
        alert(error.message);
    } finally {
        updateAttentionButtons();
    }
}

function showQuizReview(review) {
    const container = document.getElementById("quizReview");
    container.innerHTML = review.map((item, index) => {
        const className = item.is_correct ? "correct" : "incorrect";
        return `
            <div class="review-card ${className}">
                <strong>${index + 1}. ${escapeHtml(item.question)}</strong>
                <div class="review-answer">
                    <b>Your answer:</b> ${escapeHtml(item.selected)}<br>
                    <b>Correct answer:</b> ${escapeHtml(item.correct_text)}<br>
                    <b>Topic:</b> ${escapeHtml(item.topic)}
                </div>
                <div class="answer-explanation">
                    <b>Why this is correct:</b> ${escapeHtml(item.explanation)}
                </div>
            </div>`;
    }).join("");
}

function resetQuiz() {
    quizQuestions = [];
    currentQuestion = 0;
    userAnswers = {};
    document.getElementById("quizContainer").classList.add("hidden");
    document.getElementById("quizResult").classList.add("hidden");
    document.getElementById("quizSetup").classList.remove("hidden");
    document.getElementById("quizSetup").classList.remove("session-running");
    if (attentionEnabled) stopAttentionMode();
}

/* ============================================================
   INTERVIEW PREP
   ============================================================ */
let interviewState={active:false,question:"",number:1,total:5,mode:"Standard",timer:null};
let interviewRecognition=null;

async function startInterview(){
    const startButton=document.querySelector("#interviewSetup .start-quiz-button");
    if(startButton){startButton.disabled=true;startButton.textContent="Starting interview…";}
    try {
        if(!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
            throw new Error("Verbal interview answers require a browser with speech recognition support.");
        }
        if(!attentionEnabled) await toggleAttentionMode(true);
        if(!attentionEnabled) throw new Error("Camera access is required to start the interview.");
        const payload={
            type:document.getElementById("interviewType")?.value || "Mixed Data Analyst Interview",
            difficulty:document.getElementById("interviewDifficulty")?.value || "Intermediate",
            mode:document.getElementById("interviewMode")?.value || "Standard",
            count:Number(document.getElementById("interviewCount")?.value || 5)
        };
        const r=await fetch("/api/interview/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        const d=await parseJsonResponse(r);
        if(!r.ok) throw new Error(d.error||"Unable to start interview.");
        interviewState={active:true,question:d.question,number:1,total:d.total||payload.count,mode:d.mode||payload.mode,timer:null};
        updateAttentionButtons();
        document.getElementById("interviewSetup")?.classList.remove("hidden");
        document.getElementById("interviewSetup")?.classList.add("session-running");
        document.getElementById("interviewResult")?.classList.add("hidden");
        document.getElementById("interviewContainer")?.classList.remove("hidden");
        document.getElementById("interviewTypeLabel").textContent=d.type;
        document.getElementById("interviewDifficultyLabel")?.replaceChildren(document.createTextNode(d.difficulty || payload.difficulty));
        showInterviewQuestion();
    } catch(e){
        alert(e.message || "Unable to start interview.");
    } finally {
        if(startButton){startButton.disabled=false;startButton.innerHTML="Start Interview <span>→</span>";}
    }
}

function showInterviewQuestion(){
    stopInterviewVoiceInput();
    document.getElementById("interviewQuestion").textContent=interviewState.question;
    document.getElementById("interviewQuestionNumber").textContent=`Question ${interviewState.number}`;
    document.getElementById("interviewProgress").textContent=`Question ${interviewState.number} of ${interviewState.total}`;
    document.getElementById("interviewProgressFill").style.width=`${interviewState.number/interviewState.total*100}%`;
    const answer=document.getElementById("interviewAnswer");
    answer.value="";
    answer.readOnly=true;
    answer.focus();
    const voiceStatus=document.getElementById("interviewVoiceStatus");
    if(voiceStatus) voiceStatus.textContent="Click Start Speaking and answer out loud.";
    document.getElementById("interviewFeedback")?.classList.add("hidden");
    if(interviewState.mode==="Rapid Fire") startRapidFireTimer(); else stopRapidFireTimer();
    updateAttentionLock();
}

function startRapidFireTimer(){
    stopRapidFireTimer();
    let left=30;
    const el=document.getElementById("rapidFireTimer");
    el?.classList.remove("hidden");
    if(el) el.textContent=`${left}s`;
    interviewState.timer=setInterval(()=>{
        left--;
        if(el) el.textContent=`${Math.max(0,left)}s`;
        if(left<=0){stopRapidFireTimer();submitInterviewAnswer(true);}
    },1000);
}

function stopRapidFireTimer(){
    if(interviewState.timer) clearInterval(interviewState.timer);
    interviewState.timer=null;
    document.getElementById("rapidFireTimer")?.classList.add("hidden");
}

function renderInterviewEvaluation(evaluation){
    const feedback=document.getElementById("interviewFeedback");
    if(!feedback) return;
    const metrics=[
        ["Correctness",evaluation?.correctness],
        ["Technical",evaluation?.technical_understanding],
        ["Completeness",evaluation?.completeness],
        ["Communication",evaluation?.communication],
        ["Confidence",evaluation?.confidence]
    ];
    const metricHtml=metrics.map(([label,value])=>{
        const score=Number(value ?? 0);
        return `<div class="interview-mini-score"><span>${label}</span><strong>${score.toFixed(1)}/10</strong><div class="mini-score-track"><div style="width:${Math.max(0,Math.min(100,score*10))}%"></div></div></div>`;
    }).join("");
    const missing=(evaluation?.missing_points||[]).map(x=>`<li>${escapeHtml(String(x))}</li>`).join("");
    const strengths=(evaluation?.strengths||[]).map(x=>`<li>${escapeHtml(String(x))}</li>`).join("");
    feedback.innerHTML=`
        <div class="interview-evaluation-head"><strong>Answer Score: ${Number(evaluation?.score ?? 0).toFixed(1)}/10</strong></div>
        ${evaluation?.analysis_note ? `<p class="muted-text">${escapeHtml(evaluation.analysis_note)}</p>` : ""}
        <div class="interview-mini-score-grid">${metricHtml}</div>
        <div class="evaluation-section"><h4>AI Feedback</h4><p>${escapeHtml(evaluation?.feedback||"")}</p></div>
        <div class="evaluation-section"><h4>Ideal Answer</h4><p>${escapeHtml(evaluation?.ideal_answer||"")}</p></div>
        ${missing ? `<div class="evaluation-section"><h4>Missing Points</h4><ul>${missing}</ul></div>` : ""}
        ${strengths ? `<div class="evaluation-section"><h4>What You Did Well</h4><ul>${strengths}</ul></div>` : ""}
    `;
    feedback.classList.remove("hidden");
}

async function submitInterviewAnswer(autoSubmit=false){
    if(!interviewState.active) return;
    if(attentionWarningShown){alert("Please look at the screen before submitting.");return;}
    if(interviewRecognition){
        stopInterviewVoiceInput();
        document.getElementById("interviewVoiceStatus").textContent="Finishing speech capture. Review your transcript, then submit again.";
        return;
    }
    const answer=document.getElementById("interviewAnswer").value.trim();
    if(!answer){
        const status=document.getElementById("interviewVoiceStatus");
        if(status) status.textContent="A spoken answer is required before you can continue.";
        if(!autoSubmit) alert("Please answer out loud before continuing.");
        return;
    }
    stopRapidFireTimer();
    const button=document.getElementById("submitInterviewAnswer");
    if(button){button.disabled=true;button.textContent="Evaluating answer…";}
    try{
        const r=await fetch("/api/interview/answer",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({question:interviewState.question,answer:answer||"No answer provided."})
        });
        const d=await parseJsonResponse(r);
        if(!r.ok) throw new Error(d.error||"Unable to evaluate answer.");
        renderInterviewEvaluation(d.evaluation||{});
        if(d.complete){
            finishInterview(d);
        }else{
            interviewState.number=d.question_number;
            interviewState.question=d.next_question;
            setTimeout(()=>showInterviewQuestion(),2200);
        }
    }catch(e){
        alert(e.message||"Unable to evaluate answer.");
    }finally{
        if(button){button.disabled=false;button.innerHTML="Submit Answer <span>→</span>";}
    }
}

function finishInterview(d){
    interviewState.active=false;
    stopInterviewVoiceInput();
    stopRapidFireTimer();
    document.getElementById("interviewSetup")?.classList.remove("session-running");
    document.getElementById("interviewContainer")?.classList.add("hidden");
    document.getElementById("interviewResult")?.classList.remove("hidden");
    document.getElementById("interviewOverallScore").textContent=`${d.score}/10`;
    document.getElementById("interviewTechnicalScore").textContent=`${d.technical}/10`;
    document.getElementById("interviewCompletenessScore").textContent=`${d.completeness}/10`;
    document.getElementById("interviewCommunicationScore").textContent=`${d.communication}/10`;
    const confidence=document.getElementById("interviewConfidenceScore");
    if(confidence) confidence.textContent=`${d.confidence ?? 0}/10`;
    const readiness=document.getElementById("interviewReadiness");
    if(readiness) readiness.textContent=d.readiness||"Developing";
    document.getElementById("interviewSummary").textContent=d.summary||"Interview completed.";
    document.getElementById("interviewWeakAreas").innerHTML=(d.weak_areas||[]).map(x=>`<span class="tag">${escapeHtml(x)}</span>`).join("")||"<p>No major weak areas recorded.</p>";
    const strengths=document.getElementById("interviewStrengths");
    if(strengths) strengths.innerHTML=(d.strengths||[]).map(x=>`<span class="tag">${escapeHtml(x)}</span>`).join("")||"<p>Keep building consistency across your answers.</p>";
    loadInterviewHistory();
    refreshDashboard();
    if(attentionEnabled) stopAttentionMode();
}

function resetInterview(){
    interviewState.active=false;
    stopInterviewVoiceInput();
    stopRapidFireTimer();
    document.getElementById("interviewSetup")?.classList.remove("session-running");
    document.getElementById("interviewContainer")?.classList.add("hidden");
    document.getElementById("interviewResult")?.classList.add("hidden");
    document.getElementById("interviewSetup")?.classList.remove("hidden");
    if(attentionEnabled) stopAttentionMode();
}

function toggleInterviewVoiceInput(){
    if(interviewRecognition){
        stopInterviewVoiceInput();
        return;
    }
    const SpeechRecognition=window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRecognition){
        document.getElementById("interviewVoiceStatus").textContent="Speech recognition is not supported by this browser.";
        return;
    }
    const recognitionInstance=new SpeechRecognition();
    recognitionInstance.lang="en-US";
    recognitionInstance.continuous=true;
    recognitionInstance.interimResults=false;
    interviewRecognition=recognitionInstance;
    const button=document.getElementById("interviewVoiceToggle");
    const status=document.getElementById("interviewVoiceStatus");
    recognitionInstance.onstart=()=>{
        if(button){button.textContent="⏹ Stop Speaking";button.classList.add("listening");}
        if(status) status.textContent="Listening… speak your answer, then stop recording.";
    };
    recognitionInstance.onresult=event=>{
        const spoken=Array.from(event.results).slice(event.resultIndex)
            .filter(result=>result.isFinal)
            .map(result=>result[0].transcript.trim()).filter(Boolean).join(" ");
        if(spoken){
            const answer=document.getElementById("interviewAnswer");
            answer.value=`${answer.value.trim()} ${spoken}`.trim();
            answer.dispatchEvent(new Event("input",{bubbles:true}));
        }
    };
    recognitionInstance.onerror=event=>{
        if(status) status.textContent=event.error==="not-allowed" ? "Microphone permission is required for verbal answers." : "Speech capture failed. Please try again.";
    };
    recognitionInstance.onend=()=>{
        if(interviewRecognition===recognitionInstance) interviewRecognition=null;
        if(button){button.textContent="🎙 Start Speaking";button.classList.remove("listening");}
        if(status && !status.textContent.startsWith("Microphone permission")) status.textContent= document.getElementById("interviewAnswer").value.trim() ? "Transcript ready. Review it, then submit your answer." : "No speech captured. Click Start Speaking to try again.";
    };
    try{recognitionInstance.start();}
    catch(error){
        interviewRecognition=null;
        if(button){button.textContent="🎙 Start Speaking";button.classList.remove("listening");}
        if(status) status.textContent="Unable to start speech capture. Please try again.";
    }
}

function stopInterviewVoiceInput(){
    const activeRecognition=interviewRecognition;
    interviewRecognition=null;
    if(activeRecognition){
        try{activeRecognition.stop();}catch(error){}
    }
    const button=document.getElementById("interviewVoiceToggle");
    if(button){button.textContent="🎙 Start Speaking";button.classList.remove("listening");}
}

function speakInterviewQuestion(){speakText(document.getElementById("interviewQuestion")?.textContent||"");}

async function loadInterviewHistory(){
    const box=document.getElementById("interviewHistory");
    if(!box)return;
    try{
        const r=await fetch("/api/interview/history");
        const d=await parseJsonResponse(r);
        if(!r.ok) throw new Error(d.error||"Unable to load history.");
        box.innerHTML=d.length?d.map(x=>`<div class="history-row"><strong>${escapeHtml(x.interview_type)}</strong><span>${x.score}/10 • Technical ${x.technical}/10 • ${escapeHtml(x.difficulty)} • ${escapeHtml(x.mode)}</span><small>${new Date(x.created_at).toLocaleString()}</small></div>`).join(""):"<p class='muted-text'>No interviews completed yet.</p>";
    }catch(e){
        box.innerHTML="<p class='muted-text'>Unable to load interview history.</p>";
    }
}

/* ============================================================
   CAMERA ATTENTION MODE — optional, local browser processing
   ============================================================ */

async function toggleAttentionMode(silent=false) {
    if (attentionEnabled) {
        if (interviewState?.active) {
            if(!silent) alert("Camera attention must stay on until you finish or exit the interview.");
            return false;
        }
        stopAttentionMode();
        return true;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
        if(!silent) alert("Camera access is not supported by this browser.");
        return false;
    }
    if (typeof FaceMesh === "undefined") {
        if(!silent) alert("The attention model could not be loaded. Please check your internet connection and reload the page.");
        return false;
    }

    try {
        attentionVideo = document.getElementById("attentionVideo");
        attentionStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false
        });
        attentionVideo.srcObject = attentionStream;
        await attentionVideo.play();
        attentionEnabled = true;
        document.getElementById("attentionPanel")?.classList.remove("hidden");
        document.getElementById("attentionState").textContent = "Monitoring attention…";
        updateAttentionButtons();

        attentionFaceMesh = new FaceMesh({
            locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });
        attentionFaceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7
        });
        attentionFaceMesh.onResults(handleAttentionResults);
        attentionLoop();
        return true;
    } catch (error) {
        console.error(error);
        stopAttentionMode();
        if(!silent) alert("Camera permission was not granted or the camera could not be started.");
        return false;
    }
}

async function attentionLoop() {
    if (!attentionEnabled || !attentionVideo || !attentionFaceMesh) return;
    const now = performance.now();
    if (now - lastFaceCheck > 90 && attentionVideo.readyState >= 2) {
        lastFaceCheck = now;
        try { await attentionFaceMesh.send({ image: attentionVideo }); } catch (error) { console.warn(error); }
    }
    attentionLoopId = requestAnimationFrame(attentionLoop);
}

function handleAttentionResults(results) {
    if (!attentionEnabled) return;
    const landmarks = results.multiFaceLandmarks?.[0];
    if (!landmarks) {
        markAttentionAway("Face not detected. Please face the screen.");
        return;
    }

    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const nose = landmarks[1];
    const forehead = landmarks[10];
    const chin = landmarks[152];
    const eyeDistance = Math.max(Math.abs(rightEye.x - leftEye.x), 0.001);
    const faceHeight = Math.max(Math.abs(chin.y - forehead.y), 0.001);
    const eyeCenterX = (leftEye.x + rightEye.x) / 2;
    const faceCenterY = (forehead.y + chin.y) / 2;

    const yaw = Math.abs((nose.x - eyeCenterX) / eyeDistance);
    const pitch = Math.abs((nose.y - faceCenterY) / faceHeight);
    const lookingAway = yaw > 0.18 || pitch > 0.155;

    if (lookingAway) markAttentionAway("Please focus on the screen.");
    else markAttentionFocused();
}

function updateAttentionLock() {
    const locked = attentionWarningShown;
    document.querySelectorAll("#answerOptions .answer-option").forEach(button => {
        button.disabled = locked;
    });
    const next = document.getElementById("nextQuestionButton");
    if (next) next.disabled = locked;
    const interviewSubmit = document.getElementById("submitInterviewAnswer");
    if (interviewSubmit) interviewSubmit.disabled = locked;
}

function markAttentionAway(message) {
    if (!awaySince) awaySince = performance.now();
    focusedSince = null;
    const elapsed = performance.now() - awaySince;
    if (elapsed > 650 && !attentionWarningShown) {
        attentionWarningShown = true;
        const warning = document.getElementById("attentionWarning");
        warning.textContent = `⚠ ${message}`;
        warning.classList.remove("hidden");
        document.getElementById("attentionState").textContent = "Attention warning";
        updateAttentionLock();
    }
}

function markAttentionFocused() {
    awaySince = null;
    if (!focusedSince) focusedSince = performance.now();
    if (attentionWarningShown && performance.now() - focusedSince > 350) {
        attentionWarningShown = false;
        document.getElementById("attentionWarning")?.classList.add("hidden");
        document.getElementById("attentionState").textContent = "Focused ✓";
        updateAttentionLock();
    }
}

function stopAttentionMode() {
    attentionEnabled = false;
    if (attentionLoopId) cancelAnimationFrame(attentionLoopId);
    attentionLoopId = null;
    if (attentionStream) attentionStream.getTracks().forEach(track => track.stop());
    attentionStream = null;
    if (attentionVideo) attentionVideo.srcObject = null;
    attentionFaceMesh = null;
    awaySince = null;
    focusedSince = null;
    attentionWarningShown = false;
    document.getElementById("attentionPanel")?.classList.add("hidden");
    document.getElementById("attentionWarning")?.classList.add("hidden");
    const state = document.getElementById("attentionState");
    if (state) state.textContent = "Camera is off";
    updateAttentionButtons();
    updateAttentionLock();
}

function updateAttentionButtons() {
    ["quizCameraToggle", "interviewCameraToggle"].forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            button.textContent = `Camera Attention: ${attentionEnabled ? "ON" : "OFF"}`;
            button.disabled = id === "interviewCameraToggle" && Boolean(interviewState?.active);
        }
    });
}

async function submitFeedback(){const message=document.getElementById("feedbackMessage")?.value.trim();const rating=Number(document.getElementById("feedbackRating")?.value||5);if(!message){alert("Please enter your feedback.");return;}const r=await fetch("/api/feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rating,message})});const d=await r.json();document.getElementById("feedbackStatus").textContent=d.message||d.error||"Submitted.";if(r.ok)document.getElementById("feedbackMessage").value="";}

function initializeSectionFeedback() {
    document.querySelectorAll("main .page:not(#feedback)").forEach(page => {
        const title = page.querySelector(".page-header h2, .page-title h2")?.textContent
            .replace(/\s+/g, " ").trim() || page.id;
        const panel = document.createElement("aside");
        panel.className = "section-feedback";
        panel.innerHTML = `
            <div class="section-feedback-copy">
                <strong>How was ${escapeHtml(title)}?</strong>
                <span class="section-feedback-prompt">Choose a rating to share your experience.</span>
            </div>
            <div class="section-feedback-actions">
                <button type="button" data-rating="1" aria-label="Rate ${escapeHtml(title)} 1 out of 5">😞</button>
                <button type="button" data-rating="2" aria-label="Rate ${escapeHtml(title)} 2 out of 5">🙁</button>
                <button type="button" data-rating="3" aria-label="Rate ${escapeHtml(title)} 3 out of 5">😐</button>
                <button type="button" data-rating="4" aria-label="Rate ${escapeHtml(title)} 4 out of 5">🙂</button>
                <button type="button" data-rating="5" aria-label="Rate ${escapeHtml(title)} 5 out of 5">😄</button>
            </div>
            <div class="section-feedback-followup hidden">
                <label class="section-feedback-comment">
                    <span class="sr-only">Optional details</span>
                    <input type="text" maxlength="500" placeholder="What could make it better? (optional)">
                </label>
                <button type="button" class="section-feedback-submit">Send feedback</button>
            </div>
            <p class="section-feedback-status" role="status" aria-live="polite"></p>`;
        page.append(panel);

        let chosenRating = 0;
        const followup = panel.querySelector(".section-feedback-followup");
        panel.querySelectorAll("button[data-rating]").forEach(button => {
            button.addEventListener("click", () => {
                chosenRating = Number(button.dataset.rating);
                panel.querySelectorAll("button[data-rating]").forEach(item => {
                    item.classList.toggle("selected", item === button);
                    item.setAttribute("aria-pressed", item === button ? "true" : "false");
                });
                panel.querySelector(".section-feedback-prompt").textContent =
                    ["Sorry it missed the mark.", "Thanks for letting us know.", "Thanks! What would improve it?", "Glad it helped! Any suggestions?", "Great to hear! Want to add a note?"][chosenRating - 1];
                followup.classList.remove("hidden");
                panel.querySelector(".section-feedback-comment input").focus();
            });
        });

        panel.querySelector(".section-feedback-submit").addEventListener("click", async () => {
            if (!chosenRating) return;
            const status = panel.querySelector(".section-feedback-status");
            const comment = panel.querySelector("input").value.trim();
            const message = `Section feedback for ${title}.${comment ? ` Comment: ${comment}` : ""}`;
            panel.querySelectorAll("button").forEach(item => item.disabled = true);
            status.textContent = "Sending…";
            try {
                const response = await fetch("/api/feedback", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rating: chosenRating, message })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Unable to send feedback.");
                status.textContent = data.message || "Thank you for your feedback!";
                panel.querySelector(".section-feedback-prompt").textContent = "Your rating has been recorded.";
            } catch (error) {
                status.textContent = error.message || "Unable to send feedback. Please try again.";
                panel.querySelectorAll("button").forEach(item => item.disabled = false);
            }
        });
    });
}

/* ============================================================
   POPUP
   ============================================================ */

function showPopup() { document.getElementById("messagePopup")?.classList.remove("hidden"); }
function closePopup() { document.getElementById("messagePopup")?.classList.add("hidden"); }
