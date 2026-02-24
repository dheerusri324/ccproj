const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.static("public"));

// Optional: redirect root to index.html explicitly
app.get("/", (req, res) => {
    res.sendFile("index.html", { root: __dirname + "/public" });
});
app.use(cors());
app.use(express.json());

/* ─────────────────────────────────────────────
    TOKENIZER (returns array of token objects)
─────────────────────────────────────────────── */
function tokenize(input) {
    const tokens = [];
    let i = 0;

    const skipWhitespace = () => {
        while (i < input.length && /\s/.test(input[i])) i++;
    };

    while (i < input.length) {
        skipWhitespace();
        if (i >= input.length) break;

        const ch = input[i];

        // Numbers (integer or decimal)
        if (/\d/.test(ch) || (ch === '.' && /\d/.test(input[i+1] || ''))) {
            let num = '';
            while (i < input.length && /[\d.]/.test(input[i])) {
                num += input[i++];
            }
            if ((num.match(/\./g) || []).length > 1) {
                throw new Error("Invalid number format: multiple dots");
            }
            tokens.push({ type: "NUMBER", value: num });
            continue;
        }

        // Identifiers / variables
        if (/[a-zA-Z]/.test(ch)) {
            let id = '';
            while (i < input.length && /[a-zA-Z0-9]/.test(input[i])) {
                id += input[i++];
            }
            tokens.push({ type: "IDENT", value: id });
            continue;
        }

        // Operators & parentheses
        if ("+-*/()".includes(ch)) {
            tokens.push({ type: "OPERATOR", value: ch });
            i++;
            continue;
        }

        throw new Error(`Invalid character: '${ch}' at position ${i+1}`);
    }

    return tokens;
}

/* ─────────────────────────────────────────────
    RECURSIVE DESCENT PARSER
─────────────────────────────────────────────── */
class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }

    peek() {
        return this.tokens[this.pos] || null;
    }

    consume() {
        return this.tokens[this.pos++];
    }

    eat(type, value) {
        const tok = this.peek();
        if (!tok || tok.type !== type || (value && tok.value !== value)) {
            throw new Error(`Expected ${type} ${value ? `'${value}'` : ''} but got ${tok ? tok.type : 'EOF'}`);
        }
        return this.consume();
    }

    parseExpression() {
        let node = this.parseTerm();
        while (this.peek() && ["+", "-"].includes(this.peek().value)) {
            const op = this.consume().value;
            const right = this.parseTerm();
            node = { type: "BinaryOp", operator: op, left: node, right };
        }
        return node;
    }

    parseTerm() {
        let node = this.parseFactor();
        while (this.peek() && ["*", "/"].includes(this.peek().value)) {
            const op = this.consume().value;
            const right = this.parseFactor();
            node = { type: "BinaryOp", operator: op, left: node, right };
        }
        return node;
    }

    parseFactor() {
        const tok = this.peek();

        if (!tok) {
            throw new Error("Unexpected end of input");
        }

        if (tok.type === "NUMBER") {
            this.consume();
            return { type: "Number", value: tok.value };
        }

        if (tok.type === "IDENT") {
            this.consume();
            return { type: "Variable", name: tok.value };
        }

        if (tok.value === "(") {
            this.consume();
            const node = this.parseExpression();
            this.eat("OPERATOR", ")");
            return node;
        }

        // Unary minus
        if (tok.value === "-") {
            this.consume();
            const expr = this.parseFactor();
            return { type: "UnaryOp", operator: "-", operand: expr };
        }

        throw new Error(`Unexpected token: ${tok.type} '${tok.value}'`);
    }
}

/* ─────────────────────────────────────────────
    AST → TREE STRING (pretty print)
─────────────────────────────────────────────── */
function printTree(node, indent = 0) {
    if (!node) return "";

    const prefix = "  ".repeat(indent);
    let out = "";

    if (node.type === "BinaryOp") {
        out += `${prefix}${node.operator}\n`;
        out += printTree(node.left, indent + 1);
        out += printTree(node.right, indent + 1);
    } else if (node.type === "UnaryOp") {
        out += `${prefix}${node.operator} (unary)\n`;
        out += printTree(node.operand, indent + 1);
    } else if (node.type === "Number") {
        out += `${prefix}${node.value}\n`;
    } else if (node.type === "Variable") {
        out += `${prefix}${node.name}\n`;
    }

    return out;
}

/* ─────────────────────────────────────────────
    THREE-ADDRESS CODE GENERATION
─────────────────────────────────────────────── */
function generateTAC(node) {
    const tac = [];
    let tempCounter = 0;

    function gen(node) {
        if (node.type === "Number") {
            return node.value;
        }
        if (node.type === "Variable") {
            return node.name;
        }
        if (node.type === "UnaryOp" && node.operator === "-") {
            const operand = gen(node.operand);
            const temp = `t${tempCounter++}`;
            tac.push(`${temp} = -${operand}`);
            return temp;
        }
        if (node.type === "BinaryOp") {
            const left = gen(node.left);
            const right = gen(node.right);
            const temp = `t${tempCounter++}`;
            tac.push(`${temp} = ${left} ${node.operator} ${right}`);
            return temp;
        }
        throw new Error("Unknown node type in TAC generation");
    }

    const result = gen(node);
    if (tac.length === 0) {
        tac.push(`result = ${result}`);
    } else {
        tac.push(`result = ${result}`);
    }

    return tac;
}

/* ─────────────────────────────────────────
    PSEUDO-ASSEMBLY (final output)
─────────────────────────────────────────────── */
function generateFinalCode(tacLines) {
    const lines = [];
    for (const line of tacLines) {
        if (line.includes("=")) {
            const [target, expr] = line.split(" = ");
            lines.push(`MOV ${target.trim()}, ${expr.trim()}`);
        }
    }
    return lines.join("\n");
}

/* ─────────────────────────────────────────────
    EXPRESSION ENDPOINT
─────────────────────────────────────────────── */
app.post("/compile", (req, res) => {
    try {
        const { expression } = req.body;
        if (!expression || typeof expression !== "string") {
            return res.status(400).json({ error: "Missing or invalid expression" });
        }

        const tokens = tokenize(expression);
        const parser = new Parser(tokens);
        const ast = parser.parseExpression();

        if (parser.pos !== tokens.length) {
            throw new Error("Extra tokens after expression");
        }

        const syntaxTree = printTree(ast).trim() || "(empty tree)";
        const tacLines = generateTAC(ast);
        const finalCode = generateFinalCode(tacLines);

        res.json({
            tokens: tokens.map(t => `${t.type.padEnd(8)} ${t.value}`).join("\n"),
            syntaxTree,
            semantic: JSON.stringify(ast, null, 2),
            intermediate: tacLines.join("\n"),
            final: finalCode || "(single value - no operations)"
        });

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running → http://localhost:${PORT}`);
});