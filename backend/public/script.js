const tabButtons = document.querySelectorAll(".tab-button");
const forms = document.querySelectorAll(".form");
const statusBox = document.getElementById("status");
const resultTitle = document.getElementById("result-title");
const resultCopy = document.getElementById("result-copy");
const predictionBox = document.getElementById("predictionResult");
const serviceArea = document.getElementById("serviceArea");
const lockedNotice = document.getElementById("lockedNotice");
const predictionBadge = document.getElementById("predictionBadge");
const predictionTitle = document.getElementById("predictionTitle");
const predictionCopy = document.getElementById("predictionCopy");
const predictionSuggestion = document.getElementById("predictionSuggestion");
const predictionChatbotLink = document.getElementById("predictionChatbotLink");
const predictForm = document.getElementById("predictForm");
const chatbotForm = document.getElementById("chatbotForm");
const chatbotInput = document.getElementById("chatbotInput");
const chatbotMessages = document.getElementById("chatbotMessages");
const chatbotShortcuts = document.querySelector(".chatbot-shortcuts");
const chatbotContextTitle = document.getElementById("chatbotContextTitle");
const chatbotContextCopy = document.getElementById("chatbotContextCopy");
const chatbotStatusPill = document.getElementById("chatbotStatusPill");

const defaultChatPrompts = [
    "What breakfast is diabetes-friendly?",
    "How can I lower my diabetes risk?",
    "Explain HbA1c in simple words",
    "Give me a 7-day walking plan",
    "Help me write a professional email",
    "Explain photosynthesis simply"
];

let latestPredictionContext = null;
let chatbotConversation = [];

function setAccessState(isLoggedIn) {
    document.body.classList.toggle("auth-locked", !isLoggedIn);
    document.body.classList.toggle("auth-ready", isLoggedIn);

    if (serviceArea) {
        serviceArea.setAttribute("aria-hidden", isLoggedIn ? "false" : "true");
    }

    if (lockedNotice) {
        lockedNotice.setAttribute("aria-hidden", isLoggedIn ? "true" : "false");
    }

    if (isLoggedIn) {
        setChatbotStatus("Ready to guide", "success");
        seedChatbotIntro();
    } else {
        setChatbotStatus("Login to unlock", "info");
        resetPredictionState();
        resetChatbotExperience();
    }
}

function setStatus(message, tone = "info") {
    if (!statusBox) {
        return;
    }

    statusBox.textContent = message;
    statusBox.dataset.tone = tone;
}

function setResult(title, copy) {
    if (!resultTitle || !resultCopy) {
        return;
    }

    resultTitle.textContent = title;
    resultCopy.textContent = copy;
}

function setPredictionMessage({ badge = "GS", title, copy, suggestion, tone = "info" }) {
    if (!predictionBox || !predictionBadge || !predictionTitle || !predictionCopy || !predictionSuggestion || !predictionChatbotLink) {
        return;
    }

    predictionBox.dataset.tone = tone;
    predictionBadge.dataset.tone = tone;
    predictionBadge.textContent = badge;
    predictionTitle.textContent = title;
    predictionCopy.textContent = copy;
    predictionSuggestion.textContent = suggestion;

    if (tone === "error") {
        predictionChatbotLink.textContent = "Open Chatbot for Higher-Risk Tips";
    } else if (tone === "success") {
        predictionChatbotLink.textContent = "Open Chatbot for Prevention Tips";
    } else {
        predictionChatbotLink.textContent = "Open Chatbot";
    }
}

function setChatbotStatus(message, tone = "info") {
    if (!chatbotStatusPill) {
        return;
    }

    chatbotStatusPill.textContent = message;
    chatbotStatusPill.dataset.tone = tone;
}

function setChatbotContext(title, copy) {
    if (!chatbotContextTitle || !chatbotContextCopy) {
        return;
    }

    chatbotContextTitle.textContent = title;
    chatbotContextCopy.textContent = copy;
}

