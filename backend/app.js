const express = require("express")
const mongoose = require("mongoose")
const cookieParser = require("cookie-parser")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const OpenAI = require("openai")
const path = require("path")
require("dotenv").config({ path: path.join(__dirname, ".env") })

const app = express()
const PORT = process.env.PORT || 5000
const JWT_SECRET = process.env.JWT_SECRET || "secret"
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ""
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini"
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, "public")))

if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is missing. Add it to backend/.env before starting the server.")
    process.exit(1)
}

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("DB Connected"))
    .catch((err) => console.log(err))

const userModel = require("./models/user")

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body

        console.log("Register request received:", {
            name: name || null,
            email: email || null,
            passwordLength: password ? String(password).length : 0
        })

        if (!name || !email || !password) {
            console.log("Register validation failed: missing required fields")
            return res.status(400).json({ message: "Name, email, and password are required" })
        }

        const user = await userModel.findOne({ email })
        console.log("Existing user lookup completed:", Boolean(user))

        if (user) {
            console.log("Register blocked: user already exists for email", email)
            return res.status(409).json({ message: "User already exists" })
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        console.log("Password hashed successfully for", email)

        const newUser = await userModel.create({
            name,
            email,
            password: hashedPassword
        })

        console.log("User created successfully with id:", String(newUser._id))

        const token = jwt.sign({ userid: newUser._id }, JWT_SECRET)
        console.log("JWT created successfully for user:", String(newUser._id))

        res.cookie("token", token, { httpOnly: true })
        res.status(201).json({
            message: "Registered and logged in",
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email
            }
        })

        console.log("Register response sent successfully for", email)
    } catch (error) {
        console.error("Registration error details:", error)
        res.status(500).json({ message: error.message || "Registration failed" })
    }
})

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" })
        }

        const user = await userModel.findOne({ email })
        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.status(401).json({ message: "Wrong password" })
        }

        const token = jwt.sign({ userid: user._id }, JWT_SECRET)

        res.cookie("token", token, { httpOnly: true })
        res.json({
            message: "Login successful",
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        })
    } catch (error) {
        console.error("Login error:", error)
        res.status(500).json({ message: error.message || "Login failed" })
    }
})

app.post("/forgot-password", async (req, res) => {
    try {
        const { email, password, confirmPassword } = req.body

        if (!email || !password || !confirmPassword) {
            return res.status(400).json({ message: "Email, new password, and confirm password are required" })
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters long" })
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match" })
        }

        const user = await userModel.findOne({ email })
        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }

        user.password = await bcrypt.hash(password, 10)
        await user.save()

        res.json({ message: "Password reset successful. Please login with your new password." })
    } catch (error) {
        console.error("Forgot password error:", error)
        res.status(500).json({ message: error.message || "Password reset failed" })
    }
})

function isLoggedIn(req, res, next) {
    try {
        if (!req.cookies.token) {
            return res.status(401).json({ message: "Please login first" })
        }

        const data = jwt.verify(req.cookies.token, JWT_SECRET)
        req.user = data
        next()
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token" })
    }
}

app.get("/profile", isLoggedIn, async (req, res) => {
    const user = await userModel.findById(req.user.userid)

    if (!user) {
        return res.status(404).json({ message: "User not found" })
    }

    res.json({
        user: {
            id: user._id,
            name: user.name,
            email: user.email
        }
    })
})

app.get("/logout", (req, res) => {
    res.clearCookie("token")
    res.json({ message: "Logged out" })
})

