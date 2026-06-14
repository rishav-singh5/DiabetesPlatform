const tabButtons = document.querySelectorAll(".tab-button");
const forms = document.querySelectorAll(".form");
const statusBox = document.getElementById("status");
const resultTitle = document.getElementById("result-title");
const resultCopy = document.getElementById("result-copy");
const predictionBox = document.getElementById("predictionResult");
const serviceArea = document.getElementById("serviceArea");
const lockedNotice = document.getElementById("lockedNotice");
const paymentNotice = document.getElementById("paymentNotice");
const paymentButton = document.getElementById("payment-button");
const paymentStatus = document.getElementById("payment-status");
const predictionBadge = document.getElementById("predictionBadge");
const predictionTitle = document.getElementById("predictionTitle");
const predictionCopy = document.getElementById("predictionCopy");
const predictionSuggestion = document.getElementById("predictionSuggestion");
const predictionChatbotLink = document.getElementById("predictionChatbotLink");
const predictForm = document.getElementById("predictForm");
const assessmentSteps = document.querySelectorAll(".wizard-step");
const assessmentBack = document.getElementById("assessmentBack");
const assessmentNext = document.getElementById("assessmentNext");
const assessmentSubmit = document.getElementById("assessmentSubmit");
const assessmentStepLabel = document.getElementById("assessmentStepLabel");
const assessmentProgressBar = document.getElementById("assessmentProgressBar");
const assessmentHint = document.getElementById("assessmentHint");
const riskMeter = document.getElementById("riskMeter");
const driverList = document.getElementById("driverList");
const chatbotForm = document.getElementById("chatbotForm");
const chatbotInput = document.getElementById("chatbotInput");
const chatbotMessages = document.getElementById("chatbotMessages");
const chatbotShortcuts = document.querySelector(".chatbot-shortcuts");
const chatbotContextTitle = document.getElementById("chatbotContextTitle");
const chatbotContextCopy = document.getElementById("chatbotContextCopy");
const chatbotStatusPill = document.getElementById("chatbotStatusPill");
const hamburgerBtn = document.getElementById("hamburgerBtn");
const mobileNavOverlay = document.getElementById("mobileNavOverlay");

document.querySelectorAll('.site-nav-links a[href="#paymentNotice"]').forEach((link) => {
    link.remove();
});

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
let userHasPaid = false;
let paymentInProgress = false;
let currentAssessmentStep = 0;

const modelFieldNames = [
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "Age"
];

const rangeDisplayUnits = {
    Age: " years",
    BMI: "",
    Glucose: " mg/dL",
    BloodPressure: " mmHg",
    Pregnancies: "",
    SkinThickness: " mm",
    Insulin: " mu U/ml"
};

const assessmentHints = [
    "Knowing your risk is the first smart step.",
    "BMI is one signal, not a judgment. You are not your numbers.",
    "Use a recent fasting glucose value if you have one.",
    "Blood pressure can change through the day, so trends matter.",
    "Select 0 when this question does not apply.",
    "This model uses classic clinical dataset fields.",
    "If insulin is unknown, keep the default and discuss uncertainty with a provider.",
    "Family history helps frame the conversation with your doctor.",
    "Small, repeatable movement habits can lower long-term risk."
];

function isMobilePaymentDevice() {
    return window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
}

function setAccessState(isLoggedIn, hasPaid = false) {
    userHasPaid = Boolean(isLoggedIn && hasPaid);
    document.body.classList.toggle("auth-locked", !isLoggedIn);
    document.body.classList.toggle("auth-ready", isLoggedIn);
    document.body.classList.toggle("payment-locked", Boolean(isLoggedIn && !hasPaid));
    document.body.classList.toggle("payment-ready", Boolean(isLoggedIn && hasPaid));

    if (serviceArea) {
        serviceArea.setAttribute("aria-hidden", userHasPaid ? "false" : "true");
    }

    if (lockedNotice) {
        lockedNotice.setAttribute("aria-hidden", isLoggedIn ? "true" : "false");
    }

    if (paymentNotice) {
        paymentNotice.setAttribute("aria-hidden", isLoggedIn && !hasPaid ? "false" : "true");
    }

    if (paymentStatus) {
        paymentStatus.textContent = !isLoggedIn
            ? "Login required"
            : hasPaid
                ? "Payment verified"
                : "Payment required";
    }

    if (isLoggedIn && hasPaid) {
        setChatbotStatus("Ready to guide", "success");
        seedChatbotIntro();
    } else if (isLoggedIn) {
        setChatbotStatus("Payment required", "info");
        resetPredictionState();
        resetChatbotExperience();
    } else {
        setChatbotStatus("Login to unlock", "info");
        resetPredictionState();
        resetChatbotExperience();
    }
}