function buildResultSummary(url, data, response) {
    const userName = data?.user?.name;

    if (!response.ok) {
        return {
            title: "Action needs attention",
            copy: data?.message || "Something went wrong while talking to the server."
        };
    }

    if (url === "/register") {
        return {
            title: userName ? `Welcome, ${userName}` : "Account created",
            copy: "Your GlucoSense AI workspace is ready and your secure diabetes support session has started."
        };
    }

    if (url === "/login") {
        return {
            title: userName ? `Welcome back, ${userName}` : "Signed in successfully",
            copy: "You are now inside GlucoSense AI and can continue with profile access, prediction tools, and GlucoGuide coaching."
        };
    }

    if (url === "/profile") {
        return {
            title: userName ? `${userName}'s profile loaded` : "Profile loaded",
            copy: data?.user?.email ? `Signed in with ${data.user.email}. Your GlucoSense AI account connection is active.` : "Your account details were fetched successfully."
        };
    }

    if (url === "/logout") {
        return {
            title: "Session closed",
            copy: "You have been logged out safely. Sign in again whenever you want to continue using GlucoSense AI."
        };
    }

    if (url === "/forgot-password") {
        return {
            title: "Password updated",
            copy: "Your password has been reset. Use the login tab and sign in with the new password."
        };
    }

    return {
        title: "Request completed",
        copy: data?.message || "The action completed successfully."
    };
}

function switchTab(tabName) {
    tabButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.tab === tabName);
    });

    forms.forEach((form) => {
        form.classList.toggle("active", form.id === `${tabName}-form`);
    });
}

const CHAT_SECTION_HEADER_PATTERN = /^[A-Za-z][A-Za-z0-9\s/&()+-]{1,48}:$/;

function isBulletLine(line) {
    return /^[-*\u2022]\s+/.test(line);
}

function isNumberedLine(line) {
    return /^\d+\.\s+/.test(line);
}

function stripListMarker(line) {
    return line
        .replace(/^[-*\u2022]\s+/, "")
        .replace(/^\d+\.\s+/, "")
        .trim();
}

function appendMessageText(container, text, className = "chat-message-text") {
    const element = document.createElement("p");
    element.className = className;
    element.textContent = text;
    container.append(element);
}

function renderChatMessageContent(container, message) {
    container.innerHTML = "";

    const normalizedMessage = String(message || "").replace(/\r/g, "").trim();
    if (!normalizedMessage) {
        return;
    }

    const blocks = normalizedMessage
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean);

    blocks.forEach((block) => {
        const lines = block
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

        let activeList = null;
        let activeListType = "";

        const flushList = () => {
            activeList = null;
            activeListType = "";
        };

        lines.forEach((line) => {
            const nextListType = isBulletLine(line) ? "ul" : isNumberedLine(line) ? "ol" : "";

            if (CHAT_SECTION_HEADER_PATTERN.test(line)) {
                flushList();
                appendMessageText(container, line.slice(0, -1), "chat-message-section");
                return;
            }

            if (nextListType) {
                if (!activeList || activeListType !== nextListType) {
                    activeList = document.createElement(nextListType);
                    activeList.className = `chat-message-list ${nextListType === "ol" ? "ordered" : ""}`.trim();
                    activeListType = nextListType;
                    container.append(activeList);
                }

                const listItem = document.createElement("li");
                listItem.textContent = stripListMarker(line);
                activeList.append(listItem);
                return;
            }

            flushList();
            appendMessageText(container, line);
        });
    });
}

