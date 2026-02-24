/* ═══════════════════════════════════════════════
   EXPRESSION COMPILER VISUALIZER — Client Script
   ═══════════════════════════════════════════════ */

// Allow Enter key to trigger compile
document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("expressionInput");
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") compileExpression();
    });
});

async function compileExpression() {
    const errorDiv = document.getElementById("errorMessage");
    const btn = document.getElementById("compileBtn");

    // Hide previous error
    errorDiv.classList.add("hidden");
    errorDiv.textContent = "";

    // Clear previous results and remove reveal class
    const phaseIds = ["lexicalOutput", "syntaxOutput", "semanticOutput", "intermediateOutput", "finalOutput"];
    phaseIds.forEach(id => {
        document.getElementById(id).textContent = "";
    });
    document.querySelectorAll(".phase").forEach(el => el.classList.remove("reveal"));

    const expression = document.getElementById("expressionInput").value.trim();
    if (!expression) {
        showError("Please enter an expression");
        return;
    }

    // Loading state
    btn.classList.add("loading");
    btn.querySelector(".btn-text").textContent = "Compiling";

    try {
        const response = await fetch("/compile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expression })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        // Map data to outputs
        const results = [
            { id: "lexicalOutput",      value: data.tokens        || "(no tokens)" },
            { id: "syntaxOutput",       value: data.syntaxTree    || "(empty tree)" },
            { id: "semanticOutput",     value: data.semantic      || "(no semantic info)" },
            { id: "intermediateOutput", value: data.intermediate  || "(no TAC)" },
            { id: "finalOutput",        value: data.final         || "(no final code)" }
        ];

        // Staggered reveal — each phase appears one after another
        results.forEach((item, index) => {
            setTimeout(() => {
                const el = document.getElementById(item.id);
                el.textContent = item.value;
                el.closest(".phase").classList.add("reveal");
            }, index * 180);  // 180ms stagger between each phase
        });

    } catch (err) {
        console.error(err);
        showError(err.message || "Failed to connect / unknown error");
    } finally {
        // Reset button
        btn.classList.remove("loading");
        btn.querySelector(".btn-text").textContent = "Compile";
    }
}

function showError(msg) {
    const errorDiv = document.getElementById("errorMessage");
    errorDiv.textContent = "⚠ " + msg;
    errorDiv.classList.remove("hidden");
}