function showPaymentPrompt({ autoStart = false } = {}) {
    if (!paymentNotice) {
        return;
    }

    setResult(
        "Payment required",
        "Login successful. Please complete the one-time Rs 10 payment to unlock prediction and GlucoGuide Coach."
    );
    setStatus("Payment required: click Pay Rs 10 to continue.", "info");

    window.setTimeout(() => {
        paymentNotice.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        if (paymentButton) {
            paymentButton.focus({ preventScroll: true });
        }

        if (autoStart && !paymentInProgress) {
            startPayment();
        }
    }, 120);
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

function setPredictionMessage({ badge = "GS", title, copy, suggestion, tone = "info", riskPercent = 0, drivers = [] }) {
    if (!predictionBox || !predictionBadge || !predictionTitle || !predictionCopy || !predictionSuggestion || !predictionChatbotLink) {
        return;
    }

    predictionBox.dataset.tone = tone;
    predictionBadge.dataset.tone = tone;
    predictionBadge.textContent = badge;
    predictionTitle.textContent = title;
    predictionCopy.textContent = copy;
    predictionSuggestion.textContent = suggestion;

    if (riskMeter) {
        const meterFill = riskMeter.querySelector("span");
        if (meterFill) {
            meterFill.style.width = `${Math.max(0, Math.min(100, Number(riskPercent) || 0))}%`;
        }
    }

    if (driverList) {
        driverList.innerHTML = "";
        drivers.slice(0, 5).forEach((driver) => {
            const chip = document.createElement("span");
            chip.textContent = driver;
            driverList.append(chip);
        });
    }

    if (tone === "error") {
        predictionChatbotLink.textContent = "Open Chatbot for Provider Questions";
    } else if (tone === "warning") {
        predictionChatbotLink.textContent = "Open Chatbot for Prevention Tips";
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

function formatRangeValue(input) {
    const numericValue = Number(input.value);
    const value = input.step === "0.1" ? numericValue.toFixed(1) : String(Math.round(numericValue));
    return `${value}${rangeDisplayUnits[input.name] || ""}`;
}

function updateRangeOutput(input) {
    const output = document.querySelector(`[data-output-for="${input.name}"]`);
    if (!output) {
        return;
    }

    const formattedValue = formatRangeValue(input);
    output.textContent = formattedValue;
    output.classList.add("is-updating");
    window.setTimeout(() => output.classList.remove("is-updating"), 140);
    input.setAttribute("aria-label", `${input.closest(".prediction-field")?.querySelector("span")?.textContent || input.name} slider, currently ${formattedValue}`);
}

function getAssessmentFormValues() {
    if (!predictForm) {
        return {};
    }

    const formData = new FormData(predictForm);
    return Object.fromEntries(formData.entries());
}

function getNumericFormValue(values, key) {
    const numericValue = Number(values[key]);
    return Number.isFinite(numericValue) ? numericValue : 0;
}

function buildRiskDrivers(values = {}) {
    const drivers = [];
    const age = getNumericFormValue(values, "Age");
    const bmi = getNumericFormValue(values, "BMI");
    const glucose = getNumericFormValue(values, "Glucose");
    const pressure = getNumericFormValue(values, "BloodPressure");
    const insulin = getNumericFormValue(values, "Insulin");
    const familyHistory = values.FamilyHistory;
    const activityLevel = values.ActivityLevel;

    if (glucose >= 140) drivers.push("Higher glucose");
    if (bmi >= 30) drivers.push("BMI above 30");
    if (age >= 45) drivers.push("Age");
    if (pressure >= 90) drivers.push("Blood pressure");
    if (familyHistory === "yes") drivers.push("Family history");
    if (activityLevel === "low") drivers.push("Low activity");
    if (insulin >= 200) drivers.push("Insulin signal");

    return drivers.length ? drivers : ["Balanced profile", "Prevention habits"];
}

function estimateRiskPercent(predictionValue, values = {}) {
    let risk = predictionValue === 1 ? 62 : 12;
    const age = getNumericFormValue(values, "Age");
    const bmi = getNumericFormValue(values, "BMI");
    const glucose = getNumericFormValue(values, "Glucose");
    const pressure = getNumericFormValue(values, "BloodPressure");

    if (glucose >= 140) risk += 10;
    if (glucose >= 180) risk += 8;
    if (bmi >= 30) risk += 7;
    if (bmi >= 35) risk += 5;
    if (age >= 45) risk += 5;
    if (age >= 60) risk += 4;
    if (pressure >= 90) risk += 4;
    if (values.FamilyHistory === "yes") risk += 6;
    if (values.ActivityLevel === "low") risk += 5;
    if (values.ActivityLevel === "high") risk -= 3;

    return Math.max(4, Math.min(92, Math.round(risk)));
}

function getRiskTone(riskPercent, predictionValue) {
    if (predictionValue === 1 || riskPercent >= 50) {
        return "error";
    }

    if (riskPercent >= 22) {
        return "warning";
    }

    return "success";
}

function getRiskCopy(tone, riskPercent, drivers = []) {
    const driverText = drivers.length ? ` Main factors: ${drivers.slice(0, 3).join(" + ")}.` : "";

    if (tone === "error") {
        return {
            badge: "!",
            title: `Worth discussing with a provider - ${riskPercent}% estimated risk`,
            copy: `Your profile suggests a higher-risk pattern. This is not a diagnosis, but it is worth bringing to a clinician for proper testing.${driverText}`,
            suggestion: "Ask about fasting glucose, HbA1c, blood pressure, weight trends, and what changes are realistic for you."
        };
    }

    if (tone === "warning") {
        return {
            badge: "~",
            title: `Some factors need attention - ${riskPercent}% estimated risk`,
            copy: `Your profile suggests moderate risk signals. Small changes can help, especially around movement, meal balance, sleep, and follow-up testing.${driverText}`,
            suggestion: "Consider a prevention plan and discuss whether HbA1c or fasting glucose testing makes sense."
        };
    }

    return {
        badge: "+",
        title: `Low short-term risk pattern - ${riskPercent}% estimated risk`,
        copy: `Your profile suggests lower short-term risk. Keep it up, and continue habits that protect long-term glucose health.${driverText}`,
        suggestion: "Stay on track with regular movement, fiber-rich meals, sleep, and routine checkups."
    };
}

function updateAssessmentStep() {
    if (!assessmentSteps.length) {
        return;
    }

    assessmentSteps.forEach((step, index) => {
        step.classList.toggle("active", index === currentAssessmentStep);
    });

    const totalSteps = assessmentSteps.length;
    const progress = ((currentAssessmentStep + 1) / totalSteps) * 100;

    if (assessmentStepLabel) {
        assessmentStepLabel.textContent = `Step ${currentAssessmentStep + 1} of ${totalSteps}`;
    }

    if (assessmentProgressBar) {
        assessmentProgressBar.style.width = `${progress}%`;
    }

    if (assessmentHint) {
        assessmentHint.textContent = assessmentHints[currentAssessmentStep] || "This tool learns from population data - your doctor knows you best.";
    }

    if (assessmentBack) {
        assessmentBack.style.display = currentAssessmentStep === 0 ? "none" : "inline-flex";
    }

    if (assessmentNext) {
        assessmentNext.style.display = currentAssessmentStep === totalSteps - 1 ? "none" : "inline-flex";
    }

    if (assessmentSubmit) {
        assessmentSubmit.style.display = currentAssessmentStep === totalSteps - 1 ? "inline-flex" : "none";
    }
}

function getCurrentStepControl() {
    const step = assessmentSteps[currentAssessmentStep];
    if (!step) {
        return null;
    }

    return step.querySelector("input, textarea, button");
}

function focusCurrentAssessmentControl() {
    const control = getCurrentStepControl();
    if (control) {
        control.focus({ preventScroll: true });
    }
}

function initializeAssessmentWizard() {
    if (!predictForm || !assessmentSteps.length) {
        return;
    }

    predictForm.querySelectorAll('input[type="range"]').forEach((input) => {
        updateRangeOutput(input);
        input.addEventListener("input", () => updateRangeOutput(input));
    });

    if (assessmentBack) {
        assessmentBack.addEventListener("click", () => {
            currentAssessmentStep = Math.max(0, currentAssessmentStep - 1);
            updateAssessmentStep();
            focusCurrentAssessmentControl();
        });
    }

    if (assessmentNext) {
        assessmentNext.addEventListener("click", () => {
            currentAssessmentStep = Math.min(assessmentSteps.length - 1, currentAssessmentStep + 1);
            updateAssessmentStep();
            focusCurrentAssessmentControl();
        });
    }

    updateAssessmentStep();
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
        title: "Your assessment summary will appear here",
        copy: "Complete the short guided flow to see an estimated risk result and doctor-friendly next steps.",
        suggestion: "This is for research and awareness, not a medical diagnosis.",
        tone: "info",
        riskPercent: 0,
        drivers: []
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

function updateChatbotFromPrediction(predictionValue, formValues, riskPercent = null) {
    latestPredictionContext = {
        riskLevel: predictionValue === 1 ? "high" : "low",
        glucose: Number(formValues.Glucose),
        bmi: Number(formValues.BMI),
        age: Number(formValues.Age),
        riskPercent
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
            const hasPaid = Boolean(data?.user?.hasPaid);
            setAccessState(true, hasPaid);

            if ((url === "/register" || url === "/login") && !hasPaid) {
                showPaymentPrompt({ autoStart: true });
            }
        }

        if (response.ok && url === "/logout") {
            setAccessState(false, false);
        }

        if (!response.ok && response.status === 401) {
            setAccessState(false, false);
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
        setAccessState(false, false);
        setResult("No active session yet", "Log in to continue with early prediction, diabetes support, and your account workspace.");
        setStatus("Login required to unlock prediction, lifestyle support, and chatbot guidance.", "info");
    }
}

async function startPayment() {
    if (!paymentButton) {
        return;
    }

    if (paymentInProgress) {
        return;
    }

    if (document.body.classList.contains("auth-locked")) {
        setStatus("Please login before payment.", "error");
        return;
    }

    paymentInProgress = true;
    paymentButton.disabled = true;
    paymentStatus.textContent = "Creating payment order...";

    try {
        const response = await fetch("/payment/create-order", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            }
        });
        const order = await response.json();

        if (!response.ok) {
            paymentStatus.textContent = order.message || "Payment order failed";
            setStatus(order.message || "Payment order failed.", "error");
            return;
        }

        if (order.alreadyPaid) {
            setAccessState(true, true);
            setStatus("Payment already verified. Services are unlocked.", "success");
            return;
        }

        if (!window.Razorpay) {
            paymentStatus.textContent = "Razorpay checkout script unavailable";
            setStatus("Razorpay checkout could not load. Check network and try again.", "error");
            return;
        }

        const isMobileDevice = isMobilePaymentDevice();
        const checkout = new window.Razorpay({
            key: order.razorpayKeyId,
            amount: order.amount,
            currency: order.currency,
            name: "GlucoSense AI",
            description: "Premium access for prediction and chatbot",
            order_id: order.orderId,
            method: {
                upi: true,
                card: true,
                netbanking: true,
                wallet: true
            },
            config: {
                display: {
                    blocks: {
                        upi: {
                            name: isMobileDevice ? "Pay by UPI app" : "Pay by UPI",
                            instruments: [
                                {
                                    method: "upi"
                                }
                            ]
                        },
                        other: {
                            name: "Other payment methods",
                            instruments: [
                                {
                                    method: "card"
                                },
                                {
                                    method: "netbanking"
                                },
                                {
                                    method: "wallet"
                                }
                            ]
                        }
                    },
                    sequence: ["block.upi", "block.other"],
                    preferences: {
                        show_default_blocks: false
                    }
                }
            },
            prefill: {
                name: order.name || "",
                email: order.email || ""
            },
            theme: {
                color: "#12645f"
            },
            handler: async (paymentResponse) => {
                paymentStatus.textContent = "Verifying payment...";

                const verifyResponse = await fetch("/payment/verify", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(paymentResponse)
                });
                const verifyResult = await verifyResponse.json();

                if (!verifyResponse.ok) {
                    paymentStatus.textContent = verifyResult.message || "Payment verification failed";
                    setStatus(verifyResult.message || "Payment verification failed.", "error");
                    return;
                }

                setAccessState(true, true);
                setResult("Payment verified", "Prediction and GlucoGuide Coach are now unlocked for this account.");
                setStatus(verifyResult.message || "Payment verified. Services unlocked.", "success");
            },
            modal: {
                ondismiss: () => {
                    paymentStatus.textContent = "Payment required";
                    setStatus("Payment was not completed.", "info");
                }
            }
        });

        checkout.open();
    } catch (error) {
        paymentStatus.textContent = "Payment service unavailable";
        setStatus("Could not start payment. Check server connection and try again.", "error");
    } finally {
        paymentInProgress = false;
        paymentButton.disabled = false;
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

    if (!userHasPaid) {
        setStatus("Please complete the Rs 10 payment before using GlucoGuide Coach.", "error");
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
                setAccessState(false, false);
            }

            if (response.status === 402) {
                setAccessState(true, false);
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
                tone: "error",
                riskPercent: 0
            });
            setStatus("Login required before using prediction services.", "error");
            return;
        }

        if (!userHasPaid) {
            setPredictionMessage({
                badge: "Rs",
                title: "Payment required",
                copy: "Please complete the one-time Rs 10 payment to use the diabetes prediction service.",
                suggestion: "After payment verification, prediction and GlucoGuide Coach will unlock automatically.",
                tone: "error",
                riskPercent: 0
            });
            setStatus("Payment required before using prediction services.", "error");
            return;
        }

        if (!predictForm.reportValidity()) {
            setPredictionMessage({
                badge: "!",
                title: "Input needs attention",
                copy: "Please enter values only within the allowed range shown below each field.",
                suggestion: "Once the inputs are valid, the chatbot section can help with food, routine, and prevention-related questions.",
                tone: "error",
                riskPercent: 0
            });
            return;
        }

        const formData = new FormData(predictForm);
        const allValues = Object.fromEntries(formData.entries());
        const data = modelFieldNames.reduce((payload, fieldName) => {
            payload[fieldName] = allValues[fieldName];
            return payload;
        }, {});

        try {
            setPredictionMessage({
                badge: "...",
                title: "Analyzing health data...",
                copy: "Checking your values with the trained model and preparing a doctor-friendly guidance card.",
                suggestion: "This usually takes a moment. The result is educational, not diagnostic.",
                tone: "info",
                riskPercent: 35,
                drivers: ["Model running"]
            });

            const submitButton = assessmentSubmit || predictForm.querySelector("button[type='submit']");
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Analyzing...";
            }

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
                    setAccessState(false, false);
                }

                if (response.status === 402) {
                    setAccessState(true, false);
                }

                setPredictionMessage({
                    badge: "!",
                    title: "Prediction request failed",
                    copy: result.error || "Please verify the backend and ML API connection, then try again.",
                    suggestion: "The chatbot area can still be used later for lifestyle, prevention, and diabetes-awareness questions.",
                    tone: "error",
                    riskPercent: 0
                });
                return;
            }

            const riskPercent = estimateRiskPercent(result.prediction, allValues);
            const tone = getRiskTone(riskPercent, result.prediction);
            const drivers = buildRiskDrivers(allValues);
            const riskCopy = getRiskCopy(tone, riskPercent, drivers);

            setPredictionMessage({
                ...riskCopy,
                tone,
                riskPercent,
                drivers
            });

            updateChatbotFromPrediction(result.prediction, {
                Glucose: Number(data.Glucose),
                BMI: Number(data.BMI),
                Age: Number(data.Age)
            }, riskPercent);
            setStatus("Prediction completed. GlucoGuide Coach has been updated with the latest screening context.", "success");
        } catch (error) {
            setPredictionMessage({
                badge: "!",
                title: "Service unavailable",
                copy: "Prediction service is not reachable right now. Check whether both backend and ML API are running.",
                suggestion: "Once the service is back, the chatbot area can support users with lifestyle and diabetes-related follow-up queries.",
                tone: "error",
                riskPercent: 0
            });
        } finally {
            const submitButton = assessmentSubmit || predictForm.querySelector("button[type='submit']");
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Analyze Risk";
            }
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