function appendChatMessage(role, message, label = "", persist = true) {
    if (!chatbotMessages) {
        return;
    }

    const article = document.createElement("article");
    article.className = `chat-message ${role}`;

    const meta = document.createElement("p");
    meta.className = "chat-message-meta";
    meta.textContent = label || (role === "assistant" ? "GlucoGuide Coach" : "You");

    const bubble = document.createElement("div");
    bubble.className = "chat-message-bubble";
    renderChatMessageContent(bubble, message);

    article.append(meta, bubble);
    chatbotMessages.append(article);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

    if (persist && (role === "user" || role === "assistant")) {
        chatbotConversation.push({
            role,
            content: message
        });
        chatbotConversation = chatbotConversation.slice(-10);
    }
}

function renderChatbotShortcuts(prompts = defaultChatPrompts) {
    if (!chatbotShortcuts) {
        return;
    }

    chatbotShortcuts.innerHTML = "";

    prompts.slice(0, 6).forEach((prompt) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chatbot-shortcut";
        button.dataset.prompt = prompt;
        button.textContent = prompt;
        chatbotShortcuts.append(button);
    });
}

function seedChatbotIntro() {
    if (!chatbotMessages || chatbotMessages.childElementCount > 0 || document.body.classList.contains("auth-locked")) {
        return;
    }

    appendChatMessage(
        "assistant",
        "How I can help:\n- Ask me general questions for study, writing, planning, or productivity.\n- Ask me diabetes-related questions for meals, movement, hydration, sleep, and prevention tips.\n- If you run a prediction first, I can use that latest screening context in my reply.",
        "GlucoGuide Coach",
        false
    );
}

function resetPredictionState() {
    latestPredictionContext = null;

    setPredictionMessage({
        badge: "GS",
        title: "Prediction result will appear here",
        copy: "Submit valid patient values to see the diabetes risk result along with the next suggested step.",
        suggestion: "After the result, users can continue to the chatbot area for diet and lifestyle guidance.",
        tone: "info"
    });

    setChatbotContext(
        "Waiting for your latest screening context",
        "Run a prediction to let the chatbot adapt its guidance around current diabetes risk signals."
    );
}

function resetChatbotExperience() {
    if (chatbotMessages) {
        chatbotMessages.innerHTML = "";
    }

    chatbotConversation = [];
    renderChatbotShortcuts(defaultChatPrompts);
}

function describePredictionContext(context) {
    if (!context) {
        return "No recent screening context is loaded yet.";
    }

    const signals = [];

    if (Number.isFinite(context.glucose) && context.glucose >= 140) {
        signals.push(`glucose ${context.glucose} mg/dL`);
    }

    if (Number.isFinite(context.bmi) && context.bmi >= 30) {
        signals.push(`BMI ${context.bmi}`);
    }

    if (Number.isFinite(context.age) && context.age >= 40) {
        signals.push(`age ${context.age}`);
    }

    if (!signals.length) {
        return context.riskLevel === "high"
            ? "Higher-risk screening context is loaded with no extra trigger notes."
            : "Lower-risk screening context is loaded for prevention-focused coaching.";
    }

    return `${context.riskLevel === "high" ? "Higher-risk" : "Lower-risk"} screening context loaded: ${signals.join(", ")}.`;
}

function updateChatbotFromPrediction(predictionValue, formValues) {
    latestPredictionContext = {
        riskLevel: predictionValue === 1 ? "high" : "low",
        glucose: Number(formValues.Glucose),
        bmi: Number(formValues.BMI),
        age: Number(formValues.Age)
    };

    if (predictionValue === 1) {
        setChatbotContext(
            "Higher-risk screening context loaded",
            "GlucoGuide will now prioritize blood-sugar-friendly meals, regular movement, and clinician follow-up questions around your latest result."
        );
    } else {
        setChatbotContext(
            "Lower-risk screening context loaded",
            "GlucoGuide will keep the conversation focused on prevention, meal balance, healthy routine design, and long-term risk reduction."
        );
    }

    seedChatbotIntro();
    appendChatMessage(
        "assistant",
        predictionValue === 1
            ? `Prediction sync:\n- Higher-risk screening context is now active.\n- Ask for meal ideas, exercise planning, or prevention-focused next steps.\n- ${describePredictionContext(latestPredictionContext)}`
            : `Prediction sync:\n- Lower-risk screening context is now active.\n- I can help you maintain that trend with food, movement, and daily routine support.\n- ${describePredictionContext(latestPredictionContext)}`,
        "Prediction Sync",
        false
    );
}