app.post("/predict", isLoggedIn, async (req, res) => {
    try {
        const payload = {
            ...req.body,
            BMI: Number(req.body.BMI),
            Glucose: Number(req.body.Glucose),
            Age: Number(req.body.Age)
        }

        payload.BMI_Category = payload.BMI > 30 ? 1 : 0
        payload.High_Glucose = payload.Glucose > 140 ? 1 : 0
        payload.Age_Group = payload.Age > 40 ? 1 : 0

        const response = await fetch("https://diabetesplatformmlapi.onrender.com/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })

        const data = await response.json()
        res.status(response.status).json(data)
    } catch (err) {
        console.log(err)
        res.status(500).send("Error connecting to ML API")
    }
})

function normalizeChatText(value = "") {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function includesAny(text, phrases = []) {
    return phrases.some((phrase) => text.includes(phrase))
}

function toSafeNumber(value) {
    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue : null
}

function buildPredictionSummary(context = {}) {
    const riskLevel = context.riskLevel === "high" ? "high" : context.riskLevel === "low" ? "low" : "unknown"
    const glucose = toSafeNumber(context.glucose)
    const bmi = toSafeNumber(context.bmi)
    const age = toSafeNumber(context.age)
    const signals = []

    if (glucose !== null && glucose >= 140) {
        signals.push("glucose is above 140 mg/dL")
    }

    if (bmi !== null && bmi >= 30) {
        signals.push("BMI is 30 or higher")
    }

    if (age !== null && age >= 40) {
        signals.push("age is above 40")
    }

    let summary = "No recent prediction context is attached yet."

    if (riskLevel === "high") {
        summary = "Your latest screening points toward a higher diabetes risk, so prevention and clinical follow-up should be taken seriously."
    } else if (riskLevel === "low") {
        summary = "Your latest screening points toward a lower diabetes risk, but long-term prevention habits still matter."
    }

    if (signals.length > 0) {
        summary += ` Key signal${signals.length > 1 ? "s" : ""}: ${signals.join(", ")}.`
    }

    return { riskLevel, glucose, bmi, age, signals, summary }
}

function sanitizeConversationHistory(history = []) {
    if (!Array.isArray(history)) {
        return []
    }

    return history
        .filter((item) => item && (item.role === "user" || item.role === "assistant"))
        .map((item) => ({
            role: item.role,
            content: String(item.content || "").trim().slice(0, 4000)
        }))
        .filter((item) => item.content.length > 0)
        .slice(-10)
}

function normalizeReplyForBulletDisplay(reply = "") {
    const text = String(reply || "")
        .replace(/\r/g, "")
        .trim()

    if (!text) {
        return ""
    }

    if (/\n/.test(text) && /(^|\n)([-*•]\s+|\d+\.\s+|[A-Za-z][A-Za-z0-9\s/&()+-]{1,48}:)/.test(text)) {
        return text
    }

    const paragraphs = text
        .split(/\n+/)
        .map((part) => part.trim())
        .filter(Boolean)

    if (paragraphs.length > 1) {
        return paragraphs
            .map((paragraph) => CHAT_SECTION_HEADER_REGEX.test(paragraph) ? paragraph : `- ${paragraph}`)
            .join("\n")
    }

    const sentences = text.match(/[^.!?]+[.!?]?/g)

    if (!sentences || sentences.length <= 1) {
        return `- ${text}`
    }

    return sentences
        .map((sentence) => sentence.trim())
        .filter(Boolean)
        .map((sentence) => `- ${sentence}`)
        .join("\n")
}

const CHAT_SECTION_HEADER_REGEX = /^[A-Za-z][A-Za-z0-9\s/&()+-]{1,48}:$/

function extractTopicSnippet(message = "") {
    return String(message || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 120)
}

function buildOpenAIInstructions(predictionContext = {}) {
    const context = buildPredictionSummary(predictionContext)

    return [
        "You are GlucoGuide Coach inside the GlucoSense AI web app.",
        "You are a helpful general-purpose AI assistant and can answer broad user questions, not just diabetes questions.",
        "Make sure your answer changes based on the user's actual question instead of repeating the same template.",
        "When the topic is diabetes, health, food, symptoms, medicine, exercise, or glucose, be extra careful, practical, and clear.",
        "Do not claim to diagnose diseases, prescribe medication, or replace a licensed clinician.",
        "If the user mentions emergency symptoms such as chest pain, trouble breathing, fainting, severe confusion, or being hard to wake, tell them to seek urgent medical care immediately.",
        "Keep answers user-friendly and directly useful.",
        "Format every answer in short point-wise bullets instead of one large paragraph.",
        "Prefer a short section label such as Quick take: or Next steps: followed by 3 to 6 concise bullets.",
        "If the user asks for risky medical, legal, or financial certainty, give general information and recommend an appropriate professional.",
        `Latest diabetes screening context: ${context.summary}`
    ].join(" ")
}

async function buildOpenAIChatbotReply(message, predictionContext = {}, conversation = []) {
    const normalizedMessage = String(message || "").trim()
    const context = buildPredictionSummary(predictionContext)
    const history = sanitizeConversationHistory(conversation)

    const input = [
        ...history.map((item) => ({
            role: item.role,
            content: [{ type: "input_text", text: item.content }]
        })),
        {
            role: "user",
            content: [{ type: "input_text", text: normalizedMessage }]
        }
    ]

    const response = await openai.responses.create({
        model: OPENAI_MODEL,
        instructions: buildOpenAIInstructions(predictionContext),
        input
    })

    const reply = String(response.output_text || "").trim()

    return {
        tone: context.riskLevel === "high" ? "error" : "success",
        reply: normalizeReplyForBulletDisplay(reply || "I could not generate a reply just now. Please try again."),
        suggestions: context.riskLevel === "high"
            ? [
                "What should I do after a high-risk result?",
                "Give me a diabetes-friendly meal plan",
                "Explain this in simple words",
                "Build me a daily prevention routine"
            ]
            : [
                "Summarize this simply",
                "Help me plan my day",
                "Ask me anything",
                "Write a professional email"
            ],
        mode: "openai"
    }
}

function buildChatbotReply(message, predictionContext = {}) {
    const normalizedMessage = normalizeChatText(message)
    const context = buildPredictionSummary(predictionContext)
    const contextTail = context.signals.length
        ? ` In your latest screening, ${context.signals.join(", ")}.`
        : ` ${context.summary}`

    if (!normalizedMessage) {
        return {
            tone: "info",
            reply: "Ask me about diabetes-friendly meals, exercise, glucose habits, symptoms, sleep, hydration, or how to respond to your latest screening result.",
            suggestions: [
                "What breakfast is diabetes-friendly?",
                "How can I lower my risk?",
                "What does high glucose usually mean?"
            ]
        }
    }

    if (includesAny(normalizedMessage, ["emergency", "chest pain", "faint", "fainted", "unconscious", "can t breathe", "cant breathe", "trouble breathing", "severe vomiting", "confused"])) {
        return {
            tone: "error",
            reply: "If there is chest pain, breathing trouble, fainting, severe vomiting, confusion, or someone is hard to wake, treat that as urgent and seek emergency medical care now. This chatbot is only for educational support and cannot safely assess emergencies.",
            suggestions: [
                "What symptoms need urgent care?",
                "How do I prepare for a doctor visit?",
                "What daily habits reduce diabetes risk?"
            ]
        }
    }

    if (includesAny(normalizedMessage, ["hello", "hi", "hey", "namaste", "good morning", "good evening"])) {
        return {
            tone: "success",
            reply: `I'm GlucoGuide Coach, your diabetes-oriented support assistant. I can help with meals, activity, hydration, sleep, symptoms, and prevention-focused routines.${contextTail}`,
            suggestions: [
                "Suggest a full day meal plan",
                "Give me a walking routine",
                "How should I respond to high risk?"
            ]
        }
    }

    if (includesAny(normalizedMessage, ["email", "mail", "message", "formal", "resume", "cv", "cover letter", "application"])) {
        return {
            tone: "success",
            reply: "Writing help:\n- Start with a clear purpose in the first line so the reader immediately understands the message.\n- Keep the body focused on the main request, update, or action you want.\n- Close politely with one simple next step such as a reply request or thank-you.\n- If you want, paste your draft and I can rewrite it in a more professional tone.",
            suggestions: [
                "Write a professional email",
                "Improve my resume summary",
                "Rewrite this message formally",
                "Write a short cover letter"
            ]
        }
    }

    if (includesAny(normalizedMessage, ["code", "coding", "program", "bug", "debug", "javascript", "python", "html", "css", "react", "node"])) {
        return {
            tone: "success",
            reply: "Coding help:\n- Tell me the language, the exact problem, and what output you expect.\n- If there is an error, share the exact error message and the nearby code.\n- I can help explain logic, fix bugs, improve structure, or rewrite code more cleanly.\n- For the fastest result, send a small code snippet and describe what is not working.",
            suggestions: [
                "Fix a JavaScript bug",
                "Explain React simply",
                "Help me write Python code",
                "Review my HTML and CSS"
            ]
        }
    }

    if (includesAny(normalizedMessage, ["study", "exam", "assignment", "homework", "notes", "summary", "summarize", "explain", "meaning", "what is", "how does"])) {
        return {
            tone: "success",
            reply: `Study help:\n- Your topic is: ${extractTopicSnippet(message)}.\n- I can explain it in simple words, convert it into bullet notes, or turn it into quick revision points.\n- If you want exam prep, I can also create likely questions and short answers.\n- Tell me whether you want a simple explanation, deep explanation, or short exam answer.`,
            suggestions: [
                "Explain this in simple words",
                "Turn this into revision notes",
                "Make likely exam questions",
                "Summarize this topic in bullets"
            ]
        }
    }

    if (includesAny(normalizedMessage, ["plan", "schedule", "routine", "productivity", "time management", "organize", "day plan", "weekly plan"])) {
        return {
            tone: "success",
            reply: "Planning help:\n- Start by choosing the top 1 to 3 priorities instead of trying to do everything at once.\n- Break each priority into small tasks that can be completed in 20 to 45 minutes.\n- Keep some buffer time so the plan stays realistic and less stressful.\n- If you want, I can build you a day plan, weekly routine, or study timetable.",
            suggestions: [
                "Build me a study timetable",
                "Plan my day in time blocks",
                "Create a weekly routine",
                "Help me prioritize tasks"
            ]
        }
    }

    if (includesAny(normalizedMessage, ["diet", "food", "meal", "breakfast", "lunch", "dinner", "snack", "eat", "rice", "fruit", "carb", "sugar"])) {
        const riskLine = context.riskLevel === "high"
            ? "Because your latest screening looks higher risk, build meals around steadier blood sugar patterns."
            : "Even with a lower-risk result, consistent meal balance is one of the best prevention habits."

        return {
            tone: "success",
            reply: `${riskLine} Aim for a plate with non-starchy vegetables, a lean protein, high-fiber carbs in moderate portions, and minimal sugary drinks. Good options include eggs with vegetables, dal with salad, grilled paneer or chicken with mixed vegetables, Greek yogurt, nuts, oats, beans, and whole grains in controlled portions.${contextTail} If you want, I can also give you a breakfast-only, vegetarian, or Indian-style meal plan.`,
            suggestions: [
                "Give me a breakfast plan",
                "Suggest Indian diabetes-friendly meals",
                "What snacks are better than sweets?"
            ]
        }
    }

    if (includesAny(normalizedMessage, ["exercise", "walk", "walking", "workout", "gym", "activity", "yoga", "steps"])) {
        const riskLine = context.riskLevel === "high"
            ? "With a higher-risk screening, steady daily movement is especially valuable."
            : "Regular activity helps keep insulin sensitivity and weight trends in a healthier range."

        return {
            tone: "success",
            reply: `${riskLine} A practical starting plan is 20 to 30 minutes of brisk walking most days, plus 2 or 3 short strength sessions per week using bodyweight exercises like squats, wall push-ups, and step-ups. After meals, even a 10-minute walk can help with glucose control.${contextTail} Start gently if you are inactive, and check with a clinician before major exercise changes if you already have medical conditions.`,
            suggestions: [
                "Build me a 7-day routine",
                "What should I do after meals?",
                "How much walking is enough?"
            ]
        }
    }

    if (includesAny(normalizedMessage, ["symptom", "thirst", "tired", "fatigue", "blurry", "vision", "urination", "pee", "tingling"])) {
        return {
            tone: "info",
            reply: `Common diabetes warning signs can include unusual thirst, frequent urination, fatigue, blurry vision, slow-healing cuts, tingling, or unexpected weight changes. These symptoms do not confirm diabetes on their own, but they do deserve attention.${contextTail} If symptoms are persistent or worsening, arrange a medical evaluation and glucose testing rather than relying only on the chatbot.`,
            suggestions: [
                "What tests should I ask about?",
                "How do fasting glucose and A1c differ?",
                "What habits help before my appointment?"
            ]
        }
    }

    if (includesAny(normalizedMessage, ["glucose", "blood sugar", "a1c", "hba1c", "monitor", "testing", "fasting"])) {
        return {
            tone: "info",
            reply: `Blood glucose is your short-term sugar level, while HbA1c reflects average glucose over roughly the last 2 to 3 months. Fasting glucose, post-meal glucose, and A1c are often used together for a clearer picture. A single number should be interpreted with medical context.${contextTail} If you already monitor at home, tracking trends with meal timing, sleep, and activity can be more helpful than focusing on one isolated reading.`,
            suggestions: [
                "Explain fasting vs post-meal glucose",
                "How do I log my readings?",
                "What affects glucose spikes?"
            ]
        }
    }

    if (includesAny(normalizedMessage, ["risk", "prevent", "prevention", "reduce", "prediction", "result", "high risk", "low risk"])) {
        const riskResponse = context.riskLevel === "high"
            ? "Because the latest model result was higher risk, the next best steps are to tighten food quality, increase regular activity, improve sleep, reduce sugary drinks, and arrange a clinical review for proper testing."
            : context.riskLevel === "low"
                ? "Because the latest model result was lower risk, the goal is to protect that position with sustainable prevention habits rather than becoming complacent."
                : "If no prediction result is attached, focus on the core prevention habits that lower long-term risk."

        return {
            tone: context.riskLevel === "high" ? "error" : "success",
            reply: `${riskResponse} The strongest prevention levers are weight management when needed, fiber-rich meals, daily movement, hydration, consistent sleep, and follow-up testing when symptoms or family history are present.${contextTail} I can help turn that into a daily plan if you want.`,
            suggestions: [
                "Create a daily risk-reduction plan",
                "How should I improve my meals?",
                "What follow-up questions should I ask a doctor?"
            ]
        }
    }

    if (includesAny(normalizedMessage, ["sleep", "stress", "hydration", "water", "routine", "lifestyle"])) {
        return {
            tone: "success",
            reply: `Lifestyle habits matter more than they look. Aim for regular sleep, enough water through the day, reduced sugary drinks, simple stress control like walking or breathing exercises, and meal timing that avoids constant snacking. Poor sleep and high stress can make glucose control harder.${contextTail}`,
            suggestions: [
                "Build me a morning routine",
                "How much water should I drink?",
                "Give me simple stress-control tips"
            ]
        }
    }

    if (includesAny(normalizedMessage, ["medicine", "medication", "insulin", "metformin", "dose", "tablet"])) {
        return {
            tone: "info",
            reply: "I can explain what medications are generally used for diabetes, but I should not recommend doses, start/stop medicine, or replace your clinician. For anything medication-specific, the safe next step is to confirm it with a doctor or pharmacist.",
            suggestions: [
                "What is metformin generally used for?",
                "What lifestyle changes support medication?",
                "What should I ask my doctor?"
            ]
        }
    }

    return {
        tone: "info",
        reply: `General support:\n- You asked about: ${extractTopicSnippet(message) || "a general topic"}.\n- I can help with diabetes guidance, study explanations, writing, coding basics, and day planning.\n- Ask in a direct way and I will answer in simple points instead of one big paragraph.\n- If this is health-related, I will also use your latest screening context when it helps.${contextTail}`,
        suggestions: [
            "What should I eat for breakfast?",
            "How can I reduce diabetes risk?",
            "Explain glucose in simple words",
            "Help me write a professional email"
        ],
        mode: "fallback"
    }
}

app.post("/chatbot", isLoggedIn, async (req, res) => {
    try {
        const { message, predictionContext, conversation } = req.body || {}

        if (!String(message || "").trim()) {
            return res.status(400).json({
                message: "Message is required"
            })
        }

        let replyPayload

        if (openai) {
            try {
                replyPayload = await buildOpenAIChatbotReply(message, predictionContext, conversation)
            } catch (openaiError) {
                console.error("OpenAI chatbot error, falling back to local guidance:", openaiError)
                replyPayload = {
                    mode: "fallback",
                    ...buildChatbotReply(message, predictionContext)
                }
            }
        } else {
            replyPayload = {
                mode: "fallback",
                ...buildChatbotReply(message, predictionContext)
            }
        }

        res.json({
            ...replyPayload,
            reply: normalizeReplyForBulletDisplay(replyPayload.reply),
            brand: "GlucoGuide Coach",
            model: OPENAI_MODEL,
            disclaimer: "Educational support only. It does not diagnose, prescribe, or replace a licensed clinician."
        })
    } catch (error) {
        console.error("Chatbot error:", error)
        res.status(500).json({
            message: "Chatbot request failed"
        })
    }
})

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`)
})