if (paymentButton) {
    paymentButton.addEventListener("click", startPayment);
}

initializeAssessmentWizard();
renderChatbotShortcuts(defaultChatPrompts);
resetPredictionState();
setAccessState(false, false);
syncAccessState();

/* ============================================================
   Hamburger Menu Toggle
   ============================================================ */
function toggleMobileNav() {
    if (!hamburgerBtn || !mobileNavOverlay) return;
    const isOpen = mobileNavOverlay.classList.toggle("is-open");
    hamburgerBtn.classList.toggle("is-open", isOpen);
    document.body.style.overflow = isOpen ? "hidden" : "";
}

function closeMobileNav() {
    if (!hamburgerBtn || !mobileNavOverlay) return;
    mobileNavOverlay.classList.remove("is-open");
    hamburgerBtn.classList.remove("is-open");
    document.body.style.overflow = "";
}

if (hamburgerBtn) {
    hamburgerBtn.addEventListener("click", toggleMobileNav);
}

if (mobileNavOverlay) {
    mobileNavOverlay.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeMobileNav);
    });

    mobileNavOverlay.addEventListener("click", (e) => {
        if (e.target === mobileNavOverlay) {
            closeMobileNav();
        }
    });
}

window.addEventListener("resize", () => {
    if (window.innerWidth > 1100) {
        closeMobileNav();
    }
});