async function request(url, options = {}) {
    setStatus("Talking to the server...", "info");

    try {
        const response = await fetch(url, {
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            ...options
        });

        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
            ? await response.json()
            : { message: await response.text() };
        const summary = buildResultSummary(url, data, response);

        setResult(summary.title, summary.copy);
        setStatus(data.message || (response.ok ? "Success" : "Something went wrong"), response.ok ? "success" : "error");

        if (response.ok && (url === "/register" || url === "/login" || url === "/profile")) {
            setAccessState(true);
        }

        if (response.ok && url === "/logout") {
            setAccessState(false);
        }

        if (!response.ok && response.status === 401) {
            setAccessState(false);
        }

        return { response, data };
    } catch (error) {
        setResult("Connection issue", "The request could not be completed. Check whether the server is running and try again.");
        setStatus("The request could not be completed. Check the server connection.", "error");
        return null;
    }
}

async function syncAccessState() {
    const result = await request("/profile");

    if (!result || !result.response.ok) {
        setAccessState(false);
        setResult("No active session yet", "Log in to continue with early prediction, diabetes support, and your account workspace.");
        setStatus("Login required to unlock prediction, lifestyle support, and chatbot guidance.", "info");
    }
}

async function sendChatMessage(message) {
    if (!chatbotForm || !chatbotInput) {
        return;
    }

    const trimmedMessage = String(message || "").trim();
    if (!trimmedMessage) {
        return;
    }

    if (document.body.classList.contains("auth-locked")) {
        setStatus("Login required before using GlucoGuide Coach.", "error");
        return;
    }

    seedChatbotIntro();
    appendChatMessage("user", trimmedMessage, "You");
    setChatbotStatus("Thinking...", "info");
    chatbotInput.value = "";

    const submitButton = chatbotForm.querySelector("button[type='submit']");
    if (submitButton) {
        submitButton.disabled = true;
    }

    try {
        const response = await fetch("/chatbot", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: trimmedMessage,
                predictionContext: latestPredictionContext || {},
                conversation: chatbotConversation.slice(0, -1)
            })
        });

        const result = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                setAccessState(false);
            }

            appendChatMessage(
                "assistant",
                result.message || "The chatbot is unavailable right now. Please try again.",
                "Coach Status",
                false
            );
            setChatbotStatus("Connection issue", "error");
            return;
        }

        appendChatMessage("assistant", result.reply, result.brand || "GlucoGuide Coach");
        renderChatbotShortcuts(Array.isArray(result.suggestions) && result.suggestions.length ? result.suggestions : defaultChatPrompts);
        setChatbotStatus(
            result.mode === "openai" ? "AI mode active" : "Local coach mode",
            result.tone || "success"
        );
    } catch (error) {
        appendChatMessage(
            "assistant",
            "I couldn't reach the chatbot service. Check whether the backend is running, then try again.",
            "Coach Status",
            false
        );
        setChatbotStatus("Service unavailable", "error");
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
}

tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
});

document.getElementById("register-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await request("/register", {
        method: "POST",
        body: JSON.stringify({
            name: formData.get("name"),
            email: formData.get("email"),
            password: formData.get("password")
        })
    });
});

document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await request("/login", {
        method: "POST",
        body: JSON.stringify({
            email: formData.get("email"),
            password: formData.get("password")
        })
    });
});

document.getElementById("forgot-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const result = await request("/forgot-password", {
        method: "POST",
        body: JSON.stringify({
            email: formData.get("email"),
            password: formData.get("password"),
            confirmPassword: formData.get("confirmPassword")
        })
    });

    if (result?.response?.ok) {
        event.currentTarget.reset();
        switchTab("login");
    }
});

