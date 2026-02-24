async function compileExpression() {
    const errorDiv = document.getElementById("errorMessage");
    errorDiv.classList.add("hidden");
    errorDiv.textContent = "";

    // Clear previous results
    const outputs = ["lexicalOutput", "syntaxOutput", "semanticOutput", "intermediateOutput", "finalOutput"];
    outputs.forEach(id => {
        document.getElementById(id).textContent = "";
    });

    const expression = document.getElementById("expressionInput").value.trim();

    if (!expression) {
        showError("Please enter an expression");
        return;
    }

    try {
        const response = await fetch("http://localhost:5000/compile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expression })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        document.getElementById("lexicalOutput").textContent = data.tokens || "(no tokens)";
        document.getElementById("syntaxOutput").textContent   = data.syntaxTree || "(empty tree)";
        document.getElementById("semanticOutput").textContent = data.semantic || "(no semantic info)";
        document.getElementById("intermediateOutput").textContent = data.intermediate || "(no TAC)";
        document.getElementById("finalOutput").textContent    = data.final || "(no final code)";

    } catch (err) {
        console.error(err);
        showError(err.message || "Failed to connect / unknown error");
    }
}

function showError(msg) {
    const errorDiv = document.getElementById("errorMessage");
    errorDiv.textContent = "Error: " + msg;
    errorDiv.classList.remove("hidden");
}