/* ============================================================
   Scroll-Triggered Entrance Animations
   ============================================================ */
const animatedElements = document.querySelectorAll("[data-animate]");

if (animatedElements.length > 0 && "IntersectionObserver" in window) {
    const animationObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    animationObserver.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.1,
            rootMargin: "0px 0px -40px 0px"
        }
    );

    animatedElements.forEach((el) => animationObserver.observe(el));
} else {
    animatedElements.forEach((el) => el.classList.add("is-visible"));
}

/* ============================================================
   Light & Dark Theme Switcher
   ============================================================ */
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeToggleDarkIcon = document.getElementById("themeToggleDarkIcon");
const themeToggleLightIcon = document.getElementById("themeToggleLightIcon");

function initTheme() {
    if (!themeToggleBtn || !themeToggleDarkIcon || !themeToggleLightIcon) return;

    // Check localStorage or system preference
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
        document.body.classList.add("dark-theme");
        themeToggleDarkIcon.style.display = "none";
        themeToggleLightIcon.style.display = "block";
    } else {
        document.body.classList.remove("dark-theme");
        themeToggleDarkIcon.style.display = "block";
        themeToggleLightIcon.style.display = "none";
    }

    themeToggleBtn.addEventListener("click", () => {
        const isDark = document.body.classList.toggle("dark-theme");
        localStorage.setItem("theme", isDark ? "dark" : "light");

        if (isDark) {
            themeToggleDarkIcon.style.display = "none";
            themeToggleLightIcon.style.display = "block";
        } else {
            themeToggleDarkIcon.style.display = "block";
            themeToggleLightIcon.style.display = "none";
        }
    });
}

initTheme();