document.getElementById("profile-button").addEventListener("click", async () => {
    await request("/profile");
});

document.getElementById("logout-button").addEventListener("click", async () => {
    await request("/logout");
});

if (predictForm) {
    predictForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (document.body.classList.contains("auth-locked")) {
            setPredictionMessage({
                badge: "!",
                title: "Login required",
                copy: "Please log in first to use the diabetes prediction service.",
                suggestion: "After login, the chatbot section will also unlock for lifestyle and diet-related questions.",
                tone: "error"
            });
            setStatus("Login required before using prediction services.", "error");
            return;
        }

        if (!predictForm.reportValidity()) {
            setPredictionMessage({
                badge: "!",
                title: "Input needs attention",
                copy: "Please enter values only within the allowed range shown below each field.",
                suggestion: "Once the inputs are valid, the chatbot section can help with food, routine, and prevention-related questions.",
                tone: "error"
            });
            return;
        }

        const formData = new FormData(predictForm);
        const data = Object.fromEntries(formData.entries());

        try {
            setPredictionMessage({
                badge: "...",
                title: "Prediction in progress",
                copy: "Checking diabetes risk with the trained model and preparing the user guidance card.",
                suggestion: "After the result appears, users can continue to the chatbot section for lifestyle-related queries.",
                tone: "info"
            });

            const response = await fetch("/predict", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok || typeof result.prediction === "undefined") {
                if (response.status === 401) {
                    setAccessState(false);
                }

                setPredictionMessage({
                    badge: "!",
                    title: "Prediction request failed",
                    copy: result.error || "Please verify the backend and ML API connection, then try again.",
                    suggestion: "The chatbot area can still be used later for lifestyle, prevention, and diabetes-awareness questions.",
                    tone: "error"
                });
                return;
            }

            if (result.prediction === 1) {
                setPredictionMessage({
                    badge: "!",
                    title: "High risk detected",
                    copy: "The model indicates a higher diabetes risk for the current patient values. Review this result carefully and consider medical follow-up.",
                    suggestion: "Use GlucoGuide Coach next to ask about low-sugar meals, daily activity, sleep habits, and prevention-focused lifestyle changes.",
                    tone: "error"
                });
            } else {
                setPredictionMessage({
                    badge: "+",
                    title: "Low risk indicated",
                    copy: "The model indicates a lower diabetes risk for the current patient values. Continue healthy monitoring and prevention-focused habits.",
                    suggestion: "Open GlucoGuide Coach for meal ideas, exercise routines, hydration habits, and sustainable daily prevention tips.",
                    tone: "success"
                });
            }

            updateChatbotFromPrediction(result.prediction, {
                Glucose: Number(data.Glucose),
                BMI: Number(data.BMI),
                Age: Number(data.Age)
            });
            setStatus("Prediction completed. GlucoGuide Coach has been updated with the latest screening context.", "success");
        } catch (error) {
            setPredictionMessage({
                badge: "!",
                title: "Service unavailable",
                copy: "Prediction service is not reachable right now. Check whether both backend and ML API are running.",
                suggestion: "Once the service is back, the chatbot area can support users with lifestyle and diabetes-related follow-up queries.",
                tone: "error"
            });
        }
    });
}

if (chatbotForm) {
    chatbotForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await sendChatMessage(chatbotInput.value);
    });
}

if (chatbotShortcuts) {
    chatbotShortcuts.addEventListener("click", async (event) => {
        const shortcut = event.target.closest(".chatbot-shortcut");
        if (!shortcut) {
            return;
        }

        await sendChatMessage(shortcut.dataset.prompt || shortcut.textContent);
    });
}

renderChatbotShortcuts(defaultChatPrompts);
resetPredictionState();
setAccessState(false);
syncAccessState